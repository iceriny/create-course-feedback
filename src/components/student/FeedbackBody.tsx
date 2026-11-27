import { Input } from "antd";
import { useLayoutEffect, useRef } from "react";
import type { TextAreaRef } from "antd/es/input/TextArea";
import type { StudentsInfo } from "../../types";
import { animateMotion } from "../../motion/engine";
import FixedTextEditor from "../common/FixedTextEditor";

export default function FeedbackBody({
  info,
  onChange,
}: {
  info: StudentsInfo;
  onChange: (content: string) => void;
}) {
  const completionRing = useRef<HTMLSpanElement>(null);
  const textarea = useRef<TextAreaRef>(null);
  const loading = Boolean(info.loading);
  const wasLoading = useRef(loading);
  const status = info.generation?.status;
  const streaming = loading && Boolean(info.draftContent);
  const finished = Boolean(
    !loading &&
      info.generation?.finishedAt &&
      (status === "ready" || status === "needs_review"),
  );
  const value = loading ? info.draftContent || "" : info.content;
  const runningMessage =
    status === "queued"
      ? "正在排队"
      : status === "retrying"
        ? info.generation?.errorMessage
          ? "等待自动重试"
          : "正在重新生成反馈"
        : "正在生成反馈";

  useLayoutEffect(() => {
    if (wasLoading.current === loading) return;
    wasLoading.current = loading;
    const input = textarea.current?.resizableTextArea?.textArea;
    if (input) input.scrollTop = 0;
    if (finished && completionRing.current) {
      const animation = animateMotion(
        completionRing.current,
        [{ opacity: 1 }, { opacity: 0 }],
        "enter",
      );
      return () => animation?.cancel();
    }
  }, [finished, loading]);

  return (
    <div
      className="feedback-body"
      data-loading={loading}
      data-streaming={streaming}
    >
      <FixedTextEditor label="反馈正文" value={value}>
        <Input.TextArea
          variant="filled"
          ref={textarea}
          aria-label="反馈正文"
          data-feedback-body={loading ? undefined : true}
          value={value}
          readOnly={loading}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            loading
              ? `${runningMessage}…`
              : "生成后在这里校对，也可以直接撰写反馈。"
          }
        />
      </FixedTextEditor>
      <span className="feedback-generation-tint" aria-hidden="true" />
      <span className="feedback-stream-progress" aria-hidden="true" />
      <span
        className="feedback-completion-ring"
        aria-hidden="true"
        ref={completionRing}
      />
      <span className="feedback-announcement" role="status">
        {loading ? runningMessage : finished ? "反馈已生成，可以校对" : ""}
      </span>
    </div>
  );
}
