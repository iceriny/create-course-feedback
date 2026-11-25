import { Alert, Button, Flex, Popconfirm } from "antd";
import {
  flushLessonDraft,
  getCurrentLessonDraft,
  useRosterStore,
} from "../../store/rosterStore";
import { createLessonBackup } from "../../services/persistence/lessonRepository";
import { downloadJson } from "../../utils/storage";

export default function SaveStatus({
  onLoadLatest,
}: {
  onLoadLatest: () => void;
}) {
  const status = useRosterStore((s) => s.saveStatus);
  const activeClass = useRosterStore((s) => s.activeClass);
  const conflict = status === "conflict";
  return conflict || status === "error" ? (
    <Alert
      className="save-alert"
      type={conflict ? "warning" : "error"}
      title={conflict ? "另一页面已保存较新的草稿" : "当前草稿保存失败"}
      description={
        conflict ? "可先下载本页修改，再载入设备上的草稿。" : undefined
      }
      action={
        <Flex wrap gap={8}>
          {activeClass && (
            <Button
              onClick={() => {
                const draft = getCurrentLessonDraft();
                if (draft)
                  downloadJson(
                    createLessonBackup(draft),
                    "课程反馈当前草稿.json",
                  );
              }}
            >
              下载当前草稿
            </Button>
          )}
          {conflict ? (
            <Popconfirm
              title="载入设备上的草稿？"
              description="本页尚未保存的修改会被替换。"
              okText="载入草稿"
              cancelText="取消"
              onConfirm={onLoadLatest}
            >
              <Button>载入较新的草稿</Button>
            </Popconfirm>
          ) : (
            activeClass && <Button onClick={flushLessonDraft}>重试保存</Button>
          )}
        </Flex>
      }
    />
  ) : activeClass ? (
    <span className="save-status" data-status={status} role="status">
      {status === "saving" ? "正在保存…" : "已保存到此设备"}
    </span>
  ) : null;
}
