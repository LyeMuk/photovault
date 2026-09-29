import { Capacitor } from "@capacitor/core";
import { DEMO_ASSETS } from "./demoData";
import { demoThumbnailDataUrl } from "./demoThumbnail";

const assetsById = new Map(DEMO_ASSETS.map((a) => [a.localId, a]));

// A plain, synchronous helper — not a registerPlugin() method — because Capacitor's
// plugin bridge proxies *every* call as async, even the web fallback (it's loaded via
// a dynamic import()). That breaks an <img src={...}> binding, which needs a string
// right away. Capacitor's own `Capacitor.convertFileSrc` follows the same pattern for
// exactly this reason. On-device this is served by PVThumbSchemeHandler.swift, a
// WKURLSchemeHandler registered on the WKWebView (docs/CONTEXT.md §4.2).
//
// The id goes in a query param, not the URL host/path: PHAsset.localIdentifier looks
// like "1F4A3B2C-...-XXXX/L0/001" — the "/"s would break host parsing, and would
// also collide with path-based routing if ever put there unescaped.
export function thumbnailUrl(assetId: string, size: 128 | 256 | 512 | 1024): string {
  if (Capacitor.isNativePlatform()) {
    return `pv-thumb://asset?id=${encodeURIComponent(assetId)}&s=${size}`;
  }
  const asset = assetsById.get(assetId);
  return demoThumbnailDataUrl(assetId, asset?.kind ?? "photo", size);
}
