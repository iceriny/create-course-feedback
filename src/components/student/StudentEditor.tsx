import IconButton from "../common/IconButton";
import {
  ArrowRightOutlined,
  CheckOutlined,
  CopyOutlined,
  UndoOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { statusLabel } from "../../domain/feedbackStatus";
import { memo } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Input,
  Select,
  Tag,
  Typography,
  Collapse,
} from "antd";
import { useRosterStore } from "../../store/rosterStore";
import ObservationInput from "./ObservationInput";
import { validateGeneratedFeedback } from "../../services/ai/outputValidator";

const fields = [
  ["total", "整体表现"],
  ["mastery_situation", "掌握情况"],
  ["attention", "专注度"],
  ["interaction", "互动"],
  ["other", "其他观察"],
];
interface Props {
  id: string;
  compact?: boolean;
  onGenerate: (index: number) => void;
  onNext: () => void;
  onPreview: () => void;
}
export default memo(function StudentEditor({
  id,
  compact = false,
  onGenerate,
  onNext,
  onPreview,
}: Props) {
  const student = useRosterStore((state) =>
    state.studentsList.find((s) => s.id === id),
  );
  const info = useRosterStore(
    (state) =>
      state.studentsInfo[state.studentsList.findIndex((s) => s.id === id)],
  );
  if (!student || !info) return null;
  const index = () =>
    useRosterStore.getState().studentsList.findIndex((s) => s.id === id);
  const update = (patch: Partial<typeof info>) =>
    useRosterStore.getState().updateStudentInfo(index(), patch);
  const currentFields =
    student.version === "v1" ? [["brief", "课堂表现"]] : fields;
  const setPerformance = (field: string, value: string) =>
    update({
      performance: { ...info.performance, [field]: value },
      confirmed: false,
      copiedAt: undefined,
    });
  const edit = (content: string) => {
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
      generation: {
        ...info.generation,
        quality,
        errorMessage: undefined,
        status: quality.status === "pass" ? "ready" : "needs_review",
      },
    });
  };
  return (
    <Card
      className={`student-editor ${compact ? "compact-editor" : ""}`}
      size={compact ? "small" : undefined}
      title={
        <Flex gap={12} align="center">
          <span>{student.name}</span>
          <Tag
            color={
              info.confirmed
                ? "success"
                : info.loading
                  ? "processing"
                  : "default"
            }
          >
            {statusLabel(info)}
          </Tag>
        </Flex>
      }
      extra={
        <IconButton
          label="下一位"
          icon={<ArrowRightOutlined />}
          onClick={onNext}
        />
      }
    >
      <div className="editor-columns">
        <section className="observation-panel" aria-label="课堂观察">
          <Flex gap={8} wrap className="student-preferences">
            <Select
              aria-label="学生性别"
              value={student.gender}
              disabled={info.loading}
              options={[
                { value: "male", label: "男" },
                { value: "female", label: "女" },
              ]}
              onChange={(gender) =>
                useRosterStore
                  .getState()
                  .updateStudentGender(
                    index(),
                    gender,
                    useRosterStore.getState().activeClass,
                  )
              }
            />
            <Select
              aria-label="记录方式"
              value={student.version}
              disabled={info.loading}
              options={[
                { value: "v1", label: "简要记录" },
                { value: "v2", label: "分项记录" },
              ]}
              onChange={(version) =>
                useRosterStore
                  .getState()
                  .updateStudentVersion(
                    index(),
                    version,
                    useRosterStore.getState().activeClass,
                  )
              }
            />
          </Flex>
          <div className="observation-fields">
            {currentFields.map(([field, label]) => (
              <ObservationInput
                key={field}
                id={id}
                field={field}
                label={label}
                value={info.performance?.[field] || ""}
                disabled={!info.activated || info.loading}
                compact={compact}
                onChange={(value) => setPerformance(field, value)}
                onNext={onNext}
              />
            ))}
          </div>
          <Typography.Text type="secondary">
            Ctrl + Enter 切换下一位，Shift + Enter 换行
          </Typography.Text>
        </section>
        <section className="feedback-panel" aria-label="反馈校对">
          <Flex justify="space-between" align="center">
            <h3>反馈正文</h3>
            <Button
              icon={info.content ? <ReloadOutlined /> : <ThunderboltOutlined />}
              loading={info.loading}
              disabled={!info.activated}
              onClick={() => onGenerate(index())}
            >
              {info.content ? "重新生成" : "生成反馈"}
            </Button>
          </Flex>
          {info.generation?.errorMessage && (
            <Alert
              type="warning"
              showIcon
              title={info.generation.errorMessage}
            />
          )}
          {info.loading ? (
            <div className="stream-preview" aria-live="polite">
              {info.draftContent || "正在准备反馈…"}
            </div>
          ) : (
            <Input.TextArea
              aria-label="反馈正文"
              value={info.content}
              onChange={(e) => edit(e.target.value)}
              autoSize={{
                minRows: compact ? 3 : 12,
                maxRows: compact ? 8 : 24,
              }}
              placeholder="生成后在这里校对，也可以直接撰写反馈。"
            />
          )}
          {!info.loading && info.generation?.quality?.issues.length ? (
            <Alert
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
              disabled={
                !info.content.trim() ||
                info.loading ||
                !info.activated ||
                info.generation?.status === "failed"
              }
              onClick={() => {
                update({ confirmed: true });
                onNext();
              }}
            >
              确认并下一位
            </Button>
            <IconButton
              label="预览与复制"
              icon={<CopyOutlined />}
              disabled={!info.content.trim() || info.loading}
              onClick={onPreview}
            />
            {(info.previousContent ||
              (info.generation?.status === "failed" && info.content)) && (
              <IconButton
                label="恢复上一稿"
                icon={<UndoOutlined />}
                disabled={info.loading}
                onClick={() => edit(info.previousContent || info.content)}
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
