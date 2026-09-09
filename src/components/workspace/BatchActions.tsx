import { Button, Flex } from "antd";
import {
  ReloadOutlined,
  ThunderboltOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import { useShallow } from "zustand/react/shallow";
import { useRosterStore } from "../../store/rosterStore";
import {
  hasObservation,
  cancelGeneration,
} from "../../services/ai/workspaceGeneration";
import IconButton from "../common/IconButton";

export default function BatchActions({
  onGenerate,
  onCopy,
}: {
  onGenerate: (index?: number, failedOnly?: boolean) => void;
  onCopy: () => void;
}) {
  const counts = useRosterStore(
    useShallow((state) => ({
      pending: state.studentsList.filter((_, i) => {
        const info = state.studentsInfo[i];
        return (
          info.activated &&
          !info.loading &&
          (!info.content || info.generation?.status === "failed") &&
          hasObservation(i)
        );
      }).length,
      failed: Object.values(state.studentsInfo).filter(
        (info) => info.activated && info.generation?.status === "failed",
      ).length,
      busy: Object.values(state.studentsInfo).some((info) => info.loading),
      confirmed: Object.values(state.studentsInfo).filter(
        (info) => info.activated && info.confirmed && !info.loading,
      ).length,
    })),
  );
  return (
    <div className="action-bar">
      <span>先记录，再生成，最后确认</span>
      <Flex gap={8} wrap>
        <IconButton
          label="重试失败项"
          icon={<ReloadOutlined />}
          disabled={!counts.failed}
          onClick={() => onGenerate(undefined, true)}
        />
        <IconButton
          label="停止生成"
          icon={<span className="stop-playback-icon" aria-hidden="true" />}
          disabled={!counts.busy}
          onClick={cancelGeneration}
        />
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          disabled={!counts.pending}
          onClick={() => onGenerate()}
        >
          生成反馈（{counts.pending}人）
        </Button>
        <Button
          disabled={!counts.confirmed}
          icon={<CopyOutlined />}
          onClick={onCopy}
        >
          复制已确认（{counts.confirmed}人）
        </Button>
      </Flex>
    </div>
  );
}
