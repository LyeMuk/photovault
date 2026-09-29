import Capacitor
import Foundation
import Photos
import PhotosUI // presentLimitedLibraryPicker lives here, not in Photos itself

/// The real PhotoKit-backed implementation of the `PhotoLibraryPlugin` interface
/// declared in apps/web/src/plugins/photoLibrary.ts — Capacitor prefers this over
/// the web mock automatically on-device (registered in MainViewController.swift).
///
/// Scope note: this covers requestAuthorization/presentLimitedLibraryPicker/
/// getLibrarySummary/syncLibrary/queryAssets against the real Photos library
/// (docs/CONTEXT.md §7.1's `PHPersistentChangeToken`-based incremental sync and
/// persisting into PhotoVaultKit's IndexStore are not implemented yet — every
/// `syncLibrary` call re-fetches fresh rather than tracking real deltas, and
/// nothing is written to the SQLite schema yet). `bytesEstimate` is a heuristic
/// (no cheap, non-deprecated PhotoKit API gives exact file size without exporting
/// the resource) — real sizes come from the backup engine's actual export, later.
/// Thumbnails (`pv-thumb://`) are a separate piece (issue #12), not this one.
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
        // No PHPersistentChangeToken tracking or IndexStore persistence yet (see
        // the type-level doc comment) — this reports the current full count as
        // "added" every time, which is honest for a first run but not a real diff.
        DispatchQueue.global(qos: .userInitiated).async {
            let all = PHAsset.fetchAssets(with: nil)
            call.resolve(["added": all.count, "changed": 0, "removed": 0])
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
}
