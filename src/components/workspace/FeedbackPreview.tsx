import { Button, Flex, Input, Modal } from "antd";
import Select from "../common/Select";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { toPlainText } from "../../services/feedback/feedbackTemplate";
import ContentTransition from "../../motion/ContentTransition";

import type { FeedbackCopyFormat } from "./useFeedbackCopyFlow";

export default function FeedbackPreview({
  open,
  afterClose,
  markdown,
  detail,
  contentKey,
  format,
  setFormat,
  queue,
  onPrevious,
  onSkip,
  onClose,
  onCopy,
  onCopyError,
}: {
  open: boolean;
  afterClose: () => void;
  markdown: string;
  detail: string;
  contentKey: string;
  format: FeedbackCopyFormat;
  setFormat: (format: FeedbackCopyFormat) => void;
  queue?: { index: number; total: number; direction: "forward" | "backward" };
  onPrevious: () => void;
  onSkip: () => void;
  onClose: () => void;
  onCopy: (advance: boolean) => Promise<"copied" | "unavailable" | "changed">;
  onCopyError: () => void;
}) {
  const text = format === "plain" ? toPlainText(markdown) : markdown;
  const copying = useRef(false);
  const continueButton = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const textarea = () =>
    field.current?.querySelector<HTMLTextAreaElement>(
      '[data-overlay-pane="active"] textarea',
    );

  useLayoutEffect(() => {
    textarea()?.scrollTo({ top: 0 });
  }, [contentKey, format, text]);

  const copy = async (advance: boolean) => {
    if (copying.current) return;
    copying.current = true;
    setBusy(true);
    try {
      if ((await onCopy(advance)) === "unavailable") {
        const input = textarea();
        input?.focus();
        input?.select();
        onCopyError();
      }
    } finally {
      copying.current = false;
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !queue ||
      !open ||
      event.defaultPrevented ||
      event.repeat ||
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      (event.target instanceof Element &&
        event.target.closest(
          "button, a, input, select, [role=combobox], [role=option], [contenteditable=true]",
        ))
    )
      return;
    if (
      event.target instanceof HTMLTextAreaElement &&
      event.target.selectionStart !== event.target.selectionEnd
    )
      return;
    event.preventDefault();
    void copy(true);
  };

  const direction = queue?.direction === "backward" ? "back" : "forward";
  const hasNext = queue && queue.index < queue.total - 1;
  return (
    <Modal
      title="反馈预览"
      open={open}
      afterClose={afterClose}
      afterOpenChange={(visible) => {
        if (visible && queue && !copying.current)
          continueButton.current?.focus();
      }}
      onCancel={onClose}
      mask={busy ? { closable: false } : undefined}
      keyboard={!busy}
      closable={!busy}
      modalRender={(dialog) => <div onKeyDown={onKeyDown}>{dialog}</div>}
      width={720}
      footer={
        <Flex justify="end" gap={8} wrap className="copy-preview-actions">
          {queue && (
            <>
              <Button disabled={busy || queue.index === 0} onClick={onPrevious}>
                上一位
              </Button>
              <Button disabled={busy} onClick={onSkip}>
                跳过
              </Button>
            </>
          )}
          <Button
            type={queue ? "default" : "primary"}
            loading={busy}
            onClick={() => void copy(false)}
          >
            复制反馈
          </Button>
          {queue && (
            <Button
              ref={continueButton}
              type="primary"
              loading={busy}
              onClick={() => void copy(true)}
            >
              {hasNext ? "复制并查看下一位" : "复制并结束"}
            </Button>
          )}
        </Flex>
      }
    >
      <Flex justify="space-between" align="center" gap={8} wrap>
        <div aria-live="polite">
          {queue && (
            <span className="copy-preview-progress">
              第 {queue.index + 1} / {queue.total} 位
            </span>
          )}
          <ContentTransition contentKey={contentKey} direction={direction}>
            <strong>{detail}</strong>
          </ContentTransition>
        </div>
        <Select
          aria-label="复制格式"
          value={format}
          disabled={busy}
          onChange={setFormat}
          options={[
            { value: "plain", label: "纯文本" },
            { value: "markdown", label: "Markdown" },
          ]}
        />
      </Flex>
      <div ref={field}>
        <ContentTransition
          contentKey={contentKey}
          replacementKey={format}
          direction={direction}
        >
          <Input.TextArea
            aria-label="最终反馈预览"
            className="export-preview"
            readOnly
            value={text}
            rows={12}
          />
        </ContentTransition>
      </div>
    </Modal>
  );
}
