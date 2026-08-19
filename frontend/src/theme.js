// =============================================================
// THEME TUNGGAL (design system) untuk Chat, Login, dan CMS.
// Semua halaman memakai token dari sini agar selaras.
// Font: judul = Plus Jakarta Sans, isi = Source Sans 3.
// Palet resmi Kemendag: biru #004DAF, hijau #16a75c, navy #13182B;
// emas #e9a319 sebagai aksen identitas.
// =============================================================

export const FONT_HEADING = '"Plus Jakarta Sans", "Source Sans 3", sans-serif';
export const FONT_BODY = '"Source Sans 3", "Plus Jakarta Sans", sans-serif';

export const COLORS = {
  blue: "#004DAF",
  blueDark: "#003d94",
  blueLight: "#7fb1e8",
  green: "#16a75c",
  navy: "#13182B",
  navyDeep: "#001845",
  gold: "#e9a319",
  goldLight: "#f6c453",
  goldSoft: "rgba(233,163,25,0.55)",

  pageBgLight: "linear-gradient(180deg,#dce4f0,#e9eef6)",
  pageBgDark: "#070b14",

  cardLight: "#ffffff",
  cardDark: "#2a3d63",
  cardSoftLight: "#f8fafc",
  cardSoftDark: "#304266",

  borderLight: "#d4dce8",
  borderDark: "#26324d",
  borderSoftLight: "#e2e8f0",
  borderSoftDark: "#2b3a58",

  inputBgLight: "#f1f5f9",
  inputBgDark: "#0f1a2f",

  textLight: "#1e293b",
  textDark: "#e5edf7",
  textSoftLight: "#475569",
  textSoftDark: "#c3cede",
  textMuteLight: "#64748b",
  textMuteDark: "#8b98ad",

  bubbleBotLight: "#e2e7ee",
  bubbleBotDark: "#223254",
  bubbleUserLight: "#9fc7ef",
  bubbleUserDark: "#0e5c9e",

  barLight: "#ffffff",
  barDark: "#1b2944",
  bgSoftLight: "#eef2f7",
  bgSoftDark: "#3a4b6b",
  sidebarLight: "#eef2f7",
  sidebarDark: "#0f182c"
};

export function createTheme(dark) {
  return {
    dark,
    pageBg: dark ? COLORS.pageBgDark : COLORS.pageBgLight,
    card: dark ? COLORS.cardDark : COLORS.cardLight,
    cardSoft: dark ? COLORS.cardSoftDark : COLORS.cardSoftLight,
    sidebar: dark ? COLORS.sidebarDark : COLORS.sidebarLight,
    bgSoft: dark ? COLORS.bgSoftDark : COLORS.bgSoftLight,
    bar: dark ? COLORS.barDark : COLORS.barLight,
    border: dark ? COLORS.borderDark : COLORS.borderLight,
    borderSoft: dark ? COLORS.borderSoftDark : COLORS.borderSoftLight,
    text: dark ? COLORS.textDark : COLORS.textLight,
    textSoft: dark ? COLORS.textSoftDark : COLORS.textSoftLight,
    textMute: dark ? COLORS.textMuteDark : COLORS.textMuteLight,
    inputBg: dark ? COLORS.inputBgDark : COLORS.inputBgLight,
    bubbleBot: dark ? COLORS.bubbleBotDark : COLORS.bubbleBotLight,
    bubbleUser: dark ? COLORS.bubbleUserDark : COLORS.bubbleUserLight,
    accentText: dark ? COLORS.blueLight : COLORS.blue,
    accentSoft: COLORS.blue,
    accent: dark ? COLORS.blueLight : COLORS.blue,
    cardBorder: dark ? COLORS.borderDark : COLORS.borderLight,
    gold: COLORS.gold,
    chatBg: dark
      ? "radial-gradient(rgba(0,77,175,0.12) 1px, transparent 1.4px) 0 0 / 22px 22px, #0d1526"
      : "radial-gradient(rgba(0,77,175,0.06) 1px, transparent 1.4px) 0 0 / 22px 22px, #eef2f756"
  };
}
