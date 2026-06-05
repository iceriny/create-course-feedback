import { beforeEach, describe, expect, it } from "vitest";

import { PROMPTS } from "../components/constants";
import API from "../AI_API/API";
import { installMemoryStorage } from "../test/memoryStorage";
import { useSettingsStore } from "./settingsStore";

describe("settings store", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.clear();
    useSettingsStore.setState({
      model: API.getModel(),
      promptItems: { ...PROMPTS },
      promptKey: "programming",
    });
  });

  it("hydrates model and selected prompt from storage", () => {
    localStorage.setItem("ai-model", JSON.stringify("deepseek-chat"));
    localStorage.setItem(
      "prompts",
      JSON.stringify({
        custom: { name: "自定义", prompt: "请写反馈" },
      }),
    );
    localStorage.setItem("promptKey", "custom");

    useSettingsStore.getState().hydrateSettings();

    expect(useSettingsStore.getState()).toMatchObject({
      model: "deepseek-chat",
      promptKey: "custom",
    });
    expect(useSettingsStore.getState().promptItems.custom).toEqual({
      name: "自定义",
      prompt: "请写反馈",
    });
  });

  it("falls back to the default prompt when a saved prompt is missing", () => {
    localStorage.setItem("promptKey", "missing");

    useSettingsStore.getState().hydrateSettings();

    expect(useSettingsStore.getState().promptKey).toBe("programming");
  });

  it("saves only custom prompt items", () => {
    useSettingsStore.getState().setPromptItems({
      ...PROMPTS,
      custom: { name: "自定义", prompt: "请写反馈" },
    });
    useSettingsStore.getState().savePromptItems();

    expect(JSON.parse(localStorage.getItem("prompts") ?? "{}")).toEqual({
      custom: { name: "自定义", prompt: "请写反馈" },
    });
  });
});
