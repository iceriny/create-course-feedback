import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_FEEDBACK_TEMPLATE } from "../services/feedback/feedbackTemplate";
import { installMemoryStorage } from "../test/memoryStorage";
import { useFeedbackStore } from "./feedbackStore";

describe("feedback store", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.clear();
    useFeedbackStore.setState({
      customTemplate: DEFAULT_FEEDBACK_TEMPLATE,
      signature: "哆啦人工智能小栈",
    });
  });

  it("hydrates and saves feedback template settings", () => {
    localStorage.setItem("feedback-template", "模板 {{courseFeedback}}");
    localStorage.setItem("signature", "老师");

    useFeedbackStore.getState().hydrateFeedbackSettings();

    expect(useFeedbackStore.getState()).toMatchObject({
      customTemplate: "模板 {{courseFeedback}}",
      signature: "老师",
    });

    useFeedbackStore.getState().setFeedbackTemplate("新模板", "新签名");

    expect(localStorage.getItem("feedback-template")).toBe("新模板");
    expect(localStorage.getItem("signature")).toBe("新签名");
  });
});
