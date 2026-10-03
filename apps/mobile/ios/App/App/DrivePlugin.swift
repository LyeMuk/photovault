import Capacitor
import Foundation
import PhotoVaultKit
import UIKit
import UniformTypeIdentifiers

/// The real implementation of the `DrivePlugin` interface declared in
/// apps/web/src/plugins/drive.ts, backed by `UIDocumentPickerViewController` and a
/// security-scoped bookmark — the only way iOS lets an app touch a user-chosen
/// folder (docs/CONTEXT.md §5.1: "Only through the document picker... The app
/// keeps a security-scoped bookmark").
///
/// **What's verified and what isn't (see docs/DECISIONS.md):** the Simulator's
/// document picker browses the host Mac's filesystem, so the picker flow, bookmark
/// persistence, and vault file creation are all real and testable there. What
/// Simulator *cannot* exercise is the acceptance path for a genuinely external/
/// removable volume — every folder the Simulator can pick lives on the Mac's
/// internal disk, so `volumeIsInternal`/`volumeIsRemovable` only ever report
/// "internal." That makes the *rejection* logic (§5.1: reject internal storage,
/// iCloud Drive, NTFS) the only path provable without a physical iPhone + USB
/// drive — issues #13/#14's acceptance path waits for that hardware.
@objc(DrivePlugin)
public class DrivePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "DrivePlugin"
    public let jsName = "Drive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickDrive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDrive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "initVault", returnType: CAPPluginReturnPromise),
    ]

    private static let bookmarkDefaultsKey = "photovault.drive.bookmark"

    private var pendingCall: CAPPluginCall?

    // MARK: - pickDrive

    @objc func pickDrive(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("No view controller available to present the picker from")
                return
            }
            self.pendingCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.delegate = self
            picker.allowsMultipleSelection = false
            viewController.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        guard let url = urls.first else {
            call.reject("No folder was selected")
            return
        }

        do {
            let info = try Self.validateAndDescribe(url)
            try Self.saveBookmark(for: url)
            call.resolve(info)
        } catch let error as DriveValidationError {
            call.reject(error.message, error.code)
        } catch {
            call.reject("Could not read the selected drive: \(error.localizedDescription)")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingCall?.reject("Cancelled", "CANCELLED")
        pendingCall = nil
    }

    // MARK: - getDrive

    @objc func getDrive(_ call: CAPPluginCall) {
        guard let url = Self.resolveBookmark() else {
            call.resolve(["connected": false])
            return
        }
        guard url.startAccessingSecurityScopedResource() else {
            call.resolve(["connected": false])
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        do {
            var info = try Self.describe(url)
            info["vaultId"] = Self.readVaultId(at: url)
            call.resolve(info)
        } catch {
            call.resolve(["connected": false])
        }
    }

    // MARK: - initVault

    /// docs/CONTEXT.md §5.2: creates `.photovault/{vault.json, index.sqlite,
    /// manifest/, index-backups/, tmp/, quarantine/, thumbs/}` and `PhotoVault/`
    /// inside the chosen folder. Re-running against an already-initialized vault
    /// reuses its existing `vault_id` rather than minting a new one.
    @objc func initVault(_ call: CAPPluginCall) {
        let layoutTemplate = call.getString("layoutTemplate") ?? PathTemplate.defaultTemplate

        guard let url = Self.resolveBookmark() else {
            call.reject("No drive selected — call pickDrive first")
            return
        }
        guard url.startAccessingSecurityScopedResource() else {
            call.reject("Could not access the drive")
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        do {
            let photovaultDir = url.appendingPathComponent(".photovault", isDirectory: true)
            try FileManager.default.createDirectory(at: photovaultDir, withIntermediateDirectories: true)
            for sub in ["manifest", "index-backups", "tmp", "quarantine", "thumbs"] {
                try FileManager.default.createDirectory(
                    at: photovaultDir.appendingPathComponent(sub, isDirectory: true),
                    withIntermediateDirectories: true
                )
            }
            try FileManager.default.createDirectory(
                at: url.appendingPathComponent("PhotoVault", isDirectory: true),
                withIntermediateDirectories: true
            )

            let (vaultId, createdAt) = try Self.loadOrCreateVaultJSON(
                at: photovaultDir.appendingPathComponent("vault.json"),
                layoutTemplate: layoutTemplate
            )

            // The working IndexStore now lives at the real vault location, not the
            // interim Application-Support path PhotoLibraryPlugin's syncLibrary
            // uses pre-vault (docs/DECISIONS.md 0010) — reconciling the two is
            // noted there as Phase 2 follow-up.
            let store = try IndexStore(path: photovaultDir.appendingPathComponent("index.sqlite").path)
            try store.setMeta("vault_id", vaultId)

            call.resolve([
                "vaultId": vaultId,
                "layoutTemplate": layoutTemplate,
                "createdAt": createdAt,
                "itemCount": 0,
                "totalBytes": 0,
            ])
        } catch {
            call.reject("Failed to initialize the vault: \(error.localizedDescription)")
        }
    }

    // MARK: - Validation & description

    private struct DriveValidationError: Error {
        let message: String
        let code: String
        init(_ message: String, _ code: String) {
            self.message = message
            self.code = code
        }
    }

    /// Rejects what docs/CONTEXT.md §5.1 says to reject (internal storage, iCloud
    /// Drive, NTFS) and describes what's left. This rejection path is the one
    /// provable in Simulator (see the type-level doc comment); format detection
    /// for a genuine external drive is written to spec but unverified until a
    /// physical device is available.
    private static func validateAndDescribe(_ url: URL) throws -> [String: Any] {
        guard url.startAccessingSecurityScopedResource() else {
            throw DriveValidationError("Could not access the selected folder.", "ACCESS_DENIED")
        }
        defer { url.stopAccessingSecurityScopedResource() }

        let values = try url.resourceValues(forKeys: [
            .volumeIsInternalKey, .volumeIsRemovableKey, .volumeIsEjectableKey,
            .volumeLocalizedFormatDescriptionKey, .volumeAvailableCapacityForImportantUsageKey,
            .volumeTotalCapacityKey, .volumeNameKey, .isUbiquitousItemKey,
        ])

        if values.isUbiquitousItem == true {
            throw DriveValidationError("Please choose a folder on your USB drive, not iCloud Drive.", "ICLOUD_REJECTED")
        }
        if values.volumeIsInternal == true {
            throw DriveValidationError("Please choose a folder on your USB drive, not on this iPhone.", "INTERNAL_REJECTED")
        }

        let format = formatString(from: values.volumeLocalizedFormatDescription)
        if format == "ntfs" {
            throw DriveValidationError(
                "This drive is formatted NTFS, which iPhone can't write to. Reformat it as exFAT.",
                "NTFS_REJECTED"
            )
        }

        return try describe(url, resourceValues: values)
    }

    private static func describe(_ url: URL, resourceValues: URLResourceValues? = nil) throws -> [String: Any] {
        let values = try resourceValues ?? url.resourceValues(forKeys: [
            .volumeIsRemovableKey, .volumeLocalizedFormatDescriptionKey,
            .volumeAvailableCapacityForImportantUsageKey, .volumeTotalCapacityKey, .volumeNameKey,
        ])
        return [
            "name": values.volumeName ?? url.lastPathComponent,
            "format": formatString(from: values.volumeLocalizedFormatDescription),
            "isRemovable": values.volumeIsRemovable ?? false,
            "freeBytes": values.volumeAvailableCapacityForImportantUsage ?? 0,
            "totalBytes": values.volumeTotalCapacity ?? 0,
            "connected": true,
        ]
    }

    private static func formatString(from localizedDescription: String?) -> String {
        let description = (localizedDescription ?? "").lowercased()
        if description.contains("exfat") { return "exfat" }
        if description.contains("apfs") { return "apfs" }
        if description.contains("fat32") || description.contains("ms-dos") { return "fat32" }
        if description.contains("ntfs") { return "ntfs" }
        if description.contains("hfs") { return "hfsplus" }
        return "unknown"
    }

    // MARK: - vault.json

    private static func loadOrCreateVaultJSON(at path: URL, layoutTemplate: String) throws -> (vaultId: String, createdAt: String) {
        if FileManager.default.fileExists(atPath: path.path),
            let data = try? Data(contentsOf: path),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let existingId = json["vault_id"] as? String
        {
            let createdAt = json["created_at"] as? String ?? ISO8601DateFormatter().string(from: Date())
            return (existingId, createdAt)
        }

        let vaultId = UUID().uuidString
        let createdAt = ISO8601DateFormatter().string(from: Date())
        let json: [String: Any] = [
            "vault_id": vaultId,
            "created_at": createdAt,
            "schema_version": 1,
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0",
            "layout_template": layoutTemplate,
        ]
        let data = try JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted])
        try data.write(to: path)
        return (vaultId, createdAt)
    }

    private static func readVaultId(at driveURL: URL) -> String? {
        let path = driveURL.appendingPathComponent(".photovault/vault.json")
        guard let data = try? Data(contentsOf: path),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return json["vault_id"] as? String
    }

    // MARK: - Security-scoped bookmark

    private static func saveBookmark(for url: URL) throws {
        guard url.startAccessingSecurityScopedResource() else {
            throw DriveValidationError("Could not access the selected folder.", "ACCESS_DENIED")
        }
        defer { url.stopAccessingSecurityScopedResource() }
        let data = try url.bookmarkData()
        UserDefaults.standard.set(data, forKey: bookmarkDefaultsKey)
    }

    /// docs/CONTEXT.md §5.1: "When it goes stale... resolve it again, or ask the
    /// user to re-pick." We don't yet surface the "ask to re-pick" UX (Phase 1+
    /// polish) — a stale bookmark just makes getDrive report not-connected, which
    /// the UI already handles.
    private static func resolveBookmark() -> URL? {
        guard let data = UserDefaults.standard.data(forKey: bookmarkDefaultsKey) else { return nil }
        var isStale = false
        guard let url = try? URL(resolvingBookmarkData: data, bookmarkDataIsStale: &isStale) else { return nil }
        return url
    }
}
