/**
 * Client-side resize before upload (mirrors the find-me photo helper in components/chat/FindYourParty.tsx,
 * at album size): longest side ~1024px, JPEG ~0.8. Steps down if the result is still over the server cap.
 */
export const ALBUM_MAX_BYTES = 600_000;

const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

export async function resizeForAlbum(file: File, max = 1024, quality = 0.8): Promise<string> {
  const img = await createImageBitmap(file);
  for (const [side, q] of [[max, quality], [max, 0.7], [800, 0.7], [640, 0.6]] as const) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", q);
    if (bytesOf(url) <= ALBUM_MAX_BYTES) return url;
  }
  throw new Error("too_big");
}
