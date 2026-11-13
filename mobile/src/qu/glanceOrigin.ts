/** The Queue Up event a "Join with Glance" came from, for the way back. Memory only. */
let origin: { id: string; title: string } | null = null;
export const glanceOrigin = () => origin;
export function setGlanceOrigin(o: { id: string; title: string } | null) { origin = o; }
