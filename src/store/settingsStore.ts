import { create } from "zustand";

import API, { type ModelType } from "../AI_API/API";
import { PROMPTS } from "../components/constants";
import type { PromptItem, PromptType } from "../components/types";
import {
  getPromptFromLocalStorage,
  savePromptToLocalStorage,
} from "../utils/storage";
import {
  readStorageJson,
  readStorageString,
  writeStorageJson,
  writeStorageString,
} from "../services/persistence/localStorageRepository";

interface SettingsStore {
  hydrateSettings: () => void;
  model: ModelType;
  promptItems: Record<string, PromptItem>;
  promptKey: PromptType;
  savePromptItems: () => void;
  setModel: (model: ModelType) => void;
  setPromptItems: (items: Record<string, PromptItem>) => void;
  setPromptKey: (key: PromptType) => void;
}

const PROMPT_KEY = "promptKey";
const MODEL_KEY = "ai-model";

const getDefaultPromptKey = () => "programming" as PromptType;

const buildPromptItems = () => ({
  ...PROMPTS,
  ...getPromptFromLocalStorage(),
});

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  model: API.getModel(),
  promptItems: buildPromptItems(),
  promptKey: getDefaultPromptKey(),

  hydrateSettings: () => {
    const model = readStorageJson<ModelType | null>(MODEL_KEY, null);
    if (model) {
      API.setModel(model);
    }

    const promptItems = buildPromptItems();
    const storedPromptKey =
      (readStorageString(PROMPT_KEY) as PromptType | null) ??
      getDefaultPromptKey();
    const promptKey =
      storedPromptKey in promptItems ? storedPromptKey : getDefaultPromptKey();

    set({
      model: model ?? API.getModel(),
      promptItems,
      promptKey,
    });
  },

  savePromptItems: () => {
    savePromptToLocalStorage(get().promptItems);
  },

  setModel: (model) => {
    API.setModel(model);
    writeStorageJson(MODEL_KEY, model);
    set({ model });
  },

  setPromptItems: (promptItems) => {
    const promptKey = get().promptKey in promptItems
      ? get().promptKey
      : getDefaultPromptKey();
    if (promptKey !== get().promptKey) {
      writeStorageString(PROMPT_KEY, promptKey);
    }
    set({ promptItems, promptKey });
  },

  setPromptKey: (promptKey) => {
    writeStorageString(PROMPT_KEY, promptKey);
    set({ promptKey });
  },
}));
