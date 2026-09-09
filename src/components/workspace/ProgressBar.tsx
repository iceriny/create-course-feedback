import { Tag } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useRosterStore } from "../../store/rosterStore";

export default function ProgressBar() {
  const counts = useRosterStore(
    useShallow((state) => {
      const values = Object.values(state.studentsInfo).filter(
        (i) => i.activated,
      );
      return {
        total: values.length,
        done: values.filter((i) => i.confirmed).length,
        loading: values.filter((i) => i.loading).length,
        failed: values.filter((i) => i.generation?.status === "failed").length,
      };
    }),
  );
  return (
    <div className="lesson-progress" aria-live="polite">
      <span>本次进度</span>
      <strong>
        {counts.done}
        <span> / {counts.total} 人已确认</span>
      </strong>
      <div className="progress-track">
        <i
          style={{
            width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%`,
          }}
        />
      </div>
      {counts.loading > 0 && (
        <Tag color="processing">{counts.loading} 人生成中</Tag>
      )}
      {counts.failed > 0 && <Tag color="warning">{counts.failed} 人需重试</Tag>}
    </div>
  );
}
