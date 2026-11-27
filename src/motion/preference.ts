import { createStore } from "zustand/vanilla";
import {
  readStorageString,
  writeStorageString,
} from "../services/persistence/localStorageRepository";

export type MotionPreference = "system" | "reduce" | "full";

const storageKey = "motionPreference";
const systemMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export const motionPreferenceStore = createStore(() => ({
  mode: "system" as MotionPreference,
  reduced: systemMotion.matches,
}));

function applyMotionPreference(mode: MotionPreference) {
  const reduced =
    mode === "reduce" || (mode === "system" && systemMotion.matches);
  document.documentElement.dataset.motion = reduced ? "reduce" : "full";
  motionPreferenceStore.setState({ mode, reduced });
}

function readMotionPreference(): MotionPreference {
  try {
    const mode = readStorageString(storageKey);
    return mode === "reduce" || mode === "full" ? mode : "system";
  } catch {
    return "system";
  }
}

export function initializeMotionPreference() {
  applyMotionPreference(readMotionPreference());
  const syncSystem = () =>
    applyMotionPreference(motionPreferenceStore.getState().mode);
  const syncStorage = ({ key, storageArea }: StorageEvent) => {
    if (
      (key === storageKey || key === null) &&
      storageArea === window.localStorage
    )
      applyMotionPreference(readMotionPreference());
  };
  systemMotion.addEventListener("change", syncSystem);
  window.addEventListener("storage", syncStorage);
  import.meta.hot?.dispose(() => {
    systemMotion.removeEventListener("change", syncSystem);
    window.removeEventListener("storage", syncStorage);
  });
}

export function setMotionPreference(mode: MotionPreference) {
  try {
    writeStorageString(storageKey, mode);
  } catch {
    // The preference still applies to the current tab.
  }
  applyMotionPreference(mode);
}

export function prefersReducedMotion() {
  return motionPreferenceStore.getState().reduced;
}

export function onMotionReduced(listener: () => void) {
  return motionPreferenceStore.subscribe((current, previous) => {
    if (current.reduced && !previous.reduced) listener();
  });
}
