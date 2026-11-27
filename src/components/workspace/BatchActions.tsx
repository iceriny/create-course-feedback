import { Button, Dropdown, Flex, type MenuProps } from "antd";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  EllipsisOutlined,
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
  feedbackStatus,
  isBatchGenerationCandidate,
  isFeedbackConfirmed,
} from "../../domain/feedbackStatus";
import { isProcessingStatus } from "./rosterStatus";
import { motionTiming, prefersReducedMotion } from "../../motion/engine";
import useNarrowWorkspace from "../../hooks/useNarrowWorkspace";
import LiquidGlass from "./LiquidGlass";

type DockAction = {
  key: "generate" | "setup" | "retry" | "stop" | "copy-next" | "copy-all";
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  run?: () => void;
  menu?: NonNullable<MenuProps["items"]>;
};

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
  const narrow = useNarrowWorkspace();
  const liveCounts = useRosterStore(
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
        busy: studentsList.some((student, index) =>
          isProcessingStatus(feedbackStatus(student, studentsInfo[index])),
        ),
        confirmed: confirmed.length,
        uncopied: confirmed.filter((info) => !info.copiedAt).length,
      };
    }),
  );
  const visible = Boolean(
    liveCounts.pending || liveCounts.busy || liveCounts.confirmed,
  );
  const [present, setPresent] = useState(visible);
  const previous = useRef(liveCounts);
  useLayoutEffect(() => {
    if (visible) {
      previous.current = liveCounts;
      setPresent(true);
      return;
    }
    if (!present) return;
    if (prefersReducedMotion()) {
      setPresent(false);
      return;
    }
    const timeout = window.setTimeout(
      () => setPresent(false),
      motionTiming("exit").duration,
    );
    return () => window.clearTimeout(timeout);
  }, [liveCounts, present, visible]);
  const counts = visible ? liveCounts : previous.current;
  const action =
    counts.updates === 0
      ? "生成反馈"
      : counts.updates === counts.pending
        ? "更新反馈"
        : "生成与更新";
  const actions: DockAction[] = [];
  if (counts.pending) {
    actions.push({
      key: "generate",
      label: action,
      icon: <ThunderboltOutlined />,
      disabled: Boolean(issues.length),
      run: () => onGenerate(),
    });
    if (issues.length) {
      actions.push({
        key: "setup",
        label:
          issues.length === 1 && !narrow ? issues[0].message : "补全生成信息",
        run: issues.length === 1 ? () => onFix(issues[0]) : undefined,
        menu:
          issues.length > 1
            ? issues.map((issue) => ({
                key: issue.field,
                label: issue.message,
                onClick: () => onFix(issue),
              }))
            : undefined,
      });
    }
  }
  if (counts.failed)
    actions.push({
      key: "retry",
      label: "重试失败项",
      icon: <ReloadOutlined />,
      disabled: Boolean(issues.length),
      run: () => onGenerate(true),
    });
  if (counts.busy)
    actions.push({
      key: "stop",
      label: narrow ? "停止" : "停止生成",
      icon: <span className="stop-playback-icon" aria-hidden="true" />,
      run: cancelGeneration,
    });
  if (counts.uncopied)
    actions.push({
      key: "copy-next",
      label: "逐人复制",
      icon: <CopyOutlined />,
      run: onCopyNext,
    });
  if (counts.confirmed)
    actions.push({
      key: "copy-all",
      label: `复制已确认（${counts.confirmed} 人）`,
      run: onCopy,
    });

  const priority: DockAction["key"][] = narrow
    ? ["copy-next", "stop", "generate", "setup", "copy-all"]
    : ["generate", "copy-next", "stop", "setup", "copy-all"];
  const primary = priority
    .map((key) => actions.find((item) => item.key === key && !item.disabled))
    .find(Boolean);
  const renderButton = (item: DockAction) => {
    const button = (
      <Button
        key={item.key}
        type={item === primary ? "primary" : "default"}
        icon={item.icon}
        disabled={item.disabled}
        className={item.key === "stop" ? "batch-stop" : undefined}
        data-copy-next={item.key === "copy-next" ? "" : undefined}
        onClick={item.run}
      >
        {item.label}
      </Button>
    );
    return item.menu ? (
      <Dropdown
        key={item.key}
        menu={{ items: item.menu }}
        trigger={["click"]}
        placement="topRight"
      >
        {button}
      </Dropdown>
    ) : (
      button
    );
  };

  return (
    <section
      className="action-bar"
      aria-label="批量操作"
      hidden={!visible && !present}
      inert={!visible}
      data-open={visible}
    >
      <LiquidGlass />
      {(counts.pending > 0 || counts.uncopied > 0) && (
        <div className="dock-summary">
          {counts.pending > 0 && <span>待处理 {counts.pending}</span>}
          {counts.uncopied > 0 && <span>待复制 {counts.uncopied}</span>}
        </div>
      )}
      {narrow && primary ? (
        <Flex gap={6} align="center">
          {renderButton(primary)}
          {actions.length > 1 && (
            <Dropdown
              placement="topRight"
              trigger={["click"]}
              menu={{
                items: actions
                  .filter((item) => item !== primary)
                  .map((item) => ({
                    key: item.key,
                    label: item.label,
                    icon: item.icon,
                    disabled: item.disabled,
                    children: item.menu,
                    onClick: item.run,
                  })),
              }}
            >
              <Button aria-label="更多批量操作" icon={<EllipsisOutlined />} />
            </Dropdown>
          )}
        </Flex>
      ) : (
        <Flex gap={6} wrap>
          {actions.map(renderButton)}
        </Flex>
      )}
    </section>
  );
}
