import { create } from "zustand";

import { DEFAULT_FEEDBACK_TEMPLATE } from "../services/feedback/feedbackTemplate";
import {
  readStorageString,
  writeStorageString,
} from "../services/persistence/localStorageRepository";

interface FeedbackStore {
  customTemplate: string;
  hydrateFeedbackSettings: () => void;
  setFeedbackTemplate: (template: string, signature: string) => void;
  signature: string;
}

const FEEDBACK_TEMPLATE_KEY = "feedback-template";
const SIGNATURE_KEY = "signature";
const DEFAULT_SIGNATURE = "哆啦人工智能小栈";

export const useFeedbackStore = create<FeedbackStore>((set) => ({
  customTemplate: DEFAULT_FEEDBACK_TEMPLATE,
  signature: DEFAULT_SIGNATURE,

  hydrateFeedbackSettings: () => {
    set({
      customTemplate:
        readStorageString(FEEDBACK_TEMPLATE_KEY) ?? DEFAULT_FEEDBACK_TEMPLATE,
      signature: readStorageString(SIGNATURE_KEY) ?? DEFAULT_SIGNATURE,
    });
  },

  setFeedbackTemplate: (template, signature) => {
    writeStorageString(FEEDBACK_TEMPLATE_KEY, template);
    writeStorageString(SIGNATURE_KEY, signature);
    set({ customTemplate: template, signature });
  },
}));
