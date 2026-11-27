export const palettes = {
  light: {
    canvas: "#f3f5f8",
    panel: "#fcfdff",
    elevated: "#ffffff",
    overlay: "#f8fbff",
    spotlight: "#233044",
    text: "#263b53",
    muted: "#52677f",
    border: "#e3e8ef",
    controlBorder: "#d3dde9",
    primary: "#2563a6",
    onPrimary: "#ffffff",
    success: "#27734d",
    warning: "#915614",
    danger: "#b52f3e",
    neutral: "#64748b",
    track: "#dce4ed",
    scrollThumb: "#a8b8c9",
    scrollThumbHover: "#768da6",
  },
  dark: {
    canvas: "#121212",
    panel: "#1c1c1c",
    elevated: "#242424",
    overlay: "#2d2d2d",
    spotlight: "#363636",
    text: "#e7e7e7",
    muted: "#a8a8a8",
    border: "#333333",
    controlBorder: "#464646",
    primary: "#83b7f0",
    onPrimary: "#121d2b",
    success: "#90d7aa",
    warning: "#e9ae63",
    danger: "#ff858c",
    neutral: "#a0a0a0",
    track: "#363636",
    scrollThumb: "#565656",
    scrollThumbHover: "#838383",
  },
} as const;

export function applyPalette(
  palette: keyof typeof palettes,
  root: HTMLElement,
) {
  const tone = palettes[palette];
  const properties = {
    "--surface-canvas": tone.canvas,
    "--surface-panel": tone.panel,
    "--surface-elevated": tone.elevated,
    "--surface-overlay": tone.overlay,
    "--tone-primary": tone.primary,
    "--tone-success": tone.success,
    "--tone-warning": tone.warning,
    "--tone-danger": tone.danger,
    "--tone-neutral": tone.neutral,
    "--text": tone.text,
    "--muted": tone.muted,
    "--border": tone.border,
    "--track": tone.track,
    "--scroll-thumb": tone.scrollThumb,
    "--scroll-thumb-hover": tone.scrollThumbHover,
  };
  for (const [name, value] of Object.entries(properties))
    root.style.setProperty(name, value);
}
