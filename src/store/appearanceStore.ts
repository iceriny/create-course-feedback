import { create } from "zustand";
type Appearance = "light" | "dark" | "system";
export const useAppearanceStore = create<{
  mode: Appearance;
  setMode: (mode: Appearance) => void;
}>((set) => ({
  mode: (() => {
    try {
      const value = localStorage.getItem("appearance");
      return value === "light" || value === "dark" ? value : "system";
    } catch {
      return "system";
    }
  })(),
  setMode: (mode) => {
    set({ mode });
    try {
      localStorage.setItem("appearance", mode);
    } catch {
      /* 本次仍应用所选外观。 */
    }
  },
}));
