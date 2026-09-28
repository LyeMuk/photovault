import { Capacitor } from "@capacitor/core";
import { DEMO_ASSETS } from "./demoData";
import { demoThumbnailDataUrl } from "./demoThumbnail";

const assetsById = new Map(DEMO_ASSETS.map((a) => [a.localId, a]));

// A plain, synchronous helper — not a registerPlugin() method — because Capacitor's
// plugin bridge proxies *every* call as async, even the web fallback (it's loaded via
// a dynamic import()). That breaks an <img src={...}> binding, which needs a string
// right away. Capacitor's own `Capacitor.convertFileSrc` follows the same pattern for
// exactly this reason. On-device this will synchronously build a `pv-thumb://<id>?s=…`
// URL served by a WKURLSchemeHandler (docs/CONTEXT.md §4.2); until then it always
// resolves to the demo placeholder.
export function thumbnailUrl(assetId: string, size: 128 | 256 | 512 | 1024): string {
  if (Capacitor.isNativePlatform()) {
    return `pv-thumb://${assetId}?s=${size}`;
  }
  const asset = assetsById.get(assetId);
  return demoThumbnailDataUrl(assetId, asset?.kind ?? "photo", size);
}
