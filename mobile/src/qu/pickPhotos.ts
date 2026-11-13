import { Platform } from 'react-native';

const MAX_BYTES = 600_000;
const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

/** Resize in the browser before upload (components/album/resize.ts): longest side ~1024px, JPEG ~0.8, stepping down to fit. */
async function resizeWeb(file: Blob, max = 1024): Promise<string> {
  const img = await createImageBitmap(file);
  for (const [side, q] of [[max, 0.8], [max, 0.7], [800, 0.7], [640, 0.6]] as const) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * scale));
    cv.height = Math.max(1, Math.round(img.height * scale));
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL('image/jpeg', q);
    if (bytesOf(url) <= MAX_BYTES) return url;
  }
  throw new Error('too_big');
}

/**
 * Let the person pick photos and hand back JPEG data URLs ready to upload. The web build uses a file input;
 * native builds use expo-image-picker. `capture` opens the camera where the browser supports it.
 */
export async function pickPhotos({ multiple = true, capture = false, max = 1024 } = {}): Promise<(string | Error)[]> {
  if (Platform.OS === 'web') {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.multiple = multiple;
      if (capture) input.setAttribute('capture', 'user');
      input.style.display = 'none';
      input.setAttribute('data-testid', 'photo-input');
      document.body.appendChild(input);
      input.onchange = async () => {
        const files = [...(input.files ?? [])];
        const out: (string | Error)[] = [];
        for (const f of files) out.push(await resizeWeb(f, max).catch(e => (e instanceof Error ? e : new Error('bad_image'))));
        input.remove();
        resolve(out);
      };
      input.click();
    });
  }
  const ImagePicker = await import('expo-image-picker');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, base64: true, quality: 0.7 });
  if (r.canceled) return [];
  return r.assets.map(a => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : new Error('bad_image')));
}
