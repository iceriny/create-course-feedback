import IconButton from "../common/IconButton";
import Select from "../common/Select";
import {
  ArrowRightOutlined,
  CheckOutlined,
  CopyOutlined,
  UndoOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  canGenerateFeedback,
  feedbackStatus,
  isFeedbackReviewable,
  markFeedbackForUpdate,
  statusLabel,
} from "../../domain/feedbackStatus";
import { observationFields } from "../../domain/student";
import { memo, useId } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Tag,
  Typography,
  Collapse,
} from "antd";
import { useRosterStore } from "../../store/rosterStore";
import ObservationInput from "./ObservationInput";
import { validateGeneratedFeedback } from "../../services/ai/outputValidator";
import type { StudentsInfo } from "../../types";
import Disclosure from "../../motion/Disclosure";
import FeedbackBody from "./FeedbackBody";

interface Props {
  id: string;
  issue?: string;
  onGenerate: (id: string) => void;
  onFixIssue: () => void;
  onRecordNext: (id: string) => void;
  onReviewNext: (id: string) => void;
  onConfirmed: (name: string) => void;
  onPreview: (id: string) => void;
}
export default memo(function StudentEditor({
  id,
  issue,
  onGenerate,
  onFixIssue,
  onRecordNext,
  onReviewNext,
  onConfirmed,
  onPreview,
}: Props) {
  const student = useRosterStore((state) =>
    state.studentsList.find((s) => s.id === id),
  );
  const info = useRosterStore(
    (state) =>
      state.studentsInfo[state.studentsList.findIndex((s) => s.id === id)],
  );
  const observationModeId = useId();
  if (!student || !info) return null;
  const index = () =>
    useRosterStore.getState().studentsList.findIndex((s) => s.id === id);
  const update = (patch: Partial<typeof info>) =>
    useRosterStore.getState().updateStudentInfo(index(), patch);
  const detailed = student.version === "v2";
  const canGenerate = canGenerateFeedback(student, info);
  const status = feedbackStatus(student, info);
  const setPerformance = (field: string, value: string) => {
    if ((info.performance?.[field] ?? "") === value) return;
    const previousValue = info.performance?.[field]?.trim() ?? "";
    update({
      ...(previousValue !== value.trim()
        ? markFeedbackForUpdate(info, "observation")
        : {}),
      performance: { ...info.performance, [field]: value },
    });
  };
  const edit = (
    content: string,
    feedbackNeedsUpdate: StudentsInfo["feedbackNeedsUpdate"],
  ) => {
    const quality = validateGeneratedFeedback({
      content,
      allowedStudentName: student.name,
      blockedStudentNames: useRosterStore
        .getState()
        .studentsList.filter((s) => s.id !== id)
        .map((s) => s.name),
    });
    update({
      content,
      confirmed: false,
      copiedAt: undefined,
      feedbackNeedsUpdate,
      generation: {
        ...info.generation,
        quality,
        errorMessage: undefined,
        status: quality.status === "pass" ? "ready" : "needs_review",
      },
    });
  };
  const updateLabels = {
    observation: "课堂观察已更新",
    course: "课程信息已更新",
    student: "学生资料已更新",
  };
  const renderObservations = (
    fields: readonly (readonly [string, string])[],
    active: boolean,
  ) => (
    <div className="observation-fields">
      {fields.map(([field, label]) => (
        <ObservationInput
          key={field}
          id={id}
          field={field}
          label={label}
          value={info.performance?.[field] || ""}
          active={active}
          disabled={!info.activated || info.loading}
          onChange={(value) => setPerformance(field, value)}
          onNext={() => onRecordNext(id)}
        />
      ))}
    </div>
  );
  return (
    <Card
      className="student-editor"
      title={
        <Flex gap={12} align="center">
          <span>{student.name}</span>
          <Tag
            className="editor-feedback-status"
            color={
              info.confirmed
                ? "success"
                : info.loading
                  ? "processing"
                  : "default"
            }
          >
            {statusLabel(status)}
          </Tag>
        </Flex>
      }
      extra={
        <IconButton
          type="text"
          label="记录下一位"
          icon={<ArrowRightOutlined />}
          onClick={() => onRecordNext(id)}
        />
      }
    >
      <div className="editor-columns">
        <section className="observation-panel" aria-label="课堂观察">
          <Flex gap={8} wrap className="student-preferences">
            <Select
              variant="filled"
              aria-label="学生性别"
              value={student.gender}
              disabled={info.loading}
              options={[
                { value: "unspecified", label: "性别未指定" },
                { value: "male", label: "男" },
                { value: "female", label: "女" },
              ]}
              onChange={(gender) =>
                useRosterStore.getState().updateStudentGender(index(), gender)
              }
            />
            <Select
              variant="filled"
              id={observationModeId}
              aria-label="记录方式"
              value={student.version}
              disabled={info.loading}
              options={[
                { value: "v1", label: "简要记录" },
                { value: "v2", label: "分项记录" },
              ]}
              onChange={(version) =>
                useRosterStore.getState().updateStudentVersion(index(), version)
              }
            />
          </Flex>
          <Disclosure
            open={detailed}
            triggerId={observationModeId}
            collapsed={renderObservations([["brief", "课堂表现"]], !detailed)}
          >
            {renderObservations(observationFields, detailed)}
          </Disclosure>
          <Typography.Text type="secondary" className="observation-shortcut">
            Ctrl + Enter 记录下一位
          </Typography.Text>
        </section>
        <section className="feedback-panel" aria-label="反馈校对">
          <Flex
            className="feedback-heading"
            justify="space-between"
            align="center"
            gap={8}
            wrap
          >
            <h3>反馈正文</h3>
            <Flex
              gap={8}
              align="center"
              wrap
              className="feedback-header-actions"
            >
              {!info.loading && canGenerate && issue && (
                <Button
                  className="inline-requirement"
                  type="link"
                  onClick={onFixIssue}
                >
                  {issue}
                </Button>
              )}
              <Button
                icon={
                  info.content ? <ReloadOutlined /> : <ThunderboltOutlined />
                }
                loading={info.loading}
                disabled={!canGenerate}
                onClick={() => (issue ? onFixIssue() : onGenerate(id))}
              >
                {info.feedbackNeedsUpdate
                  ? "更新反馈"
                  : info.content
                    ? "重新生成"
                    : "生成反馈"}
              </Button>
            </Flex>
          </Flex>
          <FeedbackBody
            info={info}
            onChange={(content) => edit(content, info.feedbackNeedsUpdate)}
          />
          {info.feedbackNeedsUpdate && info.content.trim() && !info.loading && (
            <Alert
              className="editor-feedback-notice"
              type="warning"
              showIcon
              title={updateLabels[info.feedbackNeedsUpdate]}
              description="可以更新反馈，或手动核对当前正文后继续。"
              action={
                <Button
                  size="small"
                  onClick={() => edit(info.content, undefined)}
                >
                  已按最新记录核对
                </Button>
              }
            />
          )}
          {info.generation?.errorMessage && (
            <Alert
              className="editor-feedback-notice"
              type="warning"
              showIcon
              title={info.generation.errorMessage}
              action={
                !info.loading &&
                info.content.trim() &&
                !info.feedbackNeedsUpdate && (
                  <Button
                    size="small"
                    onClick={() => edit(info.content, undefined)}
                  >
                    保留当前稿
                  </Button>
                )
              }
            />
          )}
          {!info.loading && info.generation?.quality?.issues.length ? (
            <Alert
              className="editor-feedback-notice"
              type="warning"
              showIcon
              title="请核对以下内容"
              description={info.generation.quality.issues
                .map((i) => i.message)
                .join(" ")}
            />
          ) : null}
          <Flex gap={8} wrap className="review-actions">
            <Button
              type="primary"
              icon={<CheckOutlined />}
              disabled={!isFeedbackReviewable(info)}
              onClick={() => {
                if (!info.confirmed) {
                  update({ confirmed: true });
                  onConfirmed(student.name);
                }
                onReviewNext(id);
              }}
            >
              {info.confirmed ? "下一份待校对" : "确认并下一位"}
            </Button>
            <IconButton
              label="预览与复制"
              icon={<CopyOutlined />}
              disabled={!isFeedbackReviewable(info)}
              onClick={() => onPreview(id)}
            />
            {info.previousContent && info.previousContent !== info.content && (
              <IconButton
                label="恢复上一稿"
                icon={<UndoOutlined />}
                disabled={info.loading}
                onClick={() =>
                  edit(
                    info.previousContent!,
                    info.feedbackNeedsUpdate ??
                      info.previousFeedbackNeedsUpdate,
                  )
                }
              />
            )}
          </Flex>
          {info.copiedAt && (
            <Typography.Text type="secondary">
              已复制于 {new Date(info.copiedAt).toLocaleTimeString()}
            </Typography.Text>
          )}
          {info.think_content && (
            <Collapse
              size="small"
              items={[
                {
                  key: "details",
                  label: "生成详情",
                  children: (
                    <div className="generated-details">
                      {info.think_content}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </section>
      </div>
    </Card>
  );
});
