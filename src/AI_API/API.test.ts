import { afterEach, describe, expect, it, vi } from "vitest";
import API, { readEventStream, RequestError } from "./API";
import { installMemoryStorage } from "../test/memoryStorage";
const encoder = new TextEncoder();
const streamResponse = (chunks: Uint8Array[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    }),
  );
afterEach(() => vi.unstubAllGlobals());
describe("AI transport", () => {
  it("preserves UTF-8 characters and events across every byte boundary", async () => {
    const text = 'data: {"text":"中文观察"}\r\n\r\ndata: [DONE]\n\n';
    const bytes = encoder.encode(text);
    for (let split = 1; split < bytes.length; split++) {
      const data: string[] = [];
      await readEventStream(
        streamResponse([bytes.slice(0, split), bytes.slice(split)]),
        (value) => data.push(value),
      );
      expect(data).toEqual(['{"text":"中文观察"}', "[DONE]"]);
    }
  });
  it("classifies authentication and rate limits before reading content", async () => {
    const config = {
      provider: "custom" as const,
      config: {
        name: "test",
        apiUrl: "https://example.test",
        modelListUrl: "",
        defaultModel: "test",
      },
      token: "test",
      model: "test",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 401 }))
        .mockResolvedValueOnce(
          new Response("{}", { status: 429, headers: { "Retry-After": "2" } }),
        ),
    );
    await expect(API.request(config, [], () => {})).rejects.toMatchObject({
      retryable: false,
    });
    await expect(API.request(config, [], () => {})).rejects.toMatchObject({
      retryable: true,
      retryAfterMs: 2000,
    });
  });
  it("fails empty output rather than reporting a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([encoder.encode("data: [DONE]\n\n")]),
        ),
    );
    await expect(
      API.request({ ...API.snapshot(), token: "test" }, [], () => {}),
    ).rejects.toBeInstanceOf(RequestError);
  });
});

describe("AI service configuration", () => {
  const draft = {
    provider: "custom" as const,
    config: {
      name: "自定义",
      apiUrl: "https://draft.example.test/v1/chat/completions",
      modelListUrl: "https://draft.example.test/v1/models",
      defaultModel: "default",
    },
    token: "draft-key",
    model: "current-input",
  };

  it("tests the form values without changing the active configuration", async () => {
    const previous = API.snapshot();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "listed" }] })),
      )
      .mockResolvedValueOnce(
        streamResponse([
          encoder.encode('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n'),
        ]),
      );
    vi.stubGlobal("fetch", fetch);

    await expect(API.fetchModelList(draft)).resolves.toEqual(["listed"]);
    await API.testConnection({
      ...draft,
      config: { ...draft.config, modelListUrl: "" },
    });

    expect(fetch.mock.calls[0]).toEqual([
      draft.config.modelListUrl,
      expect.objectContaining({
        headers: { Authorization: "Bearer draft-key" },
      }),
    ]);
    expect(fetch.mock.calls[1][0]).toBe(draft.config.apiUrl);
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer draft-key",
    );
    expect(JSON.parse(fetch.mock.calls[1][1].body).model).toBe("current-input");
    expect(API.snapshot()).toEqual(previous);
  });

  it("keeps the old configuration when local storage fails during save", () => {
    const storage = installMemoryStorage();
    const previous = API.snapshot();
    storage.setItem("api_provider", previous.provider);
    storage.setItem("ai-model", JSON.stringify(previous.model));
    const setItem = storage.setItem;
    const write = vi
      .spyOn(storage, "setItem")
      .mockImplementation((key, value) => {
        if (key === "api_provider") throw new Error("storage full");
        setItem(key, value);
      });

    try {
      expect(() => API.saveConfiguration(draft, [])).toThrow("storage full");
      expect(API.snapshot()).toEqual(previous);
      expect(storage.getItem("ai-model")).toBe(JSON.stringify(previous.model));
      expect(storage.getItem("custom_provider_config")).toBeNull();
      expect(storage.getItem("api_key:custom")).toBeNull();
    } finally {
      write.mockRestore();
    }
  });

  it("remembers the last model and key when switching providers", () => {
    const storage = installMemoryStorage();
    const previous = API.snapshot();
    const previousModels = API.model_list;
    const previousCustom = API.getCustomProviderConfig();

    try {
      API.saveConfiguration(draft, ["current-input"]);
      expect(API.snapshot()).toEqual(draft);
      expect(storage.getItem("ai-model")).toBe(JSON.stringify(draft.model));
      API.saveConfiguration(previous, previousModels);
      expect(API.getProviderSnapshot("custom")).toEqual(draft);
    } finally {
      API.saveConfiguration(previous, previousModels);
      API.setCustomProviderConfig(previousCustom);
    }
  });
});
