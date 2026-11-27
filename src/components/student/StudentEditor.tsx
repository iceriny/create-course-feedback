import IconButton from "../common/IconButton";
import Select from "../common/Select";
import {
  ArrowRightOutlined,
  CheckOutlined,
  CopyOutlined,
  EyeOutlined,
  FileTextOutlined,
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
import { memo, useId, useRef, useState } from "react";
import {
  Button,
  Card,
  Flex,
  Popover,
  Tag,
  Typography,
  Collapse,
  Tooltip,
} from "antd";
import { useRosterStore } from "../../store/rosterStore";
import ObservationInput from "./ObservationInput";
import { validateGeneratedFeedback } from "../../services/ai/outputValidator";
import type { StudentsInfo } from "../../types";
import Disclosure from "../../motion/Disclosure";
import FeedbackBody from "./FeedbackBody";
import FeedbackNotices from "./FeedbackNotices";

interface Props {
  id: string;
  compact?: boolean;
  selected: boolean;
  issue?: string;
  onGenerate: (id: string) => void;
  onFixIssue: () => void;
  onRecordNext: (id: string) => void;
  onReviewNext: (id: string) => void;
  onConfirmed: (name: string) => void;
  onPreview: (id: string) => void;
  onCopy: (id: string) => Promise<boolean>;
}

const genderLabels = { unspecified: "性别未指定", male: "男", female: "女" };

export default memo(function StudentEditor({
  id,
  compact = false,
  selected,
  issue,
  onGenerate,
  onFixIssue,
  onRecordNext,
  onReviewNext,
  onConfirmed,
  onPreview,
  onCopy,
}: Props) {
  const student = useRosterStore((state) =>
    state.studentsList.find((s) => s.id === id),
  );
  const info = useRosterStore(
    (state) =>
      state.studentsInfo[state.studentsList.findIndex((s) => s.id === id)],
  );
  const observationModeId = useId();
  const card = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  if (!student || !info) return null;
  const index = () =>
    useRosterStore.getState().studentsList.findIndex((s) => s.id === id);
  const update = (patch: Partial<typeof info>) =>
    useRosterStore.getState().updateStudentInfo(index(), patch);
  const detailed = student.version === "v2";
  const canGenerate = canGenerateFeedback(student, info);
  const status = feedbackStatus(student, info);
  const reviewable = isFeedbackReviewable(info);
  const copiedAt = status === "confirmed" ? info.copiedAt : undefined;
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
  const copy = async () => {
    if (copying || status !== "confirmed") return;
    setCopying(true);
    try {
      await onCopy(id);
    } finally {
      setCopying(false);
    }
  };
  const preferences = (
    <Flex
      gap={compact ? 4 : 8}
      wrap={!compact}
      className="student-preferences"
      inert={compact && !selected}
    >
      <Select
        size={compact ? "small" : undefined}
        variant="filled"
        aria-label="学生性别"
        value={student.gender}
        disabled={info.loading}
        options={[
          { value: "unspecified", label: genderLabels.unspecified },
          { value: "male", label: genderLabels.male },
          { value: "female", label: genderLabels.female },
        ]}
        labelRender={
          compact
            ? ({ label, value }) => (value === "unspecified" ? "未指定" : label)
            : undefined
        }
        onChange={(gender) =>
          useRosterStore.getState().updateStudentGender(index(), gender)
        }
      />
      <Select
        size={compact ? "small" : undefined}
        variant="filled"
        id={observationModeId}
        aria-label="记录方式"
        value={student.version}
        disabled={info.loading}
        options={[
          { value: "v1", label: "简要记录" },
          { value: "v2", label: "分项记录" },
        ]}
        labelRender={
          compact
            ? ({ value }) => (value === "v2" ? "分项" : "简要")
            : undefined
        }
        onChange={(version) =>
          useRosterStore.getState().updateStudentVersion(index(), version)
        }
      />
    </Flex>
  );
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
        />
      ))}
    </div>
  );
  return (
    <Card
      ref={card}
      className="student-editor"
      data-generated={
        Boolean(
          info.think_content ||
            info.previousContent ||
            info.feedbackNeedsUpdate ||
            info.generation?.errorMessage ||
            info.generation?.quality?.issues.length,
        ) || undefined
      }
      title={
        <div className="student-card-title">
          <span className="student-name" title={student.name}>
            {student.name}
          </span>
          <Tag className="editor-feedback-status" data-feedback-status={status}>
            {statusLabel(status)}
          </Tag>
          {compact && (
            <div className="student-compact-controls" data-active={selected}>
              <span
                className="student-preferences-summary"
                aria-hidden={selected}
              >
                {genderLabels[student.gender]} · {detailed ? "分项" : "简要"}
              </span>
              {preferences}
            </div>
          )}
        </div>
      }
      extra={
        <IconButton
          type="text"
          size={compact ? "small" : undefined}
          className="student-extended-action"
          label="记录下一位"
          aria-keyshortcuts="Control+Enter Meta+Enter"
          data-workbench-action="record-next"
          icon={<ArrowRightOutlined />}
          onClick={() => onRecordNext(id)}
        />
      }
    >
      <div className="editor-columns">
        <section className="observation-panel" aria-label="课堂观察">
          {!compact && preferences}
          <Disclosure
            open={detailed}
            triggerId={observationModeId}
            collapsed={renderObservations([["brief", "课堂表现"]], !detailed)}
          >
            {renderObservations(observationFields, detailed)}
          </Disclosure>
          {!compact && (
            <Typography.Text type="secondary" className="observation-shortcut">
              Ctrl / ⌘ + Enter 记录下一位
            </Typography.Text>
          )}
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
                data-workbench-action="generate"
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
          <Flex gap={8} wrap className="review-actions">
            <Button
              type="primary"
              size={compact ? "small" : undefined}
              icon={<CheckOutlined />}
              disabled={!reviewable}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              data-workbench-action="review-next"
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
            <Tooltip
              title={
                copiedAt
                  ? `已复制于 ${new Date(copiedAt).toLocaleTimeString()}，再次复制`
                  : status === "confirmed"
                    ? "复制已确认的反馈"
                    : "确认后可直接复制"
              }
            >
              <Button
                size={compact ? "small" : undefined}
                icon={
                  copiedAt ? <CheckOutlined key="copied" /> : <CopyOutlined />
                }
                data-workbench-action="copy"
                className="editor-copy"
                data-copied={Boolean(copiedAt)}
                aria-label={copiedAt ? "已复制，再次复制反馈" : "复制反馈"}
                disabled={status !== "confirmed"}
                loading={copying}
                onClick={() => void copy()}
              >
                {copiedAt ? "已复制" : "复制反馈"}
              </Button>
            </Tooltip>
            <IconButton
              size={compact ? "small" : undefined}
              label="预览反馈"
              icon={<EyeOutlined />}
              disabled={!reviewable}
              onClick={() => onPreview(id)}
            />
            {info.previousContent && info.previousContent !== info.content && (
              <IconButton
                size={compact ? "small" : undefined}
                className="student-extended-action"
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
            {compact && info.think_content && (
              <Popover
                content={
                  <div className="generated-details student-detail-popup">
                    {info.think_content}
                  </div>
                }
                title="生成详情"
                trigger="click"
              >
                <Button
                  size="small"
                  className="student-extended-action"
                  aria-label="生成详情"
                  icon={<FileTextOutlined />}
                />
              </Popover>
            )}
          </Flex>
          <FeedbackNotices
            info={info}
            onKeepCurrent={() => {
              edit(info.content, undefined);
              card.current
                ?.querySelector<HTMLTextAreaElement>("[data-feedback-body]")
                ?.focus({ preventScroll: true });
            }}
          />
          {!compact && info.think_content && (
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
