import Capacitor
import Foundation
import Photos
import PhotosUI // presentLimitedLibraryPicker lives here, not in Photos itself
import PhotoVaultKit

/// The real PhotoKit-backed implementation of the `PhotoLibraryPlugin` interface
/// declared in apps/web/src/plugins/photoLibrary.ts — Capacitor prefers this over
/// the web mock automatically on-device (registered in MainViewController.swift).
///
/// Scope note: this covers requestAuthorization/presentLimitedLibraryPicker/
/// getLibrarySummary/syncLibrary/queryAssets against the real Photos library.
/// `syncLibrary` does real `PHPersistentChangeToken`-based incremental sync,
/// persisted into PhotoVaultKit's IndexStore (docs/CONTEXT.md §7.1) — see
/// `performSync()` below. `getLibrarySummary`/`queryAssets` still read PhotoKit
/// directly rather than the persisted `library_assets` table; routing them through
/// IndexStore too is follow-up work, not required for #11's literal scope
/// ("incremental sync... persisting into PhotoVaultKit's IndexStore").
/// `bytesEstimate` is a heuristic (no cheap, non-deprecated PhotoKit API gives
/// exact file size without exporting the resource) — real sizes come from the
/// backup engine's actual export, later. Thumbnails (`pv-thumb://`) are handled
/// by PVThumbSchemeHandler.swift, not this file.
@objc(PhotoLibraryPlugin)
public class PhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoLibraryPlugin"
    public let jsName = "PhotoLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentLimitedLibraryPicker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLibrarySummary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncLibrary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryAssets", returnType: CAPPluginReturnPromise)
    ]

    // Rough per-item size heuristic (documented above) until real export-time
    // sizing exists. Kept as constants so getLibrarySummary and queryAssets agree.
    private static let avgPhotoBytes: Int64 = 3_000_000
    private static let avgVideoBytes: Int64 = 40_000_000

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            call.resolve(["status": Self.statusString(status)])
        }
    }

    @objc func presentLimitedLibraryPicker(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("No view controller available to present the picker from")
                return
            }
            PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: viewController)
            call.resolve()
        }
    }

    @objc func getLibrarySummary(_ call: CAPPluginCall) {
        guard Self.hasReadAccess() else {
            call.resolve(["total": 0, "photos": 0, "videos": 0, "bytesEstimate": 0])
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let photos = PHAsset.fetchAssets(with: .image, options: nil).count
            let videos = PHAsset.fetchAssets(with: .video, options: nil).count
            let bytesEstimate = Int64(photos) * Self.avgPhotoBytes + Int64(videos) * Self.avgVideoBytes
            call.resolve([
                "total": photos + videos,
                "photos": photos,
                "videos": videos,
                "bytesEstimate": bytesEstimate
            ])
        }
    }

    @objc func syncLibrary(_ call: CAPPluginCall) {
        guard Self.hasReadAccess() else {
            call.resolve(["added": 0, "changed": 0, "removed": 0])
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try Self.performSync()
                call.resolve(["added": result.added, "changed": result.changed, "removed": result.removed])
            } catch {
                call.reject("syncLibrary failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func queryAssets(_ call: CAPPluginCall) {
        guard Self.hasReadAccess() else {
            call.resolve(["items": [], "total": 0, "bytes": 0])
            return
        }
        let limit = call.getInt("limit") ?? 200
        let cursor = Int(call.getString("cursor") ?? "0") ?? 0
        let sort = call.getString("sort") ?? "newest"

        DispatchQueue.global(qos: .userInitiated).async {
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: sort == "oldest")]
            let result = PHAsset.fetchAssets(with: options)

            var totalBytes: Int64 = 0
            var items: [[String: Any]] = []
            let endIndex = min(cursor + limit, result.count)

            result.enumerateObjects { asset, index, stop in
                let bytes = Self.estimatedBytes(for: asset)
                totalBytes += bytes
                if index >= cursor && index < endIndex {
                    items.append(Self.assetSummary(for: asset, bytesEstimate: bytes))
                }
            }

            var response: [String: Any] = [
                "items": items,
                "total": result.count,
                "bytes": totalBytes
            ]
            if endIndex < result.count {
                response["nextCursor"] = String(endIndex)
            }
            call.resolve(response)
        }
    }

    private static func hasReadAccess() -> Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return status == .authorized || status == .limited
    }

    private static func statusString(_ status: PHAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .limited: return "limited"
        case .denied, .restricted: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "notDetermined"
        }
    }

    private static func estimatedBytes(for asset: PHAsset) -> Int64 {
        asset.mediaType == .video ? avgVideoBytes : avgPhotoBytes
    }

    private static func kind(for asset: PHAsset) -> String {
        if asset.mediaSubtypes.contains(.photoScreenshot) { return "screenshot" }
        if asset.mediaSubtypes.contains(.photoLive) { return "live" }
        return asset.mediaType == .video ? "video" : "photo"
    }

    /// docs/CONTEXT.md §7.2: PhotoKit's `creationDate` is treated as the
    /// medium-confidence fallback in DateResolver.swift once EXIF isn't read yet
    /// here — formatted as a naive local wall clock (no explicit offset), matching
    /// that resolver's documented behavior for this exact source.
    private static func localWallClockISO(_ date: Date?) -> String {
        guard let date else { return "" }
        let formatter = ISO8601DateFormatter()
        formatter.timeZone = .current
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    private static func assetSummary(for asset: PHAsset, bytesEstimate: Int64) -> [String: Any] {
        var summary: [String: Any] = [
            "localId": asset.localIdentifier,
            "kind": kind(for: asset),
            "capturedAtLocal": localWallClockISO(asset.creationDate),
            "dateConfidence": "medium",
            "widthPx": asset.pixelWidth,
            "heightPx": asset.pixelHeight,
            "bytesEstimate": bytesEstimate,
            // Nothing is backed up natively yet (Phase 2 — the backup engine and
            // Vault don't exist on-device yet), so every asset is honestly reported
            // as not_backed_up rather than guessing.
            "status": "not_backed_up",
            "isFavorite": asset.isFavorite,
            "peopleIds": [],
            "albumIds": []
        ]
        if asset.mediaType == .video {
            summary["durationMs"] = Int(asset.duration * 1000)
        }
        if let location = asset.location {
            summary["location"] = [
                "lat": location.coordinate.latitude,
                "lon": location.coordinate.longitude
            ]
        }
        return summary
    }

    // MARK: - Library sync (docs/CONTEXT.md §7.1), backed by PhotoVaultKit.IndexStore

    private struct SyncResult {
        let added: Int
        let changed: Int
        let removed: Int
    }

    private static let metaChangeTokenKey = "last_change_token"

    /// `Application Support/PhotoVault/library.sqlite` — a vault-agnostic working DB
    /// used to track the library before a Vault/drive exists at all (issues #13/#14,
    /// deferred — no physical device to test real drive picking against yet, see
    /// docs/DECISIONS.md 0007). Once a Vault is set up, this reconciles with the
    /// per-vault DB docs/CONTEXT.md §6 describes; that migration is a Phase 2 concern,
    /// not this one.
    private static func indexStorePath() throws -> String {
        let appSupport = try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        let dir = appSupport.appendingPathComponent("PhotoVault", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("library.sqlite").path
    }

    private static func encodeToken(_ token: PHPersistentChangeToken) throws -> String {
        let data = try NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true)
        return data.base64EncodedString()
    }

    private static func decodeToken(_ encoded: String) -> PHPersistentChangeToken? {
        guard let data = Data(base64Encoded: encoded) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: PHPersistentChangeToken.self, from: data)
    }

    private static func upsert(_ asset: PHAsset, into store: IndexStore, deviceId: String, now: Int64) throws {
        let upsert = IndexStore.LibraryAssetUpsert(
            localId: asset.localIdentifier,
            deviceId: deviceId,
            mediaType: asset.mediaType == .video ? "video" : "photo",
            creationDate: asset.creationDate.map { Int64($0.timeIntervalSince1970) },
            modificationDate: asset.modificationDate.map { Int64($0.timeIntervalSince1970) },
            lat: asset.location?.coordinate.latitude,
            lon: asset.location?.coordinate.longitude,
            durationMs: asset.mediaType == .video ? Int(asset.duration * 1000) : nil,
            pixelW: asset.pixelWidth,
            pixelH: asset.pixelHeight,
            isFavorite: asset.isFavorite,
            isHidden: asset.isHidden,
            hasAdjustments: asset.hasAdjustments,
            estBytes: estimatedBytes(for: asset)
        )
        try store.upsertLibraryAsset(upsert, seenAt: now)
    }

    /// docs/CONTEXT.md §7.1: "First run: fetch all assets... store them in
    /// library_assets, and save the PHPersistentChangeToken. Later runs:
    /// fetchPersistentChanges(since:)... apply inserts, updates, and deletes. Fall
    /// back to a full re-fetch if the token has expired."
    private static func performSync() throws -> SyncResult {
        let store = try IndexStore(path: indexStorePath())
        let deviceId = DeviceIdentity.stableId()
        let now = Int64(Date().timeIntervalSince1970)
        let library = PHPhotoLibrary.shared()

        if let encoded = try store.getMeta(metaChangeTokenKey), let token = decodeToken(encoded) {
            do {
                let fetchResult = try library.fetchPersistentChanges(since: token)
                var insertedIds = Set<String>()
                var updatedIds = Set<String>()
                var deletedIds = Set<String>()
                for change in fetchResult {
                    guard let details = try? change.changeDetails(for: .asset) else { continue }
                    insertedIds.formUnion(details.insertedLocalIdentifiers)
                    updatedIds.formUnion(details.updatedLocalIdentifiers)
                    deletedIds.formUnion(details.deletedLocalIdentifiers)
                }

                let toFetch = insertedIds.union(updatedIds)
                if !toFetch.isEmpty {
                    let assets = PHAsset.fetchAssets(withLocalIdentifiers: Array(toFetch), options: nil)
                    assets.enumerateObjects { asset, _, _ in
                        try? upsert(asset, into: store, deviceId: deviceId, now: now)
                    }
                }
                for id in deletedIds {
                    try store.markLibraryAssetRemoved(localId: id, removedAt: now)
                }

                try store.setMeta(metaChangeTokenKey, encodeToken(library.currentChangeToken))
                return SyncResult(added: insertedIds.count, changed: updatedIds.count, removed: deletedIds.count)
            } catch {
                // docs/CONTEXT.md §7.1: token expired or otherwise unusable -> full re-fetch.
                return try fullSync(store: store, deviceId: deviceId, now: now, library: library)
            }
        }

        return try fullSync(store: store, deviceId: deviceId, now: now, library: library)
    }

    private static func fullSync(store: IndexStore, deviceId: String, now: Int64, library: PHPhotoLibrary) throws -> SyncResult {
        let all = PHAsset.fetchAssets(with: nil)
        all.enumerateObjects { asset, _, _ in
            try? upsert(asset, into: store, deviceId: deviceId, now: now)
        }
        try store.setMeta(metaChangeTokenKey, encodeToken(library.currentChangeToken))
        return SyncResult(added: all.count, changed: 0, removed: 0)
    }
}
