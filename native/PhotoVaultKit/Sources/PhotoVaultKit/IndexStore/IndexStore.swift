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
}
