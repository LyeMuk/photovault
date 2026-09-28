import Foundation

/// Mirrors `MediaKind` in apps/web/src/plugins/types.ts — keep both in sync.
public enum MediaKind: String, Codable, CaseIterable, Sendable {
    case photo, video, live, screenshot, favorite, edited
}

/// Mirrors `BackupStatus` in apps/web/src/plugins/types.ts.
public enum BackupStatus: String, Codable, CaseIterable, Sendable {
    case backedUp = "backed_up"
    case notBackedUp = "not_backed_up"
    case partial
    case icloudOnly = "icloud_only"
    case removedFromIphone = "removed_from_iphone"
}

/// Mirrors `DateConfidence` in apps/web/src/plugins/types.ts.
public enum DateConfidence: String, Codable, CaseIterable, Sendable {
    case high, medium, low
}

/// docs/CONTEXT.md §7.2 / the `files.date_source` column in §6.1, adapted to this
/// app's actual sources: PhotoKit gives a reliable `creationDate` directly (there is
/// no separate "EXIF vs QuickTime vs XMP" scan needed the way there was for the
/// desktop/ExifTool spec this replaced), so EXIF is only consulted for its precise
/// UTC offset and as a cross-check.
public enum DateSource: String, Codable, CaseIterable, Sendable {
    case exifOffset = "exif_offset"
    case photoKitDate = "photokit_date"
    case filename
    case fileModificationTime = "file_mtime"
}

/// One resource role of a `PHAsset` (docs/CONTEXT.md §6.1 `asset_files.resource_role`
/// / §7.2). A Live Photo backs up as `original` + `liveMotion`; an edited asset also
/// backs up an `edited` rendition.
public enum ResourceRole: String, Codable, CaseIterable, Sendable {
    case original
    case edited
    case liveMotion = "live_motion"
    case sidecar
}
