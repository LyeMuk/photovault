# PhotoVault (iPhone edition) — Agent Context & Build Specification

> **Purpose of this file:** This is the single source of truth for an AI coding agent that will design, build, test, and ship PhotoVault. Read it fully before writing code. When something here conflicts with your own assumptions, this file wins. When something is not covered, choose the safest option for the user's photos, then record the decision in `docs/DECISIONS.md`.
>
> **Version 2 of this spec.** It **replaces** the earlier desktop/Tauri spec entirely. iPhone is the only v1 platform.

---

## 0. TL;DR for the agent

PhotoVault is a **privacy-first iPhone app with a web-technology UI** that backs up the iPhone's photos and videos onto an **external drive plugged directly into the iPhone** (USB-C, or Lightning via Apple's USB 3 Camera Adapter). No laptop and no cloud are involved.

It is built as a **web app (React + Bootstrap/Tabler) running inside a native iOS shell (Capacitor)**. Custom **Swift plugins** do everything Safari cannot do: read the full Photos library, export original files, write to the external drive, detect faces, and delete from the library.

It must:
1. **Read the whole Photos library** (every photo, video, Live Photo, screenshot, and burst) and show it in a gallery, marked "backed up" or "not backed up".
2. **Back up** selected or filtered items to the drive in a clean `Year/Month` folder structure, **original files, byte for byte**.
3. Guarantee **exactly one copy of any file on the drive** (SHA-256 of content), however many times the backup runs.
4. **Filter** by date, month, year, location, person (on-device face grouping), media type, and album.
5. **Restore** systematically — "last 1 year", "from Goa", "photos of Mom" — back into the Photos app or into a Files folder.
6. **Free up space**: delete already-backed-up items from the iPhone, but only after re-verifying the drive copy. Deleted items go to the iPhone's **Recently Deleted** album (recoverable for 30 days).

There is **no backend**. No photo, thumbnail, face data, or metadata leaves the phone and the drive. "Deploy" means TestFlight and App Store builds, plus a static web demo site.

---

## 1. Product decisions already made (do not re-litigate)

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| D1 | Platform | **iPhone only in v1** (iOS 17+). The app runs on the iPhone, and the drive is attached to the iPhone. Desktop, Android, and iPad are v2+. | User priority. |
| D2 | Architecture | **Web UI (React + TS) inside Capacitor**, plus **custom Swift Capacitor plugins** for Photos, drive, faces, and the backup engine | The user wants a browser-technology app. Pure Safari cannot scan the library, write to USB drives reliably, preserve originals, or delete photos. Capacitor keeps the UI as web code while unlocking PhotoKit. |
| D3 | Heavy work location | **All file bytes stay in Swift.** JavaScript only sends commands and receives progress events and small JSON. Never pass photo bytes or base64 across the bridge. | The bridge is slow; base64 of videos would crash the WebView. |
| D4 | Duplicate definition | **Exact content match: SHA-256 of the exported file bytes** | Deterministic and safe. No near-duplicate merging in v1. |
| D5 | Drive layout | Physical layout is **date-based only**. Person, location, and album are **virtual views** from the index. | A photo with 3 people cannot live in 3 folders without breaking the one-copy rule. |
| D6 | Index | The **authoritative index lives on the drive** (`/.photovault/`); the app keeps a **working copy** in its sandbox (§6) | Dedup must survive app reinstalls and phone changes; SQLite directly on an external exFAT volume through iOS file coordination is not reliable. |
| D7 | Person filter | **On-device**: Vision face detection + a permissively licensed face-embedding model in Core ML + clustering. The user names clusters. | Apple's People album is not available to third-party apps. Privacy requires on-device processing. |
| D8 | Delete | Verify the drive copy (re-hash), then `PHAssetChangeRequest.deleteAssets` → iOS system confirmation → **Recently Deleted** (recoverable) | Safety. The app never empties Recently Deleted. |
| D9 | UI framework | **One open-source Bootstrap 5 template for all UI: Tabler (`@tabler/core`, MIT) + `react-bootstrap` + Tabler Icons** — mobile-first | A consistent look everywhere (§11). |
| D10 | Source control & demos | **Greenfield**: the agent creates the GitHub repo, commits and pushes all work, follows the branching model, and ships a **live web demo + TestFlight build + screen recording at the end of every phase** (§17) | User requirement. |

---

## 2. Users & core use cases

**Primary user:** a non-technical iPhone owner with thousands to tens of thousands of photos and videos. Their iPhone storage is full, and they want an organized, deduplicated archive on a USB SSD or pen drive they plug into the phone.

### 2.1 User stories (acceptance-level)

- **US-01 First run:** I install PhotoVault, grant **Full Access** to Photos, plug in my drive, and pick it once. The app remembers it. If I granted only *Limited* access, the app explains clearly what it can't see and how to change that.
- **US-02 See everything:** The gallery shows all my photos and videos grouped by month, with totals ("18,204 items · 96 GB · 4,310 not backed up · 21 GB").
- **US-03 Backup with filters:** I choose "everything", or a filter ("2023 only", "videos only", "taken in Kerala", "contains Mom"). I see the count and size, then tap **Back up**. Progress, speed, ETA, skipped duplicates, and errors update live.
- **US-04 Re-run safely:** I run the backup again tomorrow. Only new photos are copied. Nothing is ever copied twice, even if I renamed the drive, reinstalled the app, or restored photos earlier.
- **US-05 Messy drive:** My drive already has old photo folders with duplicates. PhotoVault indexes them and moves extra copies to a quarantine folder, so exactly one copy of each remains.
- **US-06 Free up space:** I choose "Remove backed-up items from iPhone" with a filter (default: backed up and older than 30 days). I see exactly what will be removed. The app re-verifies each drive copy, then iOS asks me to confirm, and the items go to Recently Deleted.
- **US-07 Restore:** I choose "last 1 year" / "from this place" / "with this person" / a date range, preview the result, and restore either **into the Photos app** (with original dates, location, and Live Photo motion) or **into a Files folder**.
- **US-08 People:** The app groups faces into clusters. I name them, merge or split them, and hide strangers. Person filters then work for backup, restore, and delete.
- **US-09 Places:** I see places grouped as Country → State → City, with counts, and can filter by them.
- **US-10 Other iPhone folders (optional):** I can also add a Files-app folder (e.g., "On My iPhone/WhatsApp exports") as an extra backup source.

### 2.2 Non-goals (v1)

- Mac, Windows, Android, iPad-optimized layouts (the app runs on iPad in compatibility mode only).
- Cloud backup or sync, accounts, logins, analytics.
- Editing photos; near-duplicate/similar-photo merging.
- Emptying Recently Deleted.
- Background backup while the app is closed (iOS does not allow long-running file copies in the background; see §7.6).

---

## 3. iOS platform facts the design depends on (verify on device, record in DECISIONS.md)

| Topic | Fact / constraint | Design response |
|-------|-------------------|-----------------|
| Drive connection | iPhone 15 and later: USB-C direct. Older iPhones: Lightning to USB 3 Camera Adapter, **with external power** for most drives. | Onboarding shows the right instructions per model (`UIDevice` model identifier). Warn that bus-powered HDDs may not get enough power; recommend an SSD or a powered hub. |
| Drive formats | iOS reads and writes **APFS, exFAT, FAT32, HFS+**. It does **not** write NTFS. | Detect the format; block NTFS with instructions; warn on FAT32 (4 GB file limit → long 4K videos fail). Recommend exFAT (works with Windows and Mac too) or APFS. |
| Drive access | Only through the document picker: the user picks a folder once (`UIDocumentPickerViewController`, `.folder`). The app keeps a **security-scoped bookmark**. | Store the bookmark. When it goes stale (drive re-plugged), resolve it again, or ask the user to re-pick with a one-tap flow. Identify the drive by the `vault_id` in `vault.json`, never by the path. |
| Photos access | PhotoKit with `.readWrite` authorization. *Limited* access shows only the selected items. | Require Full Access for backup-all. In Limited mode, work on the visible subset and show a banner linking to Settings. |
| Originals | `PHAssetResourceManager.writeData(for:toFile:)` exports the **exact original resource** (HEIC/JPEG/RAW/MOV, with all EXIF/GPS). | Always back up the original resource. Never go through `UIImage` or re-encode. |
| iCloud Photos "Optimize Storage" | Many originals are only in iCloud. PhotoKit can download them (`isNetworkAccessAllowed = true`) — slow and uses mobile data. | Setting: *Download originals from iCloud when needed* (default ON, **Wi-Fi only** ON). Show "Waiting for iCloud…" per item, with a retry queue. Report items that couldn't be fetched. |
| Edited photos | An edited asset has the original resource (`.photo`/`.video`) plus the rendered current version (`.fullSizePhoto`/`.fullSizeVideo`) and adjustment data. | Back up the **original**. If the asset is edited, also back up the **edited version** as `<name>_edited.<ext>`. Each file is deduplicated independently. |
| Live Photos | A still resource plus a `.pairedVideo` resource. | Back up both with the same basename (`IMG_1234.HEIC` + `IMG_1234.MOV`); restore them as one Live Photo. |
| Delete | `PHAssetChangeRequest.deleteAssets` always shows an iOS system confirmation, then the items move to Recently Deleted. | Our preview comes first, then the iOS dialog. Treat the user tapping "Don't Allow" as a normal cancel. |
| Restore into Photos | `PHAssetCreationRequest` + `addResource(with:fileURL:)` for the photo and paired video; set `creationDate` and `location`. Needs add permission. | Supported. Photos may alter bytes on import (§7.5). |
| Background execution | Foreground work only for large copies. Background time is seconds (`beginBackgroundTask`); `BGProcessingTask` runs only at the system's discretion (typically while charging and idle). | Backups run in the foreground with the screen kept awake (`isIdleTimerDisabled`). Jobs are resumable. Face analysis may use `BGProcessingTask` while charging. |
| People album | Apple's People/face data is **not accessible** to apps. | Do our own face pipeline (§8). |

---

## 4. Architecture

```
┌──────────────────────────────────────── iPhone ────────────────────────────────────────┐
│  PhotoVault.app (Capacitor)                                                            │
│  ┌──────────────────────────────┐   Capacitor bridge (JSON commands + events only)     │
│  │ WKWebView: React + TS + Vite │ ◄─────────────────────────────────────────────┐      │
│  │ Tabler / react-bootstrap UI  │   thumbnails via custom URL scheme            │      │
│  └──────────────────────────────┘   pv-thumb://<id>?s=256 (no base64)           │      │
│                                                                                 ▼      │
│  ┌──────────────────────────── Swift plugins (Swift Package: PhotoVaultKit) ───────┐   │
│  │ PhotoLibraryPlugin  – auth, enumerate, change tracking, export originals,       │   │
│  │                        thumbnails, delete, restore (PhotoKit)                   │   │
│  │ DrivePlugin         – pick folder, bookmarks, volume info, vault init, I/O      │   │
│  │ EnginePlugin        – job queue: backup / restore / cleanup / delete / reindex  │   │
│  │ IndexStore          – SQLite (GRDB) working DB + sync to drive                  │   │
│  │ MetadataService     – PhotoKit fields + ImageIO/AVFoundation EXIF, geocoder     │   │
│  │ FacesPlugin         – Vision detection + Core ML embeddings + clustering        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │ PhotoKit                                  │ security-scoped URL                │
│  ┌─────▼──────────────┐                     ┌──────▼───────────────────────────┐       │
│  │ Photos library     │                     │ External drive (USB-C/Lightning) │       │
│  │ (+ iCloud originals)│                    │  /.photovault/ + /PhotoVault/…   │       │
│  └────────────────────┘                     └──────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Tech stack

| Layer | Choice |
|-------|--------|
| Shell | **Capacitor** (latest stable major), iOS project in `apps/mobile/ios` (Xcode, Swift 5.9+ / Swift 6 language mode where possible) |
| UI | React 18 + TypeScript (strict) + Vite, TanStack Query, Zustand, `react-virtuoso` (virtualized grid), **`@tabler/core` + `react-bootstrap` + `@tabler/icons-react`**, i18next |
| Native core | Swift Package `PhotoVaultKit` (testable without the app): PhotoKit, ImageIO, AVFoundation, CryptoKit (SHA-256 streaming), **GRDB.swift** (SQLite), Vision, Core ML |
| Geocoder | Offline GeoNames `cities500` + admin1 + country tables, bundled as a compact binary with a k-d tree lookup (no network, no `CLGeocoder`) |
| Faces | Vision `VNDetectFaceRectanglesRequest` + landmarks → aligned crop → **SFace** (OpenCV Zoo, Apache-2.0) converted to Core ML → 128-d embedding → clustering in Swift |
| Web-demo mocks | Each plugin has a **TypeScript web implementation** (Capacitor `registerPlugin` web fallback) that uses synthetic data, so the same UI runs in any browser as the demo |

> ⚠️ **Licensing rule:** no InsightFace/ArcFace weights (non-commercial). Record every model and dataset license in `THIRD_PARTY_LICENSES.md`.

### 4.2 Plugin API (TypeScript contract — the web UI codes against this only)

```ts
// PhotoLibrary
requestAuthorization(): Promise<{ status: 'authorized'|'limited'|'denied'|'notDetermined' }>;
presentLimitedLibraryPicker(): Promise<void>;
getLibrarySummary(): Promise<{ total: number; photos: number; videos: number; bytesEstimate: number }>;
syncLibrary(): Promise<{ added: number; changed: number; removed: number }>;  // uses PHPersistentChangeToken
queryAssets(q: { filter: Filter; cursor?: string; limit: number; sort: 'newest'|'oldest' })
  : Promise<{ items: AssetSummary[]; nextCursor?: string; total: number; bytes: number }>;
thumbnailUrl(assetId: string, size: 128|256|512|1024): string;   // pv-thumb://… served by a WKURLSchemeHandler

// Drive
pickDrive(): Promise<DriveInfo>;              // document picker, stores bookmark
getDrive(): Promise<DriveInfo | null>;        // resolves bookmark, checks it is mounted
initVault(opts: { layoutTemplate: string }): Promise<VaultInfo>;

// Engine (all long-running work)
preview(req: { kind: 'backup'|'restore'|'delete'; filter: Filter }): Promise<PreviewResult>;
startJob(req: BackupReq | RestoreReq | CleanupReq | DeleteReq | ReindexReq | FacesReq): Promise<{ jobId: string }>;
pauseJob(id), resumeJob(id), cancelJob(id); listJobs(); getJobReport(id);
// events: 'jobProgress' {jobId, done, total, bytes, rate, eta, current}, 'jobItemError', 'jobFinished',
//         'driveConnected' / 'driveDisconnected', 'libraryChanged'

// Faces / People
listPeople(), listClusters(), nameCluster(id, name), mergeClusters(ids), splitFaces(faceIds),
rejectFace(faceId, personId), hideCluster(id), deleteAllFaceData();

// Places
listPlaces(): Promise<PlaceNode[]>;   // country → admin1 → city with counts
```

The web implementations (mocks) must satisfy the same interface and the same event shapes.

---

## 5. The Vault (external drive)

### 5.1 Picking and validating the drive

- Onboarding step: "Plug in your drive → tap **Choose drive** → in the picker, open your drive and tap **Open**" (with an illustration).
- After picking, read `URLResourceValues`: `volumeIsInternal`, `volumeIsRemovable`, `volumeIsEjectable`, `volumeLocalizedFormatDescription`, `volumeAvailableCapacityForImportantUsage` (or `volumeAvailableCapacity`), `volumeUUIDString`, `volumeName`, `isUbiquitousItem`.
- **Accept:** folders on an external/removable volume. **Reject** "On My iPhone", iCloud Drive, and third-party cloud providers (Google Drive, OneDrive, Dropbox) — show "Please choose a folder on your USB drive".
- Formats: exFAT / APFS / HFS+ OK; FAT32 with a warning; NTFS or read-only → block with help text.
- Free-space check before every job: planned bytes + 2% + 500 MB. Show the exact shortfall.

### 5.2 Vault structure

```
<picked folder>/
  .photovault/
    vault.json            # { vault_id (UUIDv4), created_at, schema_version, app_version, layout_template, volume_uuid }
    index.sqlite          # authoritative snapshot of the index (written by the app, see §6)
    manifest/             # append-only JSONL per job: one line per committed file (hash, path, metadata)
    index-backups/        # last 7 index snapshots
    tmp/                  # in-flight copies (*.part)
    quarantine/           # duplicates found by cleanup (30-day retention, user-confirmed purge)
    thumbs/               # optional small thumbnails for drive-only items
  PhotoVault/
    2024/05-May/IMG_1234.HEIC
    2024/05-May/IMG_1234.MOV          # Live Photo motion
    2024/05-May/IMG_1234_edited.HEIC  # edited rendition, if any
    Undated/…
```

### 5.3 Folder layout and names

- Default template: `PhotoVault/{YYYY}/{MM}-{MonthName}/{original_name}`; chosen at vault creation. Tokens: `{YYYY} {MM} {MonthName} {DD} {Kind}`. One physical path per file.
- The original name comes from `PHAssetResource.originalFilename`.
- Collision (same name, different bytes): append `_{first 8 hex chars of sha256}`.
- Sanitize for exFAT/FAT32: strip `<>:"/\|?*` and control characters, trim trailing dots and spaces, NFC-normalize, and keep paths under 255 bytes per component.
- Dates use the photo's **local capture time** (from EXIF `OffsetTimeOriginal`, otherwise `PHAsset.creationDate` in the device's time zone).

---

## 6. Index & data model

**Why two copies:** SQLite WAL and file locking on an external exFAT volume, accessed through a security-scoped URL, are not dependable. So:

- **Working DB:** `Application Support/PhotoVault/<vault_id>.sqlite` (GRDB, WAL). All queries run here.
- **Authoritative state on the drive:** after every committed batch (≤ 200 files or ≤ 30 s), append to `.photovault/manifest/<job_id>.jsonl`. At the end of each job (and every 5 minutes during long jobs), write a consistent snapshot (`VACUUM INTO` a temp file on the drive → fsync → atomic rename to `index.sqlite`).
- **On connecting a drive:** read `vault.json`. If the working DB for this `vault_id` is missing or older than the drive snapshot, rebuild it from `index.sqlite` + newer manifest lines. If both are missing but media exists → offer **Rebuild index from drive** (walk, hash, extract metadata).
- The one-copy rule is always checked against the working DB **after** it has been reconciled with the drive.

### 6.1 Schema (working DB and snapshot share it)

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);            -- schema_version, vault_id, last_change_token

CREATE TABLE files (                                             -- one row per unique content on the drive
  id INTEGER PRIMARY KEY,
  sha256 BLOB NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL,
  vault_rel_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  uti TEXT, kind TEXT NOT NULL,                                  -- photo | video
  role TEXT NOT NULL,                                            -- original | edited | live_motion | sidecar
  captured_at_utc INTEGER, captured_at_local TEXT, tz_offset_min INTEGER,
  date_source TEXT, date_confidence TEXT,                        -- exif|photokit|filename|filetime ; high|medium|low
  lat REAL, lon REAL, country_code TEXT, country TEXT, admin1 TEXT, city TEXT,
  make TEXT, model TEXT, width INTEGER, height INTEGER, duration_ms INTEGER,
  is_screenshot INTEGER DEFAULT 0, is_favorite INTEGER DEFAULT 0,
  group_id TEXT,                                                 -- ties original + edited + live motion of one asset
  added_at INTEGER NOT NULL,
  faces_status TEXT DEFAULT 'pending'
);
CREATE INDEX ix_files_date ON files(captured_at_local);
CREATE INDEX ix_files_place ON files(country_code, admin1, city);

CREATE TABLE library_assets (                                    -- mirror of the iPhone library (per device)
  local_id TEXT PRIMARY KEY,                                     -- PHAsset.localIdentifier
  device_id TEXT NOT NULL,
  media_type TEXT, subtypes INTEGER, burst_id TEXT,
  creation_date INTEGER, modification_date INTEGER,
  lat REAL, lon REAL, duration_ms INTEGER, pixel_w INTEGER, pixel_h INTEGER,
  is_favorite INTEGER, is_hidden INTEGER, source_type INTEGER,    -- userLibrary / cloudShared / itunesSynced
  has_adjustments INTEGER, in_icloud_only INTEGER,
  est_bytes INTEGER,
  backup_state TEXT DEFAULT 'none',                               -- none | partial | full
  last_seen_at INTEGER, removed_from_library_at INTEGER
);

CREATE TABLE asset_files (                                       -- which drive files came from which asset resource
  local_id TEXT NOT NULL, device_id TEXT NOT NULL,
  resource_role TEXT NOT NULL,                                    -- original | edited | live_motion
  asset_mod_date INTEGER NOT NULL,                                -- the fast-path key
  file_id INTEGER NOT NULL REFERENCES files(id),
  backed_up_at INTEGER,
  PRIMARY KEY (local_id, device_id, resource_role)
);

CREATE TABLE restored_assets (                                   -- assets created by restore → their source file hash
  local_id TEXT PRIMARY KEY, device_id TEXT, file_id INTEGER REFERENCES files(id), restored_at INTEGER
);

CREATE TABLE tombstones (sha256 BLOB PRIMARY KEY, removed_at INTEGER, reason TEXT);

CREATE TABLE people (id TEXT PRIMARY KEY, name TEXT, hidden INTEGER DEFAULT 0, cover_face_id INTEGER);
CREATE TABLE face_clusters (id TEXT PRIMARY KEY, person_id TEXT REFERENCES people(id), centroid BLOB, size INTEGER);
CREATE TABLE faces (id INTEGER PRIMARY KEY, file_id INTEGER, local_id TEXT, bbox TEXT, score REAL,
                    embedding BLOB, cluster_id TEXT, manual INTEGER DEFAULT 0);
CREATE TABLE face_negative (face_id INTEGER, person_id TEXT, PRIMARY KEY(face_id, person_id));

CREATE TABLE devices (id TEXT PRIMARY KEY, name TEXT, model TEXT, first_seen_at INTEGER, last_seen_at INTEGER);
CREATE TABLE jobs (id TEXT PRIMARY KEY, type TEXT, status TEXT, params_json TEXT, stats_json TEXT,
                   created_at INTEGER, updated_at INTEGER);
CREATE TABLE job_items (job_id TEXT, seq INTEGER, local_id TEXT, role TEXT, sha256 BLOB, status TEXT, error TEXT,
                        PRIMARY KEY(job_id, seq));
CREATE TABLE deletion_log (id INTEGER PRIMARY KEY, at INTEGER, local_id TEXT, sha256s TEXT, result TEXT, error TEXT);
```

- `device_id` = a random UUID created at first launch and stored in the Keychain (it survives app reinstall), plus the user-editable device name. This lets one drive serve multiple iPhones.
- Migrations are versioned (GRDB `DatabaseMigrator`). A newer app migrates older snapshots after backing them up; an older app refuses newer ones with a clear message.

---

## 7. Core algorithms

### 7.1 Library sync

- First run: fetch all assets (`PHAsset.fetchAssets(with: options)` with `includeAssetSourceTypes = [.typeUserLibrary, .typeCloudShared, .typeiTunesSynced]` — shared albums are a user toggle, default **off**), store them in `library_assets`, and save the `PHPersistentChangeToken`.
- Later runs: `fetchPersistentChanges(since:)` → apply inserts, updates, and deletes. Fall back to a full re-fetch if the token has expired.
- Listen to `PHPhotoLibraryChangeObserver` while the app is open.
- Target: 50,000 assets synced in < 20 s on first run, and < 2 s incremental.

### 7.2 Backup & the one-copy invariant

**Invariant:** for every SHA-256, at most one file exists under the vault's media folders, and `files.sha256` is UNIQUE.

For each selected asset, and for each resource role it has (original, edited if `has_adjustments`, live_motion if Live Photo):
```
fast path: if asset_files has (local_id, device, role) with asset_mod_date == PHAsset.modificationDate
           and its file_id exists in files → SKIPPED_ALREADY_BACKED_UP (no export, no hashing)
if local_id is in restored_assets and unchanged → SKIPPED_RESTORED_FROM_VAULT (link it, no copy)
export the resource with PHAssetResourceManager.writeData → drive .photovault/tmp/<uuid>.part
     (isNetworkAccessAllowed per the iCloud setting; progress handler feeds the job ETA)
stream-hash the .part with CryptoKit SHA256 (64 KB chunks); fsync
if sha256 in files          → delete .part; link asset_files → SKIPPED_DUPLICATE
if sha256 in tombstones     → delete .part; → SKIPPED_PREVIOUSLY_REMOVED (unless the user un-blocked it)
read metadata (ImageIO CGImageSourceCopyPropertiesAtIndex / AVAsset metadata) from the .part
compute the final path from the template (+ collision suffix); create folders
atomic move .part → final path (same volume)
BEGIN; INSERT files …; INSERT asset_files …; COMMIT   (UNIQUE violation → remove the file, mark duplicate)
append a manifest line; every 200 items → checkpoint
```
- Export directly to the drive's `tmp/` (never to the phone's internal storage — the phone is usually full).
- One export at a time for iCloud downloads; up to 2 concurrent exports for local assets. Measure and tune on a real device.
- Set the original capture date as the file modification date on the drive copy.
- Never overwrite an existing file.
- A Live Photo's still and motion files are committed as one group: if either fails, the group is marked `partial` and retried.

### 7.3 Drive cleanup (duplicates already on the drive)

Walk the vault folder (excluding `.photovault/`). Hash every media file; register first occurrences in place (or move them into the template layout if the user chooses); move later duplicates to `.photovault/quarantine/<date>/…`. Show a report (unique / duplicates / GB reclaimable) with **Empty quarantine** and **Restore from quarantine** actions. Offer this automatically when a non-empty folder is chosen as a new vault.

### 7.4 Delete from iPhone ("Free up space")

**Preconditions, checked per asset at action time:**
1. The drive is connected and its `vault_id` matches.
2. Every resource role of the asset (original, plus edited and live motion if present) has an `asset_files` row, and the asset's `modificationDate` still matches (not edited since backup).
3. **Re-verify:** read each drive file fully, re-hash it, and require an exact match. Any failure → that asset is excluded and reported, and its drive file is flagged "suspect".
4. The asset is not in a shared album owned by someone else (those cannot be deleted); iTunes-synced assets cannot be deleted either — exclude them with a reason.

**Flow:** Filter (default: "backed up and verified, older than 30 days") → preview (count, size freed, date range, 24 sample thumbnails, warnings: "32 are Live Photos — both parts are removed", "5 are favorites") → **Verify** step with a progress bar → our confirmation sheet → the iOS system dialog → items go to **Recently Deleted** → report + `deletion_log`. Batch at ≤ 500 assets per `deleteAssets` call. A dry run is always available. Wording: "moved to Recently Deleted (recoverable for 30 days)", never "deleted forever".

### 7.5 Restore

- **Presets:** Last 30 days · Last 1 year · This year · A year/month · A place · A person · A date range · Custom filter.
- **Destination A — Photos app:** `PHAssetCreationRequest`: add the original (and `.pairedVideo` for Live Photos) from the drive file URL; set `creationDate` and `location`; optionally add to a new album "Restored <date>". Record the new `local_id` → `file_id` in `restored_assets`, so the next backup does not copy it again even if Photos changed its bytes on import.
- **Destination B — a Files folder** (another folder on the drive, or On My iPhone): a plain copy with the hash verified.
- **Skip rules:** if the drive file is already represented by an existing library asset (`asset_files` / `restored_assets` points to a `local_id` that still exists), skip it as "already on iPhone".
- Check iPhone free space first (`volumeAvailableCapacityForImportantUsage`) and block with the shortfall.
- Show a report: restored / skipped / failed.

### 7.6 Job runtime, crash safety, resume

- Jobs run in the foreground; the screen is kept awake during a job (user-visible toggle, default on). Show "Keep PhotoVault open while backing up" plus a Live Activity/notification for progress (optional, Phase 6).
- On backgrounding: request `beginBackgroundTask` time, finish the current item, checkpoint, and pause. Resume automatically when the app returns.
- Drive unplugged → pause with "Reconnect your drive". When the same `vault_id` reappears, resume.
- On launch: remove orphan `tmp/*.part` files, reconcile manifest lines that are missing from the DB, and offer to resume unfinished jobs.
- Low battery (< 15%, not charging) → pause and ask. Thermal state `.serious` → slow down.

---

## 8. Faces / People (on-device)

- **Pipeline** (resumable job; runs while the app is open, and optionally as a `BGProcessingTask` while charging):
  1. Request a 1024px image from PHImageManager for library assets (or read the drive file for drive-only items).
  2. Vision `VNDetectFaceRectanglesRequest` + `VNDetectFaceLandmarksRequest` (confidence ≥ 0.8, face ≥ 40 px).
  3. Align the crop from the landmarks → **SFace Core ML** → a 128-d L2-normalized embedding.
  4. Incremental clustering: assign to the nearest cluster centroid when cosine similarity ≥ threshold (start around 0.36 and tune on a labeled test set); periodically cluster unassigned faces (min size 3).
- **People screen:** cluster grid, Name, Merge, Split, "Not this person", Hide, "Review unassigned".
- **Filter:** Person = X means the asset contains ≥ 1 face assigned to X; AND/OR across people.
- **Privacy:** embeddings stay in the working DB and the drive snapshot only. "Delete all face data" wipes them everywhere.
- **Performance target:** ≥ 10 images/s on an A15-class iPhone (use the Neural Engine via Core ML).

---

## 9. Filters

```ts
type Filter = {
  scope: 'library' | 'vault' | 'both';
  kind?: ('photo'|'video'|'live'|'screenshot'|'favorite'|'edited')[];
  date?: { preset?: 'last_30d'|'last_6m'|'last_1y'|'this_year'|'last_year'; from?: string; to?: string;
           years?: number[]; months?: number[] };
  location?: { countryCodes?: string[]; admin1?: string[]; cities?: string[]; hasGps?: boolean;
               near?: { lat: number; lon: number; radiusKm: number } };
  people?: { ids: string[]; mode: 'any'|'all' } | { noFaces: true };
  status?: ('backed_up'|'not_backed_up'|'partial'|'icloud_only'|'removed_from_iphone')[];
  albums?: string[];                     // PHAssetCollection localIdentifiers
  minSizeBytes?: number; maxSizeBytes?: number;
};
```
- It compiles to parameterized SQL in Swift. **No string concatenation.**
- Every screen shows a live count and size, debounced 250 ms.
- Location for library assets comes from `PHAsset.location` (available without export), so location filters work before backup. **Person filters work after face analysis**, which reads library images without exporting, so they also work before backup once analysis has run.

---

## 10. Performance & quality targets

| Area | Target |
|------|--------|
| Scale | 100,000 assets; gallery scroll at 60 fps on iPhone 12 or newer |
| Throughput | Local (non-iCloud) originals to a USB-C SSD: ≥ 40 MB/s sustained on iPhone 15 (USB 2 port) and higher on Pro models (USB 3); measure and publish real numbers |
| Re-run | Unchanged 50,000-asset library: < 30 s (fast path, no exports) |
| Integrity | Zero data loss in fault tests: unplug the drive, kill the app, fill the drive, lose the iCloud download midway |
| Memory | < 300 MB during backup (stream everything; never load whole videos) |
| Privacy | **Zero network requests** except PhotoKit iCloud downloads by the system. No analytics SDKs. App Store privacy label: "Data Not Collected" |
| Accessibility | VoiceOver labels on every control, Dynamic Type, WCAG AA contrast, 44 pt touch targets |
| i18n | i18next; English at v1, structure ready for Hindi, Tamil, etc.; Indian number grouping supported |

---

## 11. UI / UX specification

### 11.1 UI system — Tabler (Bootstrap 5), mobile-first

- **Stack:** `@tabler/core` (the only stylesheet base), `react-bootstrap` (components), `@tabler/icons-react` (the only icon set). Pin exact versions; record them in `THIRD_PARTY_LICENSES.md` (all MIT).
- **Rules:**
  1. No other UI kit or CSS framework. Custom CSS only in `styles/overrides.scss`, via Bootstrap/Tabler variables or `--tblr-*` properties. No inline hex colors.
  2. Theme tokens in `styles/_theme.scss`. Dark mode follows iOS (`prefers-color-scheme`) → `data-bs-theme`.
  3. **Mobile shell:** a Tabler top bar (title, drive status chip, running-job indicator) + a **bottom tab bar** (Home · Gallery · Backup · Restore · More). Respect iOS safe areas (`env(safe-area-inset-*)`); use `viewport-fit=cover`.
  4. Shared components in `apps/web/src/ui/`: `AppShell, TopBar, TabBar, PageHeader, StatCard, DriveCard, LibraryCard, FilterSheet (Offcanvas from the bottom), MediaGrid, MediaTile (status badge), Viewer (swipe), Wizard (Tabler steps), ConfirmSheet, DangerConfirmSheet, JobProgressCard, EmptyState, ErrorState, PersonAvatar, PlaceList, Toasts`. Screens only compose these.
  5. **Semantic colors (fixed):** `success` = backed up/verified; `secondary` = not backed up; `info` = iCloud-only; `warning` = partial, low-confidence date, needs attention; `danger` = delete and errors only. One primary action per screen.
  6. Native feel: haptics on key actions (Capacitor Haptics), no hover-only affordances, momentum scrolling, pull-to-refresh on the gallery (triggers a library sync).
  7. A `/ui-kit` route (dev and demo builds) renders every shared component in light and dark mode; Playwright screenshots of it are the visual-regression baseline.
  8. Fonts and assets are bundled; nothing loads from a CDN.

### 11.2 Screens

1. **Onboarding:** welcome → privacy promise → Photos permission (explain Full vs Limited) → connect drive (model-specific cable guidance) → choose drive folder → vault init (+ cleanup offer if non-empty) → done.
2. **Home:** drive card (name, format, free space, last backup), library card ("4,310 not backed up · 21 GB"), a big **Back up now** button, recent jobs, and warnings (Limited access, iCloud-only items, FAT32).
3. **Gallery:** month-grouped virtualized grid with status badges; a filter sheet; multi-select (drag to select); a viewer with a metadata panel (date, place, camera, backup status, drive path).
4. **Backup wizard:** What (all / not backed up / filter) → Options (include edited versions, iCloud download, Wi-Fi only, shared albums) → Review (count, size, space check) → Run (progress, pause/cancel, counters: copied / skipped duplicates / waiting for iCloud / errors).
5. **Restore wizard:** preset or filter → preview grid → destination (Photos app / Files folder) → run → report.
6. **Free up space:** filter → preview → verify → confirm → iOS dialog → report.
7. **People:** clusters → name, merge, split; person detail with photos.
8. **Places:** Country → State → City list with counts.
9. **Jobs & logs:** history, per-job report, deletion log, CSV export (via the share sheet).
10. **Settings:** drive (change / forget / rebuild index / cleanup), layout template (before the first backup only), iCloud options, shared albums toggle, faces on/off and "Delete all face data", tombstones ("previously removed items"), keep-screen-awake, diagnostics export, about and licenses.

**Copy rules:** plain language with numbers: "Copied 1,204 new photos. Skipped 8,991 already on your drive." Say "moved to Recently Deleted", never "permanently deleted".

---

## 12. Repository layout

```
photovault/
  apps/
    web/                      # React SPA (the UI) — also builds the web demo
      src/ui/                 #   shared Tabler/react-bootstrap components
      src/styles/             #   _theme.scss, overrides.scss
      src/plugins/            #   TS plugin interfaces + web (mock) implementations
    mobile/                   # Capacitor config + ios/ Xcode project
      ios/App/…
  native/
    PhotoVaultKit/            # Swift Package: IndexStore, Engine, Metadata, Geocoder, Faces, Drive, PhotoLibrary
      Sources/…  Tests/…      #   XCTest; runs on macOS + iOS simulator
    CapacitorPlugins/         # thin Capacitor plugin wrappers around PhotoVaultKit
  models/                     # SFace Core ML (fetched by script with checksum; not committed)
  data/geonames/               # build script producing the compact geocoder file
  tests/
    e2e/                      # Playwright against the web demo
    device/                   # XCUITest flows + manual device checklist
  docs/
    CONTEXT.md (this file)  DECISIONS.md  ARCHITECTURE.md  TESTING.md  RELEASE.md  DEMOS.md  THIRD_PARTY_LICENSES.md
  .github/workflows/          # ci.yml, demo.yml, ios-preview.yml, release.yml
```

---

## 13. Build phases (deliver in order; each ends tested and demoed)

**Phase 0 — Foundations (1 wk):** create the repo and branching (§17), Capacitor + React + Tabler shell with the bottom-tab layout, `/ui-kit`, plugin TS interfaces with mock web implementations and synthetic demo data, the `PhotoVaultKit` Swift package skeleton with GRDB + migrations, CI, the **web demo live on GitHub Pages**, and the first **TestFlight** build (empty shell). *Exit: the demo URL works on an iPhone's Safari; the TestFlight build installs.*

**Phase 1 — Library + Drive (1–2 wk):** Photos permission flows (Full/Limited/Denied), library sync with change tokens, the gallery with native thumbnails via `pv-thumb://`, drive picking + bookmarks + validation, vault init. *Exit: the real library of a 20k-photo test phone shows in the gallery; the drive is recognised after re-plugging.*

**Phase 2 — Backup engine + one-copy rule (2–3 wk):** export originals / edited / Live motion, streaming hash, atomic commit, fast path, tombstones, iCloud downloads, pause/resume, drive-unplug handling, manifest + snapshot sync, rebuild index from drive, drive cleanup with quarantine. *Exit test: back up 3×, reinstall the app, back up again, plug the drive into a second iPhone with overlapping photos → the drive holds exactly one copy of each unique file (automated check: count(files) == count(distinct hashes on disk)).*

**Phase 3 — Filters, Places, Restore (1–2 wk):** the full filter model, offline geocoder, Places screen, restore to Photos (Live Photos, dates, location) and to a Files folder, restore-aware dedup. *Exit: restore "last 1 year" to Photos, then back up again → 0 new copies.*

**Phase 4 — Free up space (1 wk):** verification, preview, the system delete dialog, deletion log, all exclusions. *Exit: fault tests prove no asset is deleted without a verified drive copy.*

**Phase 5 — People (2 wk):** Vision + Core ML pipeline, clustering, the People UI, person filters everywhere, background processing while charging.

**Phase 6 — Polish & release (1–2 wk):** performance at 100k assets, accessibility, localisation scaffolding, optional Live Activity for progress, App Store assets and privacy label, v1.0 on TestFlight → App Store submission.

**v2 backlog (do not build now):** Mac/Windows desktop, Android, iPad layout, a second-drive mirror, encrypted vaults, near-duplicate detection.

---

## 14. Testing strategy

- **Swift unit tests (XCTest in `PhotoVaultKit`):** date resolution (EXIF offset vs PhotoKit date; 31-Dec 23:30 at +05:30), path templating and sanitization, filter→SQL, geocoder, hashing, manifest replay, snapshot/rebuild, clustering thresholds.
- **Property tests:** for random sequences of backup / reinstall / drive swap / restore / cleanup, the one-copy invariant holds and every file matches its hash.
- **Fault injection (via a protocol-abstracted file system and photo source):** unplug mid-write, kill mid-commit, disk full, iCloud download failure, bookmark stale, permission revoked mid-job.
- **Web tests:** Vitest for UI logic; Playwright E2E against the web demo (onboarding, backup, restore, free-up-space dry run, people naming) at iPhone viewport sizes (390×844, 430×932, 375×667).
- **Device tests (XCUITest + manual checklist in `TESTING.md`):** iPhone with USB-C (15/16/17 series, including one Pro for USB 3 speeds) and one Lightning model with the camera adapter; the current and previous major iOS versions; drives formatted exFAT, APFS, FAT32, and NTFS (expect the NTFS block); a library with iCloud "Optimize Storage" on; Limited access mode.
- **CI gates:** Swift tests green, `swiftlint` clean, TS strict clean, ESLint clean, Playwright green, ≥ 80% coverage on `PhotoVaultKit` Engine and IndexStore.

---

## 15. Edge cases checklist

- [ ] The same photo exists twice in the library (e.g., a duplicated asset) → one drive copy; both assets are linked.
- [ ] A photo is edited after backup → a new `_edited` file is backed up; the original stays.
- [ ] The asset is iCloud-only and the phone is offline → "Waiting for iCloud" and a retry queue; the job completes without it and reports it.
- [ ] The phone storage is full → exports go directly to the drive's `tmp/`, never to the phone.
- [ ] The drive is re-plugged with a new mount path → found again by the bookmark + `vault_id`.
- [ ] The app is reinstalled → the working DB is rebuilt from the drive snapshot; the fast path is lost, so the first run re-hashes, but still makes no duplicate copies.
- [ ] Two iPhones share one drive → separate `device_id`s; shared photos (e.g., AirDropped) are copied once.
- [ ] A restored photo is backed up again → skipped via `restored_assets`.
- [ ] Videos > 4 GB on FAT32 → skipped with a clear message.
- [ ] A Live Photo's motion part fails → the group is `partial`, retried, and excluded from delete until complete.
- [ ] Limited Photos access → work on the visible subset with a banner.
- [ ] The user revokes Photos access mid-job → the job pauses with guidance.
- [ ] No capture date → PhotoKit creation date → file date, flagged low-confidence under "Needs review".
- [ ] Shared-album or iTunes-synced assets → backup is allowed; delete excludes them with a reason.
- [ ] Hidden album assets → included only if the user enables "Include Hidden" (requires the Hidden album to be unlocked in iOS settings).
- [ ] Low battery or thermal pressure → pause or throttle.

---

## 16. Agent working rules

1. **Photo safety over features.** Every code path that deletes or moves user files needs unit tests, a fault-injection test, a dry-run mode, and a log entry.
2. **Never** delete from the library without the full §7.4 checks performed at action time.
3. **Never** send file bytes across the Capacitor bridge (D3).
4. Keep `docs/DECISIONS.md` updated (ADR style), especially the real-device findings in §3.
5. Work phase by phase; don't start a phase until the previous phase's exit test passes.
6. Prefer boring, maintained libraries; pin versions; record licenses.
7. No network calls from app code. Add a test that fails if a network request appears in the web layer (CSP `connect-src 'self'` in the WebView).
8. Every UI element comes from the Tabler-based shared library (§11.1). New patterns go into `src/ui/` and `/ui-kit` first.
9. When iOS blocks something, surface it honestly in the UI with a workaround — never fake success.
10. **Everything goes through Git (§17).** Never commit directly to `main` or `develop`; push after every completed task; never leave work only on the local machine.
11. **Every phase ends with a demo (§17.5)**, reported back to the user in one short message.

---

## 17. Source control, CI/CD, releases & demos

### 17.1 Create the repository (Phase 0, first task)

Prerequisites: `git`, `gh` authenticated as the owner (`gh auth status`). If not authenticated, **stop and ask the user to run `gh auth login`**. Never ask for, paste, or commit tokens.

```bash
mkdir photovault && cd photovault && git init -b main
# README.md, LICENSE (proprietary by default), .gitignore, .gitattributes, .editorconfig, docs/CONTEXT.md (this file)
git add . && git commit -m "chore: initial repository scaffold"
gh repo create <owner>/photovault --private --source=. --remote=origin --push \
   --description "Back up iPhone photos to an external drive — privately"
git checkout -b develop && git push -u origin develop
gh repo edit --default-branch develop --delete-branch-on-merge --enable-squash-merge \
   --enable-merge-commit=false --enable-rebase-merge=false
```
- `.gitignore`: Node (`node_modules/`, `dist/`), Xcode (`DerivedData/`, `xcuserdata/`, `*.xcuserstate`, `build/`), Capacitor (`ios/App/App/public`), SwiftPM (`.build/`), `models/*.mlpackage`, `data/geonames/raw/`, `.env*`, `*.p12`, `*.mobileprovision`, `*.p8`.
- `.github/`: `CODEOWNERS`, `pull_request_template.md` (What / Why / How tested / Screenshots / Demo link / Photo-safety checklist), issue templates, `dependabot.yml` (npm, swift, github-actions).
- GitHub milestones for Phases 0–6 and one issue per task.

### 17.2 Branching (Git Flow–lite)

| Branch | From → Into | Rules |
|--------|-------------|-------|
| `main` | — | Releases only (from `release/*` or `hotfix/*`), each tagged `vX.Y.Z`, which triggers the App Store/TestFlight release build |
| `develop` | — | Default branch; always green; every push redeploys the web demo and uploads an internal TestFlight build |
| `feature/p<phase>-<name>` | `develop` → `develop` | e.g. `feature/p2-backup-engine`; short-lived (≤ 3 days), one concern each |
| `fix/…`, `chore/…`, `docs/…`, `test/…`, `ci/…` | `develop` → `develop` | |
| `release/x.y.0` | `develop` → `main` + back-merge | Version/build bump, changelog, device checklist |
| `hotfix/x.y.z` | `main` → `main` + back-merge | Urgent fixes |

Branch protection on `main` and `develop`: PR required, required CI checks, up to date with the base, linear history, no force-push. Squash-merge features; merge-commit releases. (If the plan doesn't enforce protection on a private repo, enforce it via CI and record that in DECISIONS.md.) Each phase → `release/0.<N>.0` → tag `v0.<N>.0`. v1.0.0 after Phase 6.

### 17.3 Commits & pushing

- Conventional Commits (`feat(engine): …`, `fix(drive): …`), enforced by `commitlint` via `lefthook`. Pre-commit runs `swiftformat --lint`, `swiftlint`, `eslint`, `prettier --check`, `tsc --noEmit`, and `gitleaks`.
- Small, buildable commits. **Push after every completed task** and before ending any session. Open draft PRs early (`gh pr create --draft --base develop --fill`), link issues, then rebase, get CI green, and `gh pr merge --squash --delete-branch`.
- Secrets live only in GitHub Actions secrets: `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`, `APPSTORE_API_KEY_P8`, `MATCH_PASSWORD` + `MATCH_GIT_URL` (fastlane match for signing), or the equivalent manual cert/profile secrets.
- Changelog and versioning via `release-please` from commits.

### 17.4 CI/CD (`.github/workflows/`)

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | every push + PR | web: lint, tsc, vitest, Playwright (demo mode), `/ui-kit` screenshots; native (`macos-latest`): `swift test` for PhotoVaultKit, `xcodebuild` build + XCUITest on the iOS simulator; gitleaks; license check |
| `demo.yml` | push to `develop`, PRs | build the web app in demo mode → GitHub Pages (`develop`) + `/pr-<n>/` previews with a PR comment. If Pages isn't available for the private repo, use Vercel/Netlify (record in DECISIONS.md) |
| `ios-preview.yml` | push to `develop` | fastlane: build, sign, upload to **TestFlight (internal testers)** with the commit summary as "What to Test" |
| `release.yml` | tag `v*` on `main` | fastlane: release build → TestFlight external group / App Store Connect submission; GitHub Release with changelog |

**Apple requirements (the user must provide):** an Apple Developer Program membership ($99/year), an App Store Connect API key, a bundle id (default `com.<owner>.photovault`), and the TestFlight tester emails. Until these exist, the pipelines build unsigned simulator artifacts only, and the agent must **ask the user** rather than stall silently.

### 17.5 Demos — "show me" at every phase

1. **Live web demo (always on, any browser including iPhone Safari):** the real UI with mock plugins and ~2,000 synthetic items (generated images, fake dates over 5 years, Indian and international places, 4 generated-avatar "people", a fake drive with free space). Simulated jobs with live progress; a second backup shows everything skipped as a duplicate; delete runs as a dry run. A permanent banner: "Demo mode — uses sample photos, not yours".
2. **TestFlight build** of the same commit for trying on a real iPhone with a real drive.
3. **Screen recording** of the phase's key flows on a real iPhone (or the simulator with a mock drive for early phases), attached to the phase PR and the GitHub Release.
4. **`docs/DEMOS.md`:** Phase | What to try | Demo link | TestFlight build no. | Video | Known limitations.
5. **"Try it" steps** (5–8) at the end of every phase PR.
6. **Report to the user** after each phase: demo URL, TestFlight build number, video link, what changed — one short message.

| After phase | Demo shows |
|-------------|-----------|
| 0 | App shell with bottom tabs, dashboard empty states, dark mode, `/ui-kit` |
| 1 | Permissions onboarding, gallery of the (mock/real) library, drive picking |
| 2 | Backup with live progress; re-run → all skipped; drive cleanup quarantine |
| 3 | Filters, Places, restore "last 1 year" into Photos |
| 4 | Free-up-space preview → verify → iOS dialog → report |
| 5 | People clusters: name, merge, split; person filters |
| 6 | App Store-ready build, performance at 100k items |

---

## 18. Open questions (defaults assumed — change if needed)

| Question | Default assumed |
|----------|-----------------|
| Product name / bundle id | "PhotoVault" / `com.<owner>.photovault` |
| Apple Developer account | The user will enroll; the agent asks for the API key before Phase 0's TestFlight step |
| Download iCloud-only originals during backup? | Yes, Wi-Fi only by default |
| Back up edited versions too? | Yes, as `_edited` files next to the original |
| Include shared albums / Hidden album? | Off by default (toggles in Settings) |
| Re-copy items the user deliberately removed from the drive? | No (tombstones), with an un-block option |
| Keep the original filename or rename to a timestamp? | Keep the original; add a hash suffix on collision |
| Minimum iOS version | iOS 17 |
| Distribution | TestFlight first; App Store after v1.0 |
