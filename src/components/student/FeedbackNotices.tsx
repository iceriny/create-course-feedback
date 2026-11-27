import { Alert, Button, Popover } from "antd";
import { useEffect, useState } from "react";
import type { StudentsInfo } from "../../types";

const updateLabels = {
  observation: "课堂观察已更新",
  course: "课程信息已更新",
  student: "学生资料已更新",
};

export default function FeedbackNotices({
  info,
  onKeepCurrent,
}: {
  info: StudentsInfo;
  onKeepCurrent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDraft = Boolean(info.content.trim());
  const needsUpdate =
    hasDraft && !info.loading ? info.feedbackNeedsUpdate : undefined;
  const qualityIssues = info.loading
    ? []
    : (info.generation?.quality?.issues ?? []);
  const errorMessage = info.generation?.errorMessage;
  const title =
    errorMessage ||
    (needsUpdate && updateLabels[needsUpdate]) ||
    (qualityIssues.length ? "请核对以下内容" : "");
  const hasNotice = Boolean(title);
  useEffect(() => {
    if (!hasNotice) setOpen(false);
  }, [hasNotice]);
  if (!title) return null;

  const count =
    Number(Boolean(errorMessage)) +
    Number(Boolean(needsUpdate)) +
    qualityIssues.length;
  const keepCurrent = () => {
    setOpen(false);
    onKeepCurrent();
  };
  return (
    <Alert
      className="editor-feedback-notice"
      type={errorMessage && !info.loading ? "error" : "warning"}
      showIcon
      title={title}
      action={
        <Popover
          open={open}
          onOpenChange={setOpen}
          trigger="click"
          title="反馈提示"
          content={
            <div className="student-notice-details">
              {errorMessage && (
                <section>
                  <p>{errorMessage}</p>
                  {!info.loading && hasDraft && !needsUpdate && (
                    <Button size="small" onClick={keepCurrent}>
                      保留当前稿
                    </Button>
                  )}
                </section>
              )}
              {needsUpdate && (
                <section>
                  <p>
                    {updateLabels[needsUpdate]}
                    ，可以更新反馈，或手动核对当前正文后继续。
                  </p>
                  <Button size="small" onClick={keepCurrent}>
                    已按最新记录核对
                  </Button>
                </section>
              )}
              {qualityIssues.length > 0 && (
                <ul>
                  {qualityIssues.map((issue) => (
                    <li key={`${issue.code}:${issue.message}`}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          }
        >
          <Button size="small" type="text" aria-expanded={open}>
            详情{count > 1 && ` · ${count}`}
          </Button>
        </Popover>
      }
    />
  );
}
