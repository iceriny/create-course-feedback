import { CheckOutlined, EyeOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { statusLabel, type FeedbackStatus } from "../../domain/feedbackStatus";

export default function FeedbackStatusLight({
  status,
}: {
  status: FeedbackStatus;
}) {
  const label =
    status === "ready"
      ? "已生成，待校对"
      : status === "failed"
        ? "生成失败，需重试"
        : statusLabel(status);
  return (
    <Tooltip title={label} placement="right">
      <span
        className="feedback-status-light"
        data-feedback-status={status}
        aria-hidden="true"
      >
        {status === "ready" && (
          <EyeOutlined className="feedback-status-check feedback-status-review" />
        )}
        {status === "confirmed" && (
          <CheckOutlined className="feedback-status-check feedback-status-confirmed" />
        )}
      </span>
    </Tooltip>
  );
}
