import { WebPlugin } from "@capacitor/core";
import type { PhotoLibraryPlugin } from "./photoLibrary";
import { DEMO_ASSETS } from "./demoData";
import { applyFilter } from "./filterAssets";
import type { AssetSummary, AuthorizationStatus, Filter, LibrarySummary } from "./types";

export class PhotoLibraryWeb extends WebPlugin implements PhotoLibraryPlugin {
  private authStatus: AuthorizationStatus = "notDetermined";

  async requestAuthorization(): Promise<{ status: AuthorizationStatus }> {
    this.authStatus = "authorized";
    return { status: this.authStatus };
  }

  async presentLimitedLibraryPicker(): Promise<void> {
    // No-op in the web demo — there is no real Limited Photos picker in a browser.
  }

  async getLibrarySummary(): Promise<LibrarySummary> {
    const photos = DEMO_ASSETS.filter(
      (a) => a.kind === "photo" || a.kind === "screenshot" || a.kind === "edited",
    );
    const videos = DEMO_ASSETS.filter((a) => a.kind === "video" || a.kind === "live");
    return {
      total: DEMO_ASSETS.length,
      photos: photos.length,
      videos: videos.length,
      bytesEstimate: DEMO_ASSETS.reduce((sum, a) => sum + a.bytesEstimate, 0),
    };
  }

  async syncLibrary(): Promise<{ added: number; changed: number; removed: number }> {
    // The demo library never changes underneath the user.
    return { added: 0, changed: 0, removed: 0 };
  }

  async queryAssets(q: {
    filter: Filter;
    cursor?: string;
    limit: number;
    sort: "newest" | "oldest";
  }): Promise<{ items: AssetSummary[]; nextCursor?: string; total: number; bytes: number }> {
    let filtered = applyFilter(DEMO_ASSETS, q.filter);
    if (q.sort === "oldest") filtered = [...filtered].reverse();

    const startIndex = q.cursor ? Number(q.cursor) : 0;
    const page = filtered.slice(startIndex, startIndex + q.limit);
    const nextIndex = startIndex + q.limit;

    return {
      items: page,
      nextCursor: nextIndex < filtered.length ? String(nextIndex) : undefined,
      total: filtered.length,
      bytes: filtered.reduce((sum, a) => sum + a.bytesEstimate, 0),
    };
  }
}
