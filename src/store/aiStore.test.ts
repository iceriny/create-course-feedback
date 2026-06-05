import { beforeEach, describe, expect, it } from "vitest";

import { useAIStore } from "./aiStore";

describe("ai store", () => {
  beforeEach(() => {
    useAIStore.setState({
      isThrottled: false,
      tasks: {},
      throttleMessage: "",
    });
  });

  it("updates throttle state", () => {
    useAIStore.getState().setThrottleState(true, "请稍后再试");

    expect(useAIStore.getState()).toMatchObject({
      isThrottled: true,
      throttleMessage: "请稍后再试",
    });
  });

  it("stores generation task snapshots by id", () => {
    useAIStore.getState().updateGenerationTask({
      attempt: 1,
      id: "task-1",
      maxAttempts: 2,
      queuedAt: "2026-06-04T08:00:00.000Z",
      status: "running",
      studentIndex: 0,
      studentName: "张三",
    });
    useAIStore.getState().updateGenerationTask({
      attempt: 2,
      id: "task-1",
      maxAttempts: 2,
      queuedAt: "2026-06-04T08:00:00.000Z",
      status: "succeeded",
      studentIndex: 0,
      studentName: "张三",
    });

    expect(useAIStore.getState().tasks["task-1"]).toMatchObject({
      attempt: 2,
      status: "succeeded",
    });
  });
});
