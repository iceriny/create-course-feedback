import { Tag } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRosterStore } from "../../store/rosterStore";
import { isFeedbackConfirmed } from "../../domain/feedbackStatus";
import "./progress-confirmation.css";

export default function ProgressBar({
  confirmation,
}: {
  confirmation?: { name: string };
}) {
  const [notice, setNotice] = useState({
    event: confirmation,
    sequence: 0,
    visible: Boolean(confirmation),
  });
  if (notice.event !== confirmation) {
    setNotice({
      event: confirmation,
      sequence: notice.sequence + 1,
      visible: Boolean(confirmation),
    });
  }
  const counts = useRosterStore(
    useShallow((state) => {
      const values = Object.values(state.studentsInfo).filter(
        (i) => i.activated,
      );
      return {
        total: values.length,
        done: values.filter(isFeedbackConfirmed).length,
        loading: values.filter((i) => i.loading).length,
        failed: values.filter((i) => i.generation?.status === "failed").length,
      };
    }),
  );
  const completion = counts.total ? counts.done / counts.total : 0;
  return (
    <div className="lesson-progress" aria-live="polite">
      <div className="progress-label" data-confirmed={notice.visible}>
        <span className="progress-label-default">本次进度</span>
        {notice.visible && (
          <span
            className="progress-confirmation"
            key={notice.sequence}
            onAnimationEnd={() =>
              setNotice((current) =>
                current.sequence === notice.sequence
                  ? { ...current, visible: false }
                  : current,
              )
            }
          >
            <CheckOutlined aria-hidden="true" />
            <span>{notice.event?.name}已确认</span>
          </span>
        )}
      </div>
      <strong>
        {counts.done}
        <span> / {counts.total} 人已确认</span>
      </strong>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="反馈确认进度"
        aria-valuenow={counts.done}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, counts.total)}
      >
        <i style={{ "--lesson-completion": completion } as CSSProperties} />
      </div>
      {counts.loading > 0 && (
        <Tag className="progress-state" color="processing">
          {counts.loading} 人生成中
        </Tag>
      )}
      {counts.failed > 0 && (
        <Tag className="progress-state" color="warning">
          {counts.failed} 人需重试
        </Tag>
      )}
    </div>
  );
}
