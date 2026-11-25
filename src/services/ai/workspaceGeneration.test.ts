import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import API from "../../AI_API/API";
import { installMemoryStorage } from "../../test/memoryStorage";
import { useRosterStore } from "../../store/rosterStore";
import { cancelGeneration, generateFeedback } from "./workspaceGeneration";
let streams: {
  onContent: (value: string, type: "content") => void;
  finish: () => void;
}[];
beforeEach(() => {
  installMemoryStorage();
  localStorage.clear();
  useRosterStore.getState().resetRosterState();
  streams = [];
  API.setToken("test");
  vi.spyOn(API, "request").mockImplementation(
    (_config, _messages, onContent, signal) =>
      new Promise<void>((resolve, reject) => {
        streams.push({ onContent, finish: resolve });
        signal?.addEventListener(
          "abort",
          () => reject(new Error("cancelled")),
          { once: true },
        );
      }),
  );
  const store = useRosterStore.getState();
  store.loadStudentsFromStorage("A");
  store.updateStudentsFromRawValues(["Zoe", "Amy"], "A");
  store.setCourse({
    name: "Loops",
    start: "2026-09-09T08:00:00",
    end: "2026-09-09T10:00:00",
    contents: "Loop",
    objectives: "Practice",
  });
  store.updateStudentInfo(0, {
    performance: { brief: "Zoe observation" },
    content: "Original Zoe draft",
  });
  store.updateStudentInfo(1, { performance: { brief: "Amy observation" } });
});
afterEach(() => {
  cancelGeneration();
  vi.restoreAllMocks();
});
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
describe("generation with changing roster", () => {
  it("deduplicates requests and writes to the same student after sorting", async () => {
    expect(generateFeedback([0])).toBe(1);
    expect(generateFeedback([0])).toBe(0);
    useRosterStore.getState().sortStudentsByName();
    streams[0].onContent(
      "Zoe 能够认真完成循环练习，并主动检查程序结果。",
      "content",
    );
    streams[0].finish();
    await settle();
    expect(useRosterStore.getState().studentsInfo[1].content).toContain("Zoe");
    expect(useRosterStore.getState().studentsInfo[0].content).toBe("");
    expect(useRosterStore.getState().studentsInfo[1].previousContent).toBe(
      "Original Zoe draft",
    );
  });
  it("ignores late responses after switching lessons", async () => {
    generateFeedback([0]);
    useRosterStore.getState().loadStudentsFromStorage("B");
    useRosterStore.getState().updateStudentsFromRawValues(["Other"], "B");
    streams[0].onContent("Zoe late response", "content");
    streams[0].finish();
    await settle();
    expect(useRosterStore.getState().studentsInfo[0].content).toBe("");
  });
  it("preserves the old draft and ignores late chunks after cancellation", async () => {
    generateFeedback([0]);
    cancelGeneration();
    streams[0].onContent("late response", "content");
    streams[0].finish();
    await settle();
    expect(useRosterStore.getState().studentsInfo[0]).toMatchObject({
      content: "Original Zoe draft",
      loading: false,
    });
  });
  it("lets a running batch finish after a course edit while requiring updated feedback", async () => {
    const store = useRosterStore.getState();
    expect(generateFeedback([0, 1])).toBe(2);
    store.setCourse({ name: "Loops and conditions" });
    expect(useRosterStore.getState().studentsInfo[0].loading).toBe(true);
    for (const stream of streams) {
      stream.onContent("能够完成循环练习，并主动检查程序结果。", "content");
      stream.finish();
    }
    await settle();
    expect(useRosterStore.getState().studentsInfo[0]).toMatchObject({
      content: "Original Zoe draft",
      feedbackNeedsUpdate: "course",
      loading: false,
    });
    expect(useRosterStore.getState().studentsInfo[1]).toMatchObject({
      content: "能够完成循环练习，并主动检查程序结果。",
      feedbackNeedsUpdate: "course",
      loading: false,
    });

    expect(generateFeedback([0])).toBe(1);
    streams[2].onContent(
      "能完成循环和条件练习，并指出何时退出循环。",
      "content",
    );
    streams[2].finish();
    await settle();
    expect(useRosterStore.getState().studentsInfo[0]).toMatchObject({
      previousContent: "Original Zoe draft",
      previousFeedbackNeedsUpdate: "course",
      feedbackNeedsUpdate: undefined,
    });
  });
});
