// =============================================================
// THEME TUNGGAL (design system) untuk Chat, Login, dan CMS.
// Semua halaman memakai token dari sini agar selaras.
// Font: judul = Plus Jakarta Sans, isi = Source Sans 3.
// Palet resmi Kemendag (kemendag.go.id): biru #004DAF, hijau #16a75c,
// navy #13182B, abu-abu #58595B, latar putih.
// =============================================================

export const FONT_HEADING = '"Sora", sans-serif';
export const FONT_BODY = '"Source Sans 3", sans-serif';

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

  pageBgLight: "linear-gradient(180deg,#eef2f7,#f8fafc)",
  pageBgDark: "#0a101e",

  cardLight: "#ffffff",
  cardDark: "#263956",
  cardSoftLight: "#f8fafc",
  cardSoftDark: "#304266",

  borderLight: "#e2e8f0",
  borderDark: "#1e2e4a",
  borderSoftLight: "#eef2f7",
  borderSoftDark: "#2b3a58",

  inputBgLight: "#ffffff",
  inputBgDark: "#0f1a2f",

  textLight: "#1e293b",
  textDark: "#e5edf7",
  textSoftLight: "#475569",
  textSoftDark: "#c3cede",
  textMuteLight: "#5b6b82",
  textMuteDark: "#9db0cc",

  bubbleBotLight: "#eaf0ff",
  bubbleBotDark: "#3e5788",
  bubbleUserLight: "#3b82f6",
  bubbleUserDark: "#2c63ae",

  barLight: "#ffffff",
  barDark: "#1b2944",
  bgSoftLight: "#eaf0f7",
  bgSoftDark: "#3a4b6b",
  sidebarLight: "#f6f8fd",
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
    accentText: dark ? "#ffffff" : COLORS.blue,
    accentSoft: COLORS.blue,
    accent: dark ? "#7fb1e8" : COLORS.blue,
    cardBorder: dark ? COLORS.borderDark : COLORS.borderLight,
    gold: COLORS.gold,
    chatBg: dark ? "#223254" : "#f8fafc"
  };
}
