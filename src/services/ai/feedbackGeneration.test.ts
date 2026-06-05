import { describe, expect, it, vi } from "vitest";

import type { StudentsInfo } from "../../components/types";
import {
  buildStudentFeedbackGenerationMessages,
  createStudentFeedbackStreamHandlers,
  getStudentPerformanceText,
  startStudentFeedbackGeneration,
  type StudentInfoUpdater,
} from "./feedbackGeneration";

const makeForm = (values: Record<string, unknown>) => ({
  getFieldValue: (name: (string | number)[]) => values[name.join(".")],
});

const waitForMicrotasks = () =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 0));

const baseInfo: StudentsInfo = {
  name: "张三",
  content: "",
  think_content: "",
  loading: false,
  activated: true,
};

describe("feedback generation service", () => {
  it("reads v1 and v2 performance text from form values", () => {
    expect(
      getStudentPerformanceText(
        makeForm({ "content.0": "表现积极" }),
        { name: "张三", gender: "male", version: "v1" },
        0,
      ),
    ).toBe("表现积极");

    expect(
      getStudentPerformanceText(
        makeForm({
          "content.0.total": "积极",
          "content.0.mastery_situation": "掌握稳定",
          "content.0.attention": "专注",
          "content.0.interaction": "主动",
          "content.0.other": "继续保持",
        }),
        { name: "张三", gender: "female", version: "v2" },
        0,
      ),
    ).toBe(
      "性别:female,整体表现:积极,掌握情况:掌握稳定,专注度:专注,参与度:主动,其他:继续保持",
    );
  });

  it("builds messages from current student input", () => {
    expect(
      buildStudentFeedbackGenerationMessages({
        coursePromptContext: "课程信息",
        form: makeForm({ "content.1": "很专注" }),
        index: 1,
        student: { name: "李四", gender: "male", version: "v1" },
        systemPrompt: "写反馈",
      }),
    ).toEqual([
      { role: "system", content: "写反馈" },
      { role: "user", content: "课程信息" },
      { role: "user", content: "学员姓名: 李四" },
      { role: "user", content: "很专注" },
    ]);
  });

  it("updates streaming content and cleans final output", () => {
    let info = baseInfo;
    const updateStudentInfo: StudentInfoUpdater = (_index, patch) => {
      info = typeof patch === "function" ? patch(info) : { ...info, ...patch };
    };

    const { onContent, onFinish } = createStudentFeedbackStreamHandlers(
      0,
      { name: "张三", gender: "male", version: "v1" },
      ["李四"],
      updateStudentInfo,
    );

    onContent("思考中", "reasoning_content");
    onContent(
      "**课堂表现:** 表现积极，能够跟随老师完成变量练习，并主动分享自己的想法。\n2026年 6月1日",
      "content",
    );
    onFinish();

    expect(info).toMatchObject({
      generation: {
        quality: {
          issues: [],
          status: "pass",
        },
        status: "ready",
      },
      content: "表现积极，能够跟随老师完成变量练习，并主动分享自己的想法。",
      think_content: "思考中",
      loading: false,
    });
  });

  it("marks generation as failed when the stream reports an error", () => {
    let info: StudentsInfo = {
      ...baseInfo,
      generation: {
        status: "generating",
      },
      loading: true,
    };
    const updateStudentInfo: StudentInfoUpdater = (_index, patch) => {
      info = typeof patch === "function" ? patch(info) : { ...info, ...patch };
    };

    const { onContent, onFinish } = createStudentFeedbackStreamHandlers(
      0,
      { name: "张三", gender: "male", version: "v1" },
      [],
      updateStudentInfo,
    );

    onContent(null);
    onFinish();

    expect(info).toMatchObject({
      generation: {
        errorMessage: "生成失败，请稍后重试。",
        status: "failed",
      },
      loading: false,
    });
  });

  it("starts API generation with loading state and compiled messages", async () => {
    const sendMessages = vi.fn();
    const updateStudentInfo = vi.fn();

    startStudentFeedbackGeneration({
      aiClient: {
        getModel: () => "test-model",
        getProvider: () => "siliconflow",
        isTokenReady: () => true,
        sendMessages,
      },
      blockedStudentNames: ["李四"],
      coursePromptContext: "课程信息",
      form: makeForm({ "content.0": "表现积极" }),
      index: 0,
      student: { name: "张三", gender: "male", version: "v1" },
      systemPrompt: "写反馈",
      updateStudentInfo,
    });

    await waitForMicrotasks();

    expect(updateStudentInfo).toHaveBeenCalledWith(0, {
      content: "",
      generation: {
        attempt: 0,
        maxAttempts: 2,
        queuedAt: expect.any(String),
        status: "queued",
        taskId: expect.any(String),
      },
      loading: true,
      think_content: "",
    });
    expect(sendMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "system", content: "写反馈" },
          { role: "user", content: "课程信息" },
          { role: "user", content: "学员姓名: 张三" },
          { role: "user", content: "表现积极" },
        ],
      }),
    );
  });
});
