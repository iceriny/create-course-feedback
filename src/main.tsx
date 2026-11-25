import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initializeMotion } from "./motion/engine";
import { readStorageString } from "./services/persistence/localStorageRepository";
import { useCourseStore, useFeedbackStore, useSettingsStore } from "./store";
import { useRosterStore } from "./store/rosterStore";
import "./motion/surfaces.css";

initializeMotion();
useCourseStore.getState().hydrateCourseState();
useFeedbackStore.getState().hydrateFeedbackSettings();
useSettingsStore.getState().hydrateSettings();
const lastClass = readStorageString("lastActiveClass");
if (lastClass) useRosterStore.getState().loadStudentsFromStorage(lastClass);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
