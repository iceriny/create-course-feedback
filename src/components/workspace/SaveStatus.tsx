import { Alert, Button } from "antd";
import { flushLessonDraft, useRosterStore } from "../../store/rosterStore";

export default function SaveStatus() {
  const status = useRosterStore((s) => s.saveStatus);
  return status === "error" ? (
    <Alert
      type="error"
      title="保存失败，请备份后重试"
      action={<Button onClick={flushLessonDraft}>重试保存</Button>}
    />
  ) : (
    <span className="save-status" role="status">
      {status === "saving" ? "正在保存…" : "已保存到此设备"}
    </span>
  );
}
