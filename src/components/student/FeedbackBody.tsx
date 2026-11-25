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
  const finished = Boolean(
    !loading && info.generation?.finishedAt && !info.generation.errorMessage,
  );
  const value = loading ? info.draftContent || "" : info.content;

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
    <div className="feedback-body" data-loading={loading}>
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
            loading ? "正在准备反馈…" : "生成后在这里校对，也可以直接撰写反馈。"
          }
        />
      </FixedTextEditor>
      <span className="feedback-generation-tint" aria-hidden="true" />
      <span
        className="feedback-completion-ring"
        aria-hidden="true"
        ref={completionRing}
      />
      <span className="feedback-announcement" role="status">
        {loading ? "正在生成反馈" : finished ? "反馈已生成，可以校对" : ""}
      </span>
    </div>
  );
}
