import { useSyncExternalStore } from "react";

export const narrowWorkspaceQuery = "(max-width: 700px)";

function observeViewport(onChange: () => void) {
  const media = window.matchMedia(narrowWorkspaceQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isNarrow() {
  return window.matchMedia(narrowWorkspaceQuery).matches;
}

export default function useNarrowWorkspace() {
  return useSyncExternalStore(observeViewport, isNarrow);
}
