import { create } from "zustand";

interface AIStore {
  isThrottled: boolean;
  setThrottleState: (isThrottled: boolean, message: string) => void;
  throttleMessage: string;
}

export const useAIStore = create<AIStore>((set) => ({
  isThrottled: false,
  throttleMessage: "",

  setThrottleState: (isThrottled, throttleMessage) => {
    set({ isThrottled, throttleMessage });
  },
}));
