import { Button, Flex, Input, Modal } from "antd";
import Select from "../common/Select";
import { useLayoutEffect, useRef, useState } from "react";
import { toPlainText } from "../../services/feedback/feedbackTemplate";
import ContentTransition from "../../motion/ContentTransition";

type Format = "plain" | "markdown";

export default function FeedbackPreview({
  open,
  afterClose,
  markdown,
  detail,
  contentKey,
  format,
  setFormat,
  continuation,
  onClose,
  onCopied,
  onCopyError,
}: {
  open: boolean;
  afterClose: () => void;
  markdown: string;
  detail: string;
  contentKey: string;
  format: Format;
  setFormat: (format: Format) => void;
  continuation?: "next" | "finish";
  onClose: () => void;
  onCopied: (advance: boolean) => void;
  onCopyError: () => void;
}) {
  const text = format === "plain" ? toPlainText(markdown) : markdown;
  const copying = useRef(false);
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
      await navigator.clipboard.writeText(text);
      onCopied(advance);
    } catch {
      const input = textarea();
      input?.focus();
      input?.select();
      onCopyError();
    } finally {
      copying.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="反馈预览"
      open={open}
      afterClose={afterClose}
      onCancel={onClose}
      mask={busy ? { closable: false } : undefined}
      keyboard={!busy}
      closable={!busy}
      width={720}
      footer={
        <Flex justify="end" gap={8} wrap>
          <Button
            type={continuation ? "default" : "primary"}
            loading={busy}
            onClick={() => void copy(false)}
          >
            复制反馈
          </Button>
          {continuation && (
            <Button
              type="primary"
              loading={busy}
              onClick={() => void copy(true)}
            >
              {continuation === "next" ? "复制并查看下一位" : "复制并结束"}
            </Button>
          )}
        </Flex>
      }
    >
      <Flex justify="space-between" align="center" gap={8} wrap>
        <div aria-live="polite">
          <ContentTransition contentKey={contentKey} direction="forward">
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
          direction="forward"
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
