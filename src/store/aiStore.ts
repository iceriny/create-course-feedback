import { create } from "zustand";

import type { GenerationTaskSnapshot } from "../domain/ai";

interface AIStore {
  isThrottled: boolean;
  setThrottleState: (isThrottled: boolean, message: string) => void;
  tasks: Record<string, GenerationTaskSnapshot>;
  throttleMessage: string;
  updateGenerationTask: (task: GenerationTaskSnapshot) => void;
}

export const useAIStore = create<AIStore>((set) => ({
  isThrottled: false,
  tasks: {},
  throttleMessage: "",

  setThrottleState: (isThrottled, throttleMessage) => {
    set({ isThrottled, throttleMessage });
  },

  updateGenerationTask: (task) => {
    set((state) => ({
      tasks: {
        ...state.tasks,
        [task.id]: task,
      },
    }));
  },
}));
