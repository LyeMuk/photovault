// The TypeScript contract the web UI codes against (docs/CONTEXT.md §4.2, §9).
// Never import a native SDK directly from UI code — only these types and the
// plugin interfaces below. Both the real iOS plugins (native/CapacitorPlugins)
// and the web mock implementations (./*.web.ts) implement this same shape.

export type AuthorizationStatus = "authorized" | "limited" | "denied" | "notDetermined";

export type MediaKind = "photo" | "video" | "live" | "screenshot" | "favorite" | "edited";

export type BackupStatus =
  "backed_up" | "not_backed_up" | "partial" | "icloud_only" | "removed_from_iphone";

export type DateConfidence = "high" | "medium" | "low";

export interface Filter {
  scope: "library" | "vault" | "both";
  kind?: MediaKind[];
  date?: {
    preset?: "last_30d" | "last_6m" | "last_1y" | "this_year" | "last_year";
    from?: string;
    to?: string;
    years?: number[];
    months?: number[];
  };
  location?: {
    countryCodes?: string[];
    admin1?: string[];
    cities?: string[];
    hasGps?: boolean;
    near?: { lat: number; lon: number; radiusKm: number };
  };
  people?: { ids: string[]; mode: "any" | "all" } | { noFaces: true };
  status?: BackupStatus[];
  albums?: string[];
  minSizeBytes?: number;
  maxSizeBytes?: number;
}

export const EMPTY_FILTER: Filter = { scope: "both" };

export interface AssetSummary {
  localId: string;
  kind: MediaKind;
  capturedAtLocal: string; // ISO 8601, wall-clock
  dateConfidence: DateConfidence;
  widthPx: number;
  heightPx: number;
  durationMs?: number;
  bytesEstimate: number;
  status: BackupStatus;
  isFavorite: boolean;
  location?: { lat: number; lon: number; city?: string; country?: string };
  peopleIds: string[];
  albumIds: string[];
}

export interface LibrarySummary {
  total: number;
  photos: number;
  videos: number;
  bytesEstimate: number;
}

export interface DriveInfo {
  vaultId: string | null; // null until initVault has run
  name: string;
  format: "apfs" | "exfat" | "hfsplus" | "fat32" | "ntfs" | "unknown";
  isRemovable: boolean;
  freeBytes: number;
  totalBytes: number;
  connected: boolean;
}

export interface VaultInfo {
  vaultId: string;
  layoutTemplate: string;
  createdAt: string;
  itemCount: number;
  totalBytes: number;
}

export type JobType = "backup" | "restore" | "cleanup" | "delete" | "reindex" | "faces";
export type JobStatus = "queued" | "running" | "paused" | "done" | "failed" | "cancelled";

export interface JobProgress {
  jobId: string;
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  rateBytesPerSec: number;
  etaSeconds: number | null;
  current?: string;
  copied: number;
  skippedDuplicate: number;
  waitingForICloud: number;
  errors: number;
}

export interface JobItemError {
  jobId: string;
  localId: string;
  message: string;
}

export interface JobReport {
  jobId: string;
  type: JobType;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  copied: number;
  skippedDuplicate: number;
  skippedPreviouslyRemoved: number;
  restored: number;
  removed: number;
  errors: number;
  bytesMoved: number;
}

export interface PreviewResult {
  count: number;
  bytes: number;
  dateRange?: { from: string; to: string };
  sampleThumbnailIds: string[];
  warnings: string[];
}

export interface BackupRequest {
  kind: "backup";
  filter: Filter;
  options: {
    includeEdited: boolean;
    downloadFromICloud: boolean;
    wifiOnly: boolean;
    includeSharedAlbums: boolean;
  };
}

export interface RestoreRequest {
  kind: "restore";
  filter: Filter;
  destination: { type: "photos_app" } | { type: "files_folder"; path: string };
}

export interface CleanupRequest {
  kind: "cleanup";
}

export interface DeleteRequest {
  kind: "delete";
  filter: Filter;
  previewId: string;
}

export interface ReindexRequest {
  kind: "reindex";
}

export interface FacesRequest {
  kind: "faces";
}

export type StartJobRequest =
  BackupRequest | RestoreRequest | CleanupRequest | DeleteRequest | ReindexRequest | FacesRequest;

export interface Person {
  id: string;
  name: string | null;
  hidden: boolean;
  coverFaceThumbId: string | null;
  faceCount: number;
}

export interface FaceCluster {
  id: string;
  personId: string | null;
  size: number;
  coverThumbId: string;
}

export interface PlaceNode {
  countryCode: string;
  country: string;
  count: number;
  admin1: { name: string; count: number; cities: { name: string; count: number }[] }[];
}

export interface LibraryChangedEvent {
  added: number;
  changed: number;
  removed: number;
}

export interface DriveDisconnectedEvent {
  vaultId: string;
}
