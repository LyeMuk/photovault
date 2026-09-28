import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import type {
  AssetSummary,
  AuthorizationStatus,
  Filter,
  LibraryChangedEvent,
  LibrarySummary,
} from "./types";

export interface PhotoLibraryPlugin {
  requestAuthorization(): Promise<{ status: AuthorizationStatus }>;
  presentLimitedLibraryPicker(): Promise<void>;
  getLibrarySummary(): Promise<LibrarySummary>;
  syncLibrary(): Promise<{ added: number; changed: number; removed: number }>;
  queryAssets(q: {
    filter: Filter;
    cursor?: string;
    limit: number;
    sort: "newest" | "oldest";
  }): Promise<{ items: AssetSummary[]; nextCursor?: string; total: number; bytes: number }>;

  addListener(
    eventName: "libraryChanged",
    listenerFunc: (event: LibraryChangedEvent) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

// docs/CONTEXT.md §4.2: the web implementation is a pure fallback used by the browser
// demo and by tests. Once native/CapacitorPlugins/PhotoLibrary exists (blocked on Xcode,
// see docs/DECISIONS.md 0002), Capacitor automatically prefers it on-device — no UI change.
export const PhotoLibrary = registerPlugin<PhotoLibraryPlugin>("PhotoLibrary", {
  web: () => import("./photoLibrary.web").then((m) => new m.PhotoLibraryWeb()),
});
