import { CheckOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { RosterFilter } from "./rosterStatus";
import "./progress-confirmation.css";

export default function ProgressBar({
  confirmation,
  counts,
  filter,
  onFilter,
}: {
  confirmation?: { name: string };
  counts: { total: number; done: number; processing: number; failed: number };
  filter: RosterFilter;
  onFilter: (filter: "processing" | "failed") => void;
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
  const completion = counts.total ? counts.done / counts.total : 0;
  return (
    <div className="lesson-progress">
      <div
        className="progress-label"
        data-confirmed={notice.visible}
        aria-live="polite"
      >
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
      {counts.processing > 0 && (
        <button
          type="button"
          className="progress-state"
          data-feedback-status="generating"
          aria-pressed={filter === "processing"}
          onClick={() => onFilter("processing")}
        >
          {counts.processing} 人处理中
        </button>
      )}
      {counts.failed > 0 && (
        <button
          type="button"
          className="progress-state"
          data-feedback-status="failed"
          aria-pressed={filter === "failed"}
          onClick={() => onFilter("failed")}
        >
          {counts.failed} 人需重试
        </button>
      )}
    </div>
  );
}
