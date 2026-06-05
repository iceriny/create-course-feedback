import { beforeEach, describe, expect, it } from "vitest";

import type { PromptTrace } from "../../domain/ai";
import type { KeyValueStorage } from "./localStorageRepository";
import { readPromptTraces, savePromptTrace } from "./promptTraceRepository";

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

const makeTrace = (id: string): PromptTrace => ({
  attempt: 1,
  contextPolicy: {
    allowedStudentName: "张三",
    blockedStudentNames: [],
    classContextUse: "course_background_only",
    currentInputPriority: "always",
  },
  coursePromptContext: "课程背景",
  createdAt: "2026-06-04T08:00:00.000Z",
  id,
  messages: [{ content: "表现积极", role: "user" }],
  studentName: "张三",
});

describe("prompt trace repository", () => {
  let storage: KeyValueStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("saves newest traces first and keeps the configured limit", () => {
    savePromptTrace(makeTrace("a"), { limit: 2, storage });
    savePromptTrace(makeTrace("b"), { limit: 2, storage });
    savePromptTrace(makeTrace("c"), { limit: 2, storage });

    expect(readPromptTraces(storage).map((trace) => trace.id)).toEqual([
      "c",
      "b",
    ]);
  });

  it("replaces an existing trace with the same id", () => {
    savePromptTrace(makeTrace("a"), { storage });
    savePromptTrace(
      {
        ...makeTrace("a"),
        output: { content: "已生成", status: "ready" },
      },
      { storage },
    );

    expect(readPromptTraces(storage)).toHaveLength(1);
    expect(readPromptTraces(storage)[0].output?.content).toBe("已生成");
  });
});
