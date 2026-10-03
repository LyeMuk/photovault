import Foundation
import GRDB

/// The working DB (docs/CONTEXT.md §6): "Application Support/PhotoVault/
/// <vault_id>.sqlite (GRDB, WAL). All queries run here." This wraps a
/// `DatabaseQueue`, applies `PhotoVaultMigrations`, and is the one place
/// `FilterCompiler`'s output actually gets executed.
public final class IndexStore {
    public let dbQueue: DatabaseQueue

    public init(path: String) throws {
        var config = Configuration()
        config.foreignKeysEnabled = true
        dbQueue = try DatabaseQueue(path: path, configuration: config)
        try PhotoVaultMigrations.migrator().migrate(dbQueue)
    }

    /// An in-memory store for tests and the demo — never used for a real Vault.
    public static func inMemory() throws -> IndexStore {
        try IndexStore(path: ":memory:")
    }

    public struct AssetRow {
        public let fileId: Int64?
        public let localId: String?
        public let kind: String
        public let status: String
        public let isFavorite: Bool
        public let capturedAtLocal: String?
        public let sizeBytes: Int?
    }

    /// Runs a compiled `Filter` against `v_assets` and returns the count + total
    /// bytes — the same shape the Backup/Restore/Delete preview screens need
    /// (docs/CONTEXT.md §9: "Every screen shows a live count and size").
    public func previewCount(matching filter: Filter, now: Date = Date()) throws -> (count: Int, bytes: Int) {
        let compiled = FilterCompiler.compile(filter, now: now)
        return try dbQueue.read { db in
            let sql = "SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes FROM v_assets WHERE \(compiled.whereClause)"
            let row = try Row.fetchOne(db, sql: sql, arguments: compiled.arguments)!
            return (count: row["count"], bytes: row["bytes"])
        }
    }

    public func queryAssets(matching filter: Filter, now: Date = Date()) throws -> [AssetRow] {
        let compiled = FilterCompiler.compile(filter, now: now)
        return try dbQueue.read { db in
            let sql = "SELECT * FROM v_assets WHERE \(compiled.whereClause) ORDER BY captured_at_local DESC"
            return try Row.fetchAll(db, sql: sql, arguments: compiled.arguments).map { row in
                AssetRow(
                    fileId: row["file_id"],
                    localId: row["local_id"],
                    kind: row["kind"],
                    status: row["status"],
                    isFavorite: (row["is_favorite"] as Int? ?? 0) == 1,
                    capturedAtLocal: row["captured_at_local"],
                    sizeBytes: row["size_bytes"]
                )
            }
        }
    }

    // MARK: - library_assets (docs/CONTEXT.md §7.1 library sync)

    /// Everything `syncLibrary` (the PhotoKit-backed plugin, native/CapacitorPlugins
    /// — actually `apps/mobile/ios/App/App/PhotoLibraryPlugin.swift`, since it's
    /// embedded directly in the app target) knows about one `PHAsset`. Kept
    /// PhotoKit-agnostic (plain Swift types only) so this struct and the upsert
    /// logic below are testable without PhotoKit.
    public struct LibraryAssetUpsert: Sendable {
        public let localId: String
        public let deviceId: String
        public let mediaType: String?
        public let creationDate: Int64? // epoch seconds
        public let modificationDate: Int64?
        public let lat: Double?
        public let lon: Double?
        public let durationMs: Int?
        public let pixelW: Int?
        public let pixelH: Int?
        public let isFavorite: Bool
        public let isHidden: Bool
        public let hasAdjustments: Bool
        public let estBytes: Int64?

        public init(
            localId: String,
            deviceId: String,
            mediaType: String?,
            creationDate: Int64?,
            modificationDate: Int64?,
            lat: Double? = nil,
            lon: Double? = nil,
            durationMs: Int? = nil,
            pixelW: Int? = nil,
            pixelH: Int? = nil,
            isFavorite: Bool = false,
            isHidden: Bool = false,
            hasAdjustments: Bool = false,
            estBytes: Int64? = nil
        ) {
            self.localId = localId
            self.deviceId = deviceId
            self.mediaType = mediaType
            self.creationDate = creationDate
            self.modificationDate = modificationDate
            self.lat = lat
            self.lon = lon
            self.durationMs = durationMs
            self.pixelW = pixelW
            self.pixelH = pixelH
            self.isFavorite = isFavorite
            self.isHidden = isHidden
            self.hasAdjustments = hasAdjustments
            self.estBytes = estBytes
        }
    }

    /// Inserts a new `library_assets` row or refreshes an existing one (keyed by
    /// `local_id`, the table's primary key) — insert path for `PHPersistentChange`
    /// `insertedLocalIdentifiers`, update path for `updatedLocalIdentifiers`.
    /// Un-does a prior `markLibraryAssetRemoved` if the asset reappears.
    public func upsertLibraryAsset(_ asset: LibraryAssetUpsert, seenAt: Int64) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO library_assets (
                        local_id, device_id, media_type, creation_date, modification_date,
                        lat, lon, duration_ms, pixel_w, pixel_h,
                        is_favorite, is_hidden, has_adjustments, est_bytes,
                        backup_state, last_seen_at, removed_from_library_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', ?, NULL)
                    ON CONFLICT(local_id) DO UPDATE SET
                        device_id = excluded.device_id,
                        media_type = excluded.media_type,
                        creation_date = excluded.creation_date,
                        modification_date = excluded.modification_date,
                        lat = excluded.lat,
                        lon = excluded.lon,
                        duration_ms = excluded.duration_ms,
                        pixel_w = excluded.pixel_w,
                        pixel_h = excluded.pixel_h,
                        is_favorite = excluded.is_favorite,
                        is_hidden = excluded.is_hidden,
                        has_adjustments = excluded.has_adjustments,
                        est_bytes = excluded.est_bytes,
                        last_seen_at = excluded.last_seen_at,
                        removed_from_library_at = NULL
                    """,
                arguments: [
                    asset.localId, asset.deviceId, asset.mediaType, asset.creationDate, asset.modificationDate,
                    asset.lat, asset.lon, asset.durationMs, asset.pixelW, asset.pixelH,
                    asset.isFavorite, asset.isHidden, asset.hasAdjustments, asset.estBytes,
                    seenAt,
                ]
            )
        }
    }

    /// For `PHPersistentChange.deletedLocalIdentifiers` — the row stays (so
    /// `asset_files`/`restored_assets` foreign-key history isn't lost) but is
    /// marked removed, matching `library_assets.removed_from_library_at` in the
    /// schema (docs/CONTEXT.md §6.1).
    public func markLibraryAssetRemoved(localId: String, removedAt: Int64) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE library_assets SET removed_from_library_at = ? WHERE local_id = ?",
                arguments: [removedAt, localId]
            )
        }
    }

    public func getMeta(_ key: String) throws -> String? {
        try dbQueue.read { db in
            try String.fetchOne(db, sql: "SELECT value FROM meta WHERE key = ?", arguments: [key])
        }
    }

    public func setMeta(_ key: String, _ value: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                arguments: [key, value]
            )
        }
    }

    public func countLibraryAssets() throws -> Int {
        try dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM library_assets WHERE removed_from_library_at IS NULL") ?? 0
        }
    }
}
