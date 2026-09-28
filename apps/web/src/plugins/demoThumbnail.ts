import type { MediaKind } from "./types";

// Generates a deterministic, privacy-safe placeholder thumbnail (an inline SVG
// data URI — a gradient plus a kind glyph) instead of bundling or fetching any
// real photo. Same asset id always renders the same color, so the demo gallery
// looks stable across reloads.
function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

const KIND_GLYPH: Record<MediaKind, string> = {
  photo: "▣",
  video: "▶",
  live: "◉",
  screenshot: "⌷",
  favorite: "★",
  edited: "✎",
};

export function demoThumbnailDataUrl(assetId: string, kind: MediaKind, size: number): string {
  const hue = hashHue(assetId);
  const glyph = KIND_GLYPH[kind] ?? "▣";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue},55%,45%)" />
        <stop offset="100%" stop-color="hsl(${(hue + 40) % 360},55%,30%)" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)" />
    <text x="50%" y="55%" font-size="${Math.floor(size * 0.32)}" text-anchor="middle"
          fill="rgba(255,255,255,0.85)" font-family="sans-serif">${glyph}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
