import { Button, Flex, Popover } from "antd";
import { useState } from "react";
import {
  ReloadOutlined,
  ThunderboltOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import { useShallow } from "zustand/react/shallow";
import { useRosterStore } from "../../store/rosterStore";
import {
  cancelGeneration,
  type GenerationIssue,
} from "../../services/ai/workspaceGeneration";
import {
  isBatchGenerationCandidate,
  isFeedbackConfirmed,
} from "../../domain/feedbackStatus";

export default function BatchActions({
  issues,
  onFix,
  onGenerate,
  onCopy,
  onCopyNext,
}: {
  issues: GenerationIssue[];
  onFix: (issue: GenerationIssue) => void;
  onGenerate: (failedOnly?: boolean) => void;
  onCopy: () => void;
  onCopyNext: () => void;
}) {
  const [showIssues, setShowIssues] = useState(false);
  const counts = useRosterStore(
    useShallow(({ studentsList, studentsInfo }) => {
      const candidates = studentsList.flatMap((student, index) =>
        isBatchGenerationCandidate(student, studentsInfo[index])
          ? [studentsInfo[index]]
          : [],
      );
      const updates = candidates.filter(
        (info) => info.feedbackNeedsUpdate,
      ).length;
      const failed = candidates.filter(
        (info) => info.generation?.status === "failed",
      ).length;
      const infos = Object.values(studentsInfo);
      const confirmed = infos.filter(isFeedbackConfirmed);
      return {
        pending: candidates.length,
        updates,
        failed,
        busy: infos.some((info) => info.loading),
        confirmed: confirmed.length,
        uncopied: confirmed.filter((info) => !info.copiedAt).length,
      };
    }),
  );
  const action =
    counts.updates === 0
      ? "生成反馈"
      : counts.updates === counts.pending
        ? "更新反馈"
        : "生成与更新";
  if (!counts.pending && !counts.busy && !counts.confirmed) return null;
  return (
    <div className="action-bar">
      <Flex gap={8} wrap>
        {counts.pending > 0 && (
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            disabled={issues.length > 0}
            onClick={() => onGenerate()}
          >
            {action}（{counts.pending} 人）
          </Button>
        )}
        {counts.pending > 0 && issues.length === 1 && (
          <Button onClick={() => onFix(issues[0])}>{issues[0].message}</Button>
        )}
        {counts.pending > 0 && issues.length > 1 && (
          <Popover
            trigger="click"
            title="生成前需补全"
            open={showIssues}
            onOpenChange={setShowIssues}
            content={
              <div className="generation-issues">
                {issues.map((issue) => (
                  <Button
                    key={issue.field}
                    type="link"
                    onClick={() => {
                      setShowIssues(false);
                      onFix(issue);
                    }}
                  >
                    {issue.message}
                  </Button>
                ))}
              </div>
            }
          >
            <Button>补全 {issues.length} 项生成信息</Button>
          </Popover>
        )}
        {counts.failed > 0 && (
          <Button
            icon={<ReloadOutlined />}
            disabled={issues.length > 0}
            onClick={() => onGenerate(true)}
          >
            重试失败项
          </Button>
        )}
        {counts.busy && (
          <Button
            className="batch-stop"
            icon={<span className="stop-playback-icon" aria-hidden="true" />}
            onClick={cancelGeneration}
          >
            停止生成
          </Button>
        )}
        {counts.uncopied > 0 && (
          <Button
            data-copy-next
            type={counts.pending ? "default" : "primary"}
            icon={<CopyOutlined />}
            onClick={onCopyNext}
          >
            逐人复制（{counts.uncopied} 人）
          </Button>
        )}
        {counts.confirmed > 0 && (
          <Button onClick={onCopy}>复制已确认（{counts.confirmed} 人）</Button>
        )}
      </Flex>
    </div>
  );
}
