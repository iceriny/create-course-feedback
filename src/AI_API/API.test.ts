import { afterEach, describe, expect, it, vi } from "vitest";
import API, { readEventStream, RequestError } from "./API";
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
