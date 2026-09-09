import { afterEach, describe, expect, it, vi } from "vitest";

import type { StudentsInfo } from "../../types";
import type { PromptTrace } from "../../domain/ai";
import type { KeyValueStorage } from "../persistence/localStorageRepository";
import { readPromptTraces } from "../persistence/promptTraceRepository";
import type { AIClient } from "./AIClient";
import {
  createGenerationOrchestrator,
  type StudentInfoUpdater,
} from "./generationOrchestrator";

const baseInfo: StudentsInfo = {
  activated: true,
  content: "",
  loading: false,
  name: "张三",
  think_content: "",
};

const contextPlan = {
  blockedStudentNames: ["李四"],
  coursePromptContext: "课程背景",
  performanceText: "表现积极",
  policy: {
    allowedStudentName: "张三",
    blockedStudentNames: ["李四"],
    classContextUse: "course_background_only" as const,
    currentInputPriority: "always" as const,
  },
  student: { name: "张三", gender: "male" as const, version: "v1" as const },
};

const waitFor = async (predicate: () => boolean) => {
  for (let index = 0; index < 10; index++) {
    if (predicate()) return;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  }
  throw new Error("Timed out while waiting for async work.");
};

const createInfoUpdater = () => {
  let info = baseInfo;
  const updateStudentInfo: StudentInfoUpdater = (_index, patch) => {
    info = typeof patch === "function" ? patch(info) : { ...info, ...patch };
  };

  return {
    getInfo: () => info,
    updateStudentInfo,
  };
};

const createMemoryStorage = (): KeyValueStorage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

describe("generation orchestrator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs multiple students in parallel up to the configured limit", async () => {
    const updateStudentInfo = vi.fn();
    const handlers: Parameters<AIClient["sendMessages"]>[0][] = [];
    const aiClient: AIClient = {
      getModel: () => "test-model",
      getProvider: () => "siliconflow",
      isTokenReady: () => true,
      sendMessages: (input) => {
        handlers.push(input);
      },
    };
    const orchestrator = createGenerationOrchestrator({
      aiClient,
      maxConcurrentTasks: 2,
      retryDelayMs: 0,
      updateStudentInfo,
    });

    for (let index = 0; index < 3; index++) {
      orchestrator.queueStudentGeneration({
        contextPlan: {
          ...contextPlan,
          student: {
            ...contextPlan.student,
            name: `学生${index + 1}`,
          },
        },
        index,
        systemPrompt: "写反馈",
      });
    }

    await waitFor(() => handlers.length === 2);

    handlers[0].onContent(
      "学生1表现积极，能够认真跟随老师完成练习。",
      "content",
    );
    handlers[0].onFinish();

    await waitFor(() => handlers.length === 3);

    expect(handlers).toHaveLength(3);
    expect(updateStudentInfo).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        generation: expect.objectContaining({
          status: "queued",
        }),
        loading: true,
      }),
    );
  });

  it("queues, streams, validates, and saves a completed prompt trace", async () => {
    const traces: PromptTrace[] = [];
    const { getInfo, updateStudentInfo } = createInfoUpdater();
    const aiClient: AIClient = {
      getModel: () => "test-model",
      getProvider: () => "siliconflow",
      isTokenReady: () => true,
      sendMessages: ({ onContent, onFinish }) => {
        onContent("推理", "reasoning_content");
        onContent(
          "**课堂表现:** 张三表现积极，能够认真跟随老师完成练习，并愿意分享自己的想法。",
          "content",
        );
        onFinish();
      },
    };

    createGenerationOrchestrator({
      aiClient,
      promptRecipe: { id: "programming", name: "编程" },
      retryDelayMs: 0,
      saveTrace: (trace) => traces.push(trace),
      updateStudentInfo,
    }).queueStudentGeneration({
      contextPlan,
      index: 0,
      systemPrompt: "写反馈",
    });

    await waitFor(() => getInfo().generation?.status === "ready");

    expect(getInfo()).toMatchObject({
      content: "张三表现积极，能够认真跟随老师完成练习，并愿意分享自己的想法。",
      generation: {
        attempt: 1,
        quality: { status: "pass" },
        status: "ready",
      },
      loading: false,
      think_content: "推理",
    });
    expect(traces.at(-1)).toMatchObject({
      attempt: 1,
      model: "test-model",
      output: {
        content:
          "张三表现积极，能够认真跟随老师完成练习，并愿意分享自己的想法。",
        status: "ready",
      },
      promptRecipe: { id: "programming", name: "编程" },
      provider: "siliconflow",
    });
  });

  it("retries once after a failed stream", async () => {
    vi.useFakeTimers();

    try {
      const { getInfo, updateStudentInfo } = createInfoUpdater();
      const sendMessages = vi
        .fn()
        .mockImplementationOnce(({ onError }) => {
          onError(new Error("network"));
        })
        .mockImplementationOnce(({ onContent, onFinish }) => {
          onContent("张三这节课表现积极，能够跟随老师完成练习。", "content");
          onFinish();
        });
      const aiClient: AIClient = {
        getModel: () => "test-model",
        getProvider: () => "siliconflow",
        isTokenReady: () => true,
        sendMessages,
      };

      createGenerationOrchestrator({
        aiClient,
        retryDelayMs: 10,
        updateStudentInfo,
      }).queueStudentGeneration({
        contextPlan,
        index: 0,
        systemPrompt: "写反馈",
      });

      await vi.runOnlyPendingTimersAsync();
      await waitFor(() => getInfo().generation?.status === "ready");

      expect(sendMessages).toHaveBeenCalledTimes(2);
      expect(getInfo().generation).toMatchObject({
        attempt: 2,
        status: "ready",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the default trace repository when no custom saver is provided", async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("localStorage", storage);
    const { getInfo, updateStudentInfo } = createInfoUpdater();
    const aiClient: AIClient = {
      getModel: () => "test-model",
      getProvider: () => "siliconflow",
      isTokenReady: () => true,
      sendMessages: ({ onContent, onFinish }) => {
        onContent(
          "张三这节课表现积极，能够认真跟随老师完成练习，也愿意表达自己的想法。",
          "content",
        );
        onFinish();
      },
    };

    createGenerationOrchestrator({
      aiClient,
      retryDelayMs: 0,
      updateStudentInfo,
    }).queueStudentGeneration({
      contextPlan,
      index: 0,
      systemPrompt: "写反馈",
    });

    await waitFor(
      () =>
        getInfo().generation?.status === "ready" ||
        getInfo().generation?.status === "needs_review",
    );

    const traces = readPromptTraces(storage);
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      model: "test-model",
      output: {
        status: "ready",
      },
      provider: "siliconflow",
    });
  });
});

describe("bounded streaming updates", () => {
  it.each([10, 30, 100])(
    "coalesces three streams with a %i-student roster",
    async (size) => {
      vi.useFakeTimers();
      try {
        const handlers: Parameters<AIClient["sendMessages"]>[0][] = [];
        const patches = vi.fn();
        const aiClient: AIClient = {
          getModel: () => "test",
          getProvider: () => "custom",
          isTokenReady: () => true,
          sendMessages: (input) => {
            handlers.push(input);
          },
        };
        const orchestrator = createGenerationOrchestrator({
          aiClient,
          updateStudentInfo: patches,
          saveTrace: () => {},
        });
        for (let i = 0; i < size; i++)
          orchestrator.queueStudentGeneration({
            contextPlan: {
              ...contextPlan,
              student: {
                ...contextPlan.student,
                id: String(i),
                name: `学生${i}`,
              },
            },
            index: i,
            systemPrompt: "test",
          });
        expect(handlers).toHaveLength(3);
        patches.mockClear();
        for (let i = 0; i < 100; i++)
          handlers.forEach((handler) =>
            handler.onContent(`观察内容${i}`, "content"),
          );
        expect(patches).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(60);
        expect(patches).toHaveBeenCalledTimes(3);
        orchestrator.cancelAll();
      } finally {
        vi.useRealTimers();
      }
    },
  );
});
