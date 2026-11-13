/**
 * Meta AI returns to Link through link-glasses:// after the glasses are connected or the camera is allowed. The
 * GlanceGlasses module handles that URL natively (GlanceGlassesAppDelegate); the router must not navigate on it.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    if (path.startsWith('link-glasses:') || path.includes('metaWearablesAction')) return null;
  } catch { /* fall through to the normal route */ }
  return path;
}
