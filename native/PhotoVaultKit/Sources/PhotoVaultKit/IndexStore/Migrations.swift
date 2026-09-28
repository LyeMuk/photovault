import Foundation
import GRDB

/// The working-DB schema (docs/CONTEXT.md §6.1), applied with GRDB's
/// `DatabaseMigrator` so it can also rebuild the same schema from a drive snapshot
/// (§6: "the authoritative state on the drive... write a consistent snapshot").
/// Never edit a registered migration after it ships — add a new one instead, so a
/// newer app can always migrate an older Vault (agent rule, docs/CONTEXT.md §16.4
/// via the desktop spec's §10 note this project inherits: never break old Vaults).
public enum PhotoVaultMigrations {
    public static func migrator() -> DatabaseMigrator {
        var migrator = DatabaseMigrator()

        migrator.registerMigration("v1") { db in
            try db.execute(sql: """
                CREATE TABLE meta (
                  key TEXT PRIMARY KEY,
                  value TEXT
                );

                CREATE TABLE files (
                  id INTEGER PRIMARY KEY,
                  sha256 BLOB NOT NULL UNIQUE,
                  size_bytes INTEGER NOT NULL,
                  vault_rel_path TEXT NOT NULL UNIQUE,
                  original_filename TEXT NOT NULL,
                  uti TEXT,
                  kind TEXT NOT NULL,
                  role TEXT NOT NULL,
                  captured_at_utc INTEGER,
                  captured_at_local TEXT,
                  tz_offset_min INTEGER,
                  date_source TEXT,
                  date_confidence TEXT,
                  lat REAL, lon REAL,
                  country_code TEXT, country TEXT, admin1 TEXT, city TEXT,
                  make TEXT, model TEXT,
                  width INTEGER, height INTEGER, duration_ms INTEGER,
                  is_screenshot INTEGER DEFAULT 0,
                  is_favorite INTEGER DEFAULT 0,
                  group_id TEXT,
                  added_at INTEGER NOT NULL,
                  faces_status TEXT DEFAULT 'pending'
                );
                CREATE INDEX ix_files_date ON files(captured_at_local);
                CREATE INDEX ix_files_place ON files(country_code, admin1, city);
                CREATE INDEX ix_files_group ON files(group_id);

                CREATE TABLE library_assets (
                  local_id TEXT PRIMARY KEY,
                  device_id TEXT NOT NULL,
                  media_type TEXT, subtypes INTEGER, burst_id TEXT,
                  creation_date INTEGER, modification_date INTEGER,
                  lat REAL, lon REAL, duration_ms INTEGER, pixel_w INTEGER, pixel_h INTEGER,
                  is_favorite INTEGER, is_hidden INTEGER, source_type INTEGER,
                  has_adjustments INTEGER, in_icloud_only INTEGER,
                  est_bytes INTEGER,
                  backup_state TEXT DEFAULT 'none',
                  last_seen_at INTEGER, removed_from_library_at INTEGER
                );

                CREATE TABLE asset_files (
                  local_id TEXT NOT NULL,
                  device_id TEXT NOT NULL,
                  resource_role TEXT NOT NULL,
                  asset_mod_date INTEGER NOT NULL,
                  file_id INTEGER NOT NULL REFERENCES files(id),
                  backed_up_at INTEGER,
                  PRIMARY KEY (local_id, device_id, resource_role)
                );

                CREATE TABLE restored_assets (
                  local_id TEXT PRIMARY KEY,
                  device_id TEXT,
                  file_id INTEGER REFERENCES files(id),
                  restored_at INTEGER
                );

                CREATE TABLE tombstones (
                  sha256 BLOB PRIMARY KEY,
                  removed_at INTEGER,
                  reason TEXT
                );

                CREATE TABLE people (
                  id TEXT PRIMARY KEY,
                  name TEXT,
                  hidden INTEGER DEFAULT 0,
                  cover_face_id INTEGER
                );
                CREATE TABLE face_clusters (
                  id TEXT PRIMARY KEY,
                  person_id TEXT REFERENCES people(id),
                  centroid BLOB,
                  size INTEGER
                );
                CREATE TABLE faces (
                  id INTEGER PRIMARY KEY,
                  file_id INTEGER,
                  local_id TEXT,
                  bbox TEXT, landmarks TEXT, score REAL,
                  embedding BLOB,
                  cluster_id TEXT REFERENCES face_clusters(id),
                  manual INTEGER DEFAULT 0
                );
                CREATE TABLE face_negative (
                  face_id INTEGER,
                  person_id TEXT,
                  PRIMARY KEY (face_id, person_id)
                );

                CREATE TABLE devices (
                  id TEXT PRIMARY KEY,
                  name TEXT, model TEXT,
                  first_seen_at INTEGER, last_seen_at INTEGER
                );
                CREATE TABLE jobs (
                  id TEXT PRIMARY KEY,
                  type TEXT, status TEXT,
                  params_json TEXT, stats_json TEXT,
                  created_at INTEGER, updated_at INTEGER
                );
                CREATE TABLE job_items (
                  job_id TEXT, seq INTEGER,
                  local_id TEXT, role TEXT, sha256 BLOB, status TEXT, error TEXT,
                  PRIMARY KEY (job_id, seq)
                );
                CREATE TABLE deletion_log (
                  id INTEGER PRIMARY KEY,
                  at INTEGER, local_id TEXT, sha256s TEXT, result TEXT, error TEXT
                );
                """)

            // Unifies library_assets and files the way the TS layer's flat
            // AssetSummary does (docs/CONTEXT.md §9's Filter has `scope:
            // 'library'|'vault'|'both'`) — see FilterCompiler.swift. Pre-backup
            // date/location filtering against library_assets' own creation_date/
            // lat/lon works today (see docs/CONTEXT.md §9: "Location for library
            // assets comes from PHAsset.location... location filters work before
            // backup"); captured_at_local specifically is populated only once
            // DateResolver has run at backup time — filtering library-only items
            // by date needs a device-timezone-aware wall-clock computed from
            // creation_date, which is Phase 1 metadata-layer work, not modeled here.
            try db.execute(sql: """
                CREATE VIEW v_assets AS
                SELECT
                  la.local_id AS local_id,
                  f.id AS file_id,
                  la.device_id AS device_id,
                  COALESCE(f.kind, CASE la.media_type WHEN 'video' THEN 'video' ELSE 'photo' END) AS kind,
                  f.role AS role,
                  f.group_id AS group_id,
                  COALESCE(f.is_favorite, la.is_favorite, 0) AS is_favorite,
                  COALESCE(f.is_screenshot, 0) AS is_screenshot,
                  f.captured_at_local AS captured_at_local,
                  COALESCE(f.lat, la.lat) AS lat,
                  COALESCE(f.lon, la.lon) AS lon,
                  f.country_code AS country_code,
                  f.city AS city,
                  COALESCE(f.size_bytes, la.est_bytes) AS size_bytes,
                  CASE
                    WHEN la.removed_from_library_at IS NOT NULL THEN 'removed_from_iphone'
                    WHEN la.in_icloud_only = 1 THEN 'icloud_only'
                    WHEN la.backup_state = 'full' THEN 'backed_up'
                    WHEN la.backup_state = 'partial' THEN 'partial'
                    ELSE 'not_backed_up'
                  END AS status
                FROM library_assets la
                LEFT JOIN asset_files af
                  ON af.local_id = la.local_id AND af.device_id = la.device_id AND af.resource_role = 'original'
                LEFT JOIN files f ON f.id = af.file_id

                UNION ALL

                SELECT
                  NULL AS local_id,
                  f.id AS file_id,
                  NULL AS device_id,
                  f.kind AS kind,
                  f.role AS role,
                  f.group_id AS group_id,
                  f.is_favorite AS is_favorite,
                  f.is_screenshot AS is_screenshot,
                  f.captured_at_local AS captured_at_local,
                  f.lat AS lat,
                  f.lon AS lon,
                  f.country_code AS country_code,
                  f.city AS city,
                  f.size_bytes AS size_bytes,
                  'backed_up' AS status
                FROM files f
                WHERE NOT EXISTS (SELECT 1 FROM asset_files af WHERE af.file_id = f.id);
                """)
        }

        return migrator
    }
}
