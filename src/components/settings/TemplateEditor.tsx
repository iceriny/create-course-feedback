import { Alert, Button, Col, Flex, Input, Modal, Row, Segmented } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import dayjs from "dayjs";
import { useEffect, useId, useRef, useState } from "react";
import {
  buildStudentFeedbackMarkdown,
  DEFAULT_FEEDBACK_SIGNATURE,
  DEFAULT_FEEDBACK_TEMPLATE,
  getFeedbackTemplateIssues,
  toPlainText,
} from "../../services/feedback/feedbackTemplate";
import type { TemplateEditorProps } from "../../types";
import { TEMPLATE_PLACEHOLDERS } from "../../utils/template";
import ContentTransition from "../../motion/ContentTransition";

const sampleStudent = {
  name: "林安",
  gender: "female",
  version: "v1",
} as const;

const TemplateEditor = ({
  isOpen,
  onClose,
  afterClose,
  onSave,
  initialTemplate,
  initialSignature,
  sendMessage,
}: TemplateEditorProps & { afterClose: () => void }) => {
  const [customTemplate, setCustomTemplate] = useState(initialTemplate);
  const [signature, setSignature] = useState(initialSignature);
  const [format, setFormat] = useState<"plain" | "markdown">("plain");
  const editorRef = useRef<TextAreaRef>(null);
  const wasEditorFocused = useRef(false);
  const issuesId = useId();
  useEffect(() => {
    setCustomTemplate(initialTemplate);
    setSignature(initialSignature);
  }, [initialTemplate, initialSignature]);

  const insertField = (field: string) => {
    const editor = editorRef.current?.resizableTextArea?.textArea;
    const [start, end] =
      editor && wasEditorFocused.current
        ? [editor.selectionStart, editor.selectionEnd]
        : [customTemplate.length, customTemplate.length];
    const text = `{{${field}}}`;
    setCustomTemplate(
      customTemplate.slice(0, start) + text + customTemplate.slice(end),
    );
    requestAnimationFrame(() => {
      if (!editor?.isConnected) return;
      editor.focus();
      editor.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const resetTemplate = () => {
    setCustomTemplate(DEFAULT_FEEDBACK_TEMPLATE);
    setSignature(DEFAULT_FEEDBACK_SIGNATURE);
    wasEditorFocused.current = false;
  };
  const issues = getFeedbackTemplateIssues(customTemplate);
  const lessonStart = dayjs().hour(16).minute(0);
  const preview = buildStudentFeedbackMarkdown({
    courseContext: {
      className: "编程班",
      courseName: "循环与条件判断",
      courseContentItems: [{ item: "用循环完成重复任务" }],
      courseObjectiveItems: [{ item: "能解释循环何时结束" }],
      courseContents: ["- 用循环完成重复任务\n"],
      courseObjectives: ["- 能解释循环何时结束\n"],
      courseTime: [lessonStart, lessonStart.add(90, "minute")],
    },
    customTemplate,
    signature,
    student: sampleStudent,
    studentInfo: {
      name: sampleStudent.name,
      content:
        "林安能独立写出循环，并逐步检查运行结果。课后可以试着解释循环条件变化时，程序会多执行几次。",
      think_content: "",
      loading: false,
      activated: true,
    },
  });

  return (
    <Modal
      title="自定义反馈模板"
      open={isOpen}
      onCancel={onClose}
      afterClose={afterClose}
      onOk={() => {
        if (issues.length) return;
        onSave(customTemplate, signature);
        sendMessage("反馈模板已保存");
      }}
      okText="保存模板"
      okButtonProps={{ disabled: issues.length > 0 }}
      width={1040}
    >
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Flex vertical gap={12}>
            <Flex gap={6} wrap aria-label="可插入字段" role="group">
              {Object.entries(TEMPLATE_PLACEHOLDERS).map(([field, label]) => (
                <Button
                  key={field}
                  size="small"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertField(field)}
                >
                  {label}
                </Button>
              ))}
            </Flex>
            <label>
              反馈模板
              <Input.TextArea
                ref={editorRef}
                value={customTemplate}
                onChange={(e) => setCustomTemplate(e.target.value)}
                onFocus={() => {
                  wasEditorFocused.current = true;
                }}
                aria-invalid={issues.length > 0}
                aria-describedby={issues.length ? issuesId : undefined}
                placeholder="输入自定义模板"
                rows={14}
              />
            </label>
            {!!issues.length && (
              <Alert
                id={issuesId}
                type="error"
                showIcon
                title={issues[0]}
                description={issues.slice(1).map((issue) => (
                  <div key={issue}>{issue}</div>
                ))}
              />
            )}
            <label>
              自定义签名
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="输入自定义签名"
              />
            </label>
            <div>
              <Button onClick={resetTemplate}>恢复默认模板</Button>
            </div>
          </Flex>
        </Col>
        <Col xs={24} md={12}>
          <Flex vertical gap={12}>
            <Flex align="center" gap={8} wrap justify="space-between">
              <h3>家长预览</h3>
              <Segmented
                aria-label="预览格式"
                value={format}
                onChange={setFormat}
                options={[
                  { label: "纯文本", value: "plain", title: "" },
                  { label: "Markdown", value: "markdown", title: "" },
                ]}
              />
            </Flex>
            <ContentTransition contentKey={format} direction="replace">
              <Input.TextArea
                aria-label="家长预览示例"
                readOnly
                variant="filled"
                value={format === "plain" ? toPlainText(preview) : preview}
                autoSize={{ minRows: 15, maxRows: 25 }}
              />
            </ContentTransition>
          </Flex>
        </Col>
      </Row>
    </Modal>
  );
};

export default TemplateEditor;
