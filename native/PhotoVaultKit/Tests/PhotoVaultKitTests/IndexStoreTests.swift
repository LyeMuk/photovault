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
}
