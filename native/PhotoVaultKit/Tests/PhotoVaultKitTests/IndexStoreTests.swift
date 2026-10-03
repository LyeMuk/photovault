import Testing
import GRDB
@testable import PhotoVaultKit
import Foundation

@Suite struct IndexStoreTests {
    @Test func migrationsApplyCleanlyToAFreshDatabase() throws {
        let store = try IndexStore.inMemory()
        let tableExists = try store.dbQueue.read { db in
            try db.tableExists("files") && db.tableExists("library_assets") && db.tableExists("faces")
        }
        #expect(tableExists)
    }

    /// docs/CONTEXT.md §7.2's one-copy invariant: "for every SHA-256, at most one
    /// file exists... and files.sha256 is UNIQUE." This is the DB-level backstop
    /// for it — a second insert with the same hash must fail, exactly as §7.1's
    /// "on UNIQUE violation (race with a parallel worker)" branch expects.
    @Test func filesTableRejectsDuplicateSha256() throws {
        let store = try IndexStore.inMemory()
        let sha256 = Data(repeating: 0xAB, count: 32)

        try store.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO files (sha256, size_bytes, vault_rel_path, original_filename, kind, role, added_at)
                    VALUES (?, 100, 'PhotoVault/2024/05-May/a.jpg', 'a.jpg', 'photo', 'original', 0)
                    """,
                arguments: [sha256]
            )
        }

        do {
            try store.dbQueue.write { db in
                try db.execute(
                    sql: """
                        INSERT INTO files (sha256, size_bytes, vault_rel_path, original_filename, kind, role, added_at)
                        VALUES (?, 100, 'PhotoVault/2024/05-May/b.jpg', 'b.jpg', 'photo', 'original', 0)
                        """,
                    arguments: [sha256]
                )
            }
            Issue.record("Expected inserting a duplicate sha256 to throw a UNIQUE constraint violation")
        } catch let error as DatabaseError {
            #expect(error.resultCode == .SQLITE_CONSTRAINT)
        }
    }

    @Test func vAssetsUnifiesBackedUpAndNotYetBackedUpItems() throws {
        let store = try IndexStore.inMemory()

        try store.dbQueue.write { db in
            // A file already on the drive, linked to a library asset (backed up).
            try db.execute(sql: """
                INSERT INTO files (id, sha256, size_bytes, vault_rel_path, original_filename, kind, role, is_favorite, captured_at_local, added_at)
                VALUES (1, X'01', 5000000, 'PhotoVault/2024/05-May/a.heic', 'a.heic', 'photo', 'original', 1, '2024-05-14T10:00:00', 0)
                """)
            try db.execute(sql: """
                INSERT INTO library_assets (local_id, device_id, media_type, backup_state)
                VALUES ('asset-1', 'device-1', 'photo', 'full')
                """)
            try db.execute(sql: """
                INSERT INTO asset_files (local_id, device_id, resource_role, asset_mod_date, file_id)
                VALUES ('asset-1', 'device-1', 'original', 0, 1)
                """)

            // A library asset not yet backed up (no files/asset_files row).
            try db.execute(sql: """
                INSERT INTO library_assets (local_id, device_id, media_type, backup_state, is_favorite)
                VALUES ('asset-2', 'device-1', 'video', 'none', 0)
                """)
        }

        let all = try store.queryAssets(matching: Filter())
        #expect(all.count == 2)

        let backedUp = try store.previewCount(matching: Filter(status: [.backedUp]))
        #expect(backedUp.count == 1)
        #expect(backedUp.bytes == 5_000_000)

        let notBackedUp = try store.previewCount(matching: Filter(status: [.notBackedUp]))
        #expect(notBackedUp.count == 1)

        let favorites = try store.previewCount(matching: Filter(kind: [.favorite]))
        #expect(favorites.count == 1)
    }

    @Test func dateFilterYearsAndMonths() throws {
        let store = try IndexStore.inMemory()
        try store.dbQueue.write { db in
            for (id, date) in [(1, "2022-12-25T00:00:00"), (2, "2023-12-25T00:00:00"), (3, "2023-01-25T00:00:00")] {
                try db.execute(sql: """
                    INSERT INTO files (id, sha256, size_bytes, vault_rel_path, original_filename, kind, role, captured_at_local, added_at)
                    VALUES (?, ?, 100, ?, 'x.jpg', 'photo', 'original', ?, 0)
                    """, arguments: [id, Data([UInt8(id)]), "PhotoVault/x\(id).jpg", date])
            }
        }

        let decembers = try store.previewCount(matching: Filter(date: .init(months: [12])))
        #expect(decembers.count == 2)
    }

    // MARK: - library_assets upsert / meta (docs/CONTEXT.md §7.1 library sync)

    @Test func upsertLibraryAssetInsertsThenUpdatesInPlace() throws {
        let store = try IndexStore.inMemory()
        let asset = IndexStore.LibraryAssetUpsert(
            localId: "asset-1", deviceId: "device-1", mediaType: "photo",
            creationDate: 1_700_000_000, modificationDate: 1_700_000_000,
            isFavorite: false
        )
        try store.upsertLibraryAsset(asset, seenAt: 1_700_000_100)
        #expect(try store.countLibraryAssets() == 1)

        // Re-upserting the same local_id updates the row rather than duplicating it,
        // and un-marks a prior removal (simulates PHPersistentChange's updatedLocalIdentifiers).
        let updated = IndexStore.LibraryAssetUpsert(
            localId: "asset-1", deviceId: "device-1", mediaType: "photo",
            creationDate: 1_700_000_000, modificationDate: 1_700_000_500,
            isFavorite: true
        )
        try store.upsertLibraryAsset(updated, seenAt: 1_700_000_600)
        #expect(try store.countLibraryAssets() == 1)

        let row = try store.dbQueue.read { db in
            try Row.fetchOne(db, sql: "SELECT is_favorite, modification_date FROM library_assets WHERE local_id = ?", arguments: ["asset-1"])
        }
        #expect((row?["is_favorite"] as Int?) == 1)
        #expect((row?["modification_date"] as Int64?) == 1_700_000_500)
    }

    @Test func markLibraryAssetRemovedExcludesFromCountButKeepsTheRow() throws {
        let store = try IndexStore.inMemory()
        let asset = IndexStore.LibraryAssetUpsert(
            localId: "asset-1", deviceId: "device-1", mediaType: "photo",
            creationDate: nil, modificationDate: nil
        )
        try store.upsertLibraryAsset(asset, seenAt: 100)
        #expect(try store.countLibraryAssets() == 1)

        try store.markLibraryAssetRemoved(localId: "asset-1", removedAt: 200)
        #expect(try store.countLibraryAssets() == 0)

        let stillThere = try store.dbQueue.read { db in
            try Bool.fetchOne(db, sql: "SELECT EXISTS(SELECT 1 FROM library_assets WHERE local_id = ?)", arguments: ["asset-1"])
        }
        #expect(stillThere == true)

        // A later re-upsert (the asset came back — e.g. undo) un-marks the removal.
        try store.upsertLibraryAsset(asset, seenAt: 300)
        #expect(try store.countLibraryAssets() == 1)
    }

    @Test func metaGetSetRoundTrips() throws {
        let store = try IndexStore.inMemory()
        #expect(try store.getMeta("last_change_token") == nil)

        try store.setMeta("last_change_token", "token-v1")
        #expect(try store.getMeta("last_change_token") == "token-v1")

        try store.setMeta("last_change_token", "token-v2")
        #expect(try store.getMeta("last_change_token") == "token-v2")
    }
}
