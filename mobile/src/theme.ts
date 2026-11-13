import { StyleSheet } from 'react-native';

export const colors = {
  // Link's tokens (qu/ui.tsx `c`), so Glance reads as part of the same app.
  ink: '#050505', muted: '#65676B', blue: '#0866FF', blueLight: '#EBF5FF',
  line: '#CED0D4', paper: '#FFFFFF', canvas: '#F0F2F5', green: '#146B55',
  greenLight: '#E8F5EF', danger: '#AD3046', dangerLight: '#FBECEF',
  orange: '#9A4B00', orangeLight: '#FFEBD1',
  /** Light blue marker behind the things two people have in common. */
  highlight: '#CFE2FF',
  /** The glasses cards' accent: the outline that runs around a recognized person's card. */
  violet: '#7C5CFF', violetSoft: '#E6DFFF', violetLight: '#F5F2FF', violetInk: '#4A2FBF',
};
export const fonts = {
  body: 'Inter_400Regular', medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold',
};
export const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' },
  app: { flex: 1, width: '100%', maxWidth: 520, backgroundColor: colors.paper },
  page: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  grow: { flex: 1 },
  title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  heading: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { color: colors.ink, fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  small: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  label: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21 },
  eyebrow: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.2 },
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 16, gap: 12 },
  soft: { backgroundColor: colors.canvas, borderRadius: 8, padding: 16, gap: 8 },
  divider: { height: 1, backgroundColor: colors.line },
  input: {
    minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 6, padding: 12,
    color: colors.ink, fontFamily: fonts.body, fontSize: 15, backgroundColor: colors.paper,
  },
  button: {
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6,
    backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  buttonText: { color: colors.paper, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  secondary: { backgroundColor: '#E4E6EB' },
  secondaryText: { color: colors.ink },
  ghost: { backgroundColor: '#E4E6EB' },
  ghostText: { color: colors.ink },
  danger: { backgroundColor: colors.dangerLight },
  dangerText: { color: colors.danger },
  disabled: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.75 },
  badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.blueLight },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2, color: '#0064D1' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blueLight },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  status: { padding: 12, borderRadius: 8, gap: 6, backgroundColor: colors.blueLight },
  error: { backgroundColor: colors.dangerLight },
});
