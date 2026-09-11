// Single source of truth for color tokens. Components must reference
// theme.colors.X rather than hardcoding hex values, so Light/Dark stay
// consistent everywhere (cards, charts, modals, bottom nav, icons).
export const lightTheme = {
  name: "light",
  colors: {
    background: "#DCE6F0",
    surface: "#FFFFFF",
    surfaceAlt: "#EAF1F8",
    surfaceStrong: "#24405F",
    textPrimary: "#142238",
    textSecondary: "#6C82A0",
    onAccent: "#FFFFFF",
    border: "#E4ECF4",
    accent: "#3A6EA5",
    tint: "#A9C4DE",
    success: "#3A6EA5",
    danger: "#C65D4B",
    warning: "#D4A537",
    good: "#3FA968",
    medium: "#D4A537",
    bad: "#C65D4B",
  },
};

export const darkTheme = {
  name: "dark",
  colors: {
    background: "#050B14",
    surface: "#142238",
    surfaceAlt: "#1B2F45",
    surfaceStrong: "#2E5C86",
    textPrimary: "#EAF1F8",
    textSecondary: "#8CA3C2",
    onAccent: "#F2F7FF",
    border: "#213A5A",
    accent: "#6FA8DC",
    tint: "#24405F",
    success: "#6FA8DC",
    danger: "#E2836F",
    warning: "#E3BB63",
    good: "#5FC98A",
    medium: "#E3BB63",
    bad: "#E2836F",
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 8, md: 10, lg: 14, xl: 18, pill: 999 };
export const font = {
  family: "'Manrope', system-ui, -apple-system, sans-serif",
  size: { xs: 11, sm: 12.5, md: 14, lg: 17, xl: 22, xxl: 26 },
};

export function getTheme(mode) {
  return mode === "dark" ? darkTheme : lightTheme;
}
