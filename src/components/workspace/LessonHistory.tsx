import { Button, Empty, Flex, Input, Modal, Tag, Typography } from "antd";
import { useLayoutEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  feedbackStatus,
  isFeedbackReviewable,
  statusLabel,
} from "../../domain/feedbackStatus";
import type { LessonDraft } from "../../domain/lesson";
import ContentTransition from "../../motion/ContentTransition";

const lessonDate = (draft: LessonDraft) => {
  if (!draft.course.start) return "未设置时间";
  return dayjs(draft.course.start).format("YYYY-MM-DD HH:mm");
};

export default function LessonHistory({
  open,
  current,
  records,
  onClose,
  afterClose,
  onContinue,
  onReuse,
  onPreview,
}: {
  open: boolean;
  current?: LessonDraft;
  records: LessonDraft[];
  onClose: () => void;
  afterClose: () => void;
  onContinue: (draft: LessonDraft) => void;
  onReuse: (draft: LessonDraft) => void;
  onPreview: (draft: LessonDraft, index: number) => void;
}) {
  const [selected, setSelected] = useState<LessonDraft>();
  const [search, setSearch] = useState("");
  const lastLesson = useRef<string>(undefined);
  const content = useRef<HTMLDivElement>(null);
  const viewingCurrent = selected?.lessonId === current?.lessonId;
  const lessons = current
    ? [
        current,
        ...records.filter((draft) => draft.lessonId !== current.lessonId),
      ]
    : records;
  const showLesson = (draft: LessonDraft) => {
    lastLesson.current = draft.lessonId;
    setSearch("");
    setSelected(draft);
  };

  useLayoutEffect(() => {
    if (!lastLesson.current || !open) return;
    if (selected) {
      content.current
        ?.querySelector<HTMLButtonElement>(
          '[data-overlay-pane="active"] .history-back',
        )
        ?.focus();
      return;
    }
    const button = Array.from(
      content.current?.querySelectorAll<HTMLButtonElement>(
        '[data-overlay-pane="active"] [data-lesson-id]',
      ) ?? [],
    ).find((entry) => entry.dataset.lessonId === lastLesson.current);
    button?.focus();
    lastLesson.current = undefined;
  }, [open, selected]);

  return (
    <Modal
      title="历史课次"
      open={open}
      onCancel={onClose}
      afterClose={afterClose}
      footer={null}
      width={720}
    >
      <div ref={content}>
        <ContentTransition
          contentKey={selected ? `lesson-${selected.lessonId}` : "lesson-list"}
          direction={selected ? "forward" : "back"}
        >
          {selected ? (
            <div className="history-detail">
              <Button
                type="link"
                className="history-back"
                onClick={() => setSelected(undefined)}
              >
                返回课次列表
              </Button>
              <Flex align="start" justify="space-between" gap={12} wrap>
                <div>
                  <Typography.Title level={4}>
                    {selected.course.name || "未命名课程"}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {lessonDate(selected)} · {selected.studentsList.length} 人
                  </Typography.Text>
                </div>
                {viewingCurrent ? (
                  <Tag color="processing">正在编辑</Tag>
                ) : (
                  <Flex gap={8} wrap>
                    {selected.course.name.trim() && (
                      <Button onClick={() => onReuse(selected)}>
                        复用本课教案
                      </Button>
                    )}
                    <Button onClick={() => onContinue(selected)}>
                      继续编辑这节课
                    </Button>
                  </Flex>
                )}
              </Flex>
              {(selected.course.contents || selected.course.objectives) && (
                <dl className="history-course">
                  {selected.course.contents && (
                    <div>
                      <dt>课程内容</dt>
                      <dd>{selected.course.contents}</dd>
                    </div>
                  )}
                  {selected.course.objectives && (
                    <div>
                      <dt>教学目标</dt>
                      <dd>{selected.course.objectives}</dd>
                    </div>
                  )}
                </dl>
              )}
              <Input
                aria-label="查找历史学生"
                placeholder="查找历史学生"
                value={search}
                allowClear
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="history-feedback">
                {selected.studentsList.map((student, index) => {
                  if (
                    !student.name
                      .toLowerCase()
                      .includes(search.trim().toLowerCase())
                  )
                    return null;
                  const info = selected.studentsInfo[index];
                  return (
                    <section
                      key={student.id ?? index}
                      className="history-student"
                    >
                      <Flex align="center" justify="space-between" gap={8} wrap>
                        <Flex gap={8} align="center" wrap>
                          <strong>{student.name}</strong>
                          <Tag>
                            {statusLabel(feedbackStatus(student, info))}
                          </Tag>
                        </Flex>
                        {isFeedbackReviewable(info) && (
                          <Button onClick={() => onPreview(selected, index)}>
                            预览与复制
                          </Button>
                        )}
                      </Flex>
                      <p>{info.content.trim() || "暂无反馈正文"}</p>
                    </section>
                  );
                })}
                {!selected.studentsList.some((student) =>
                  student.name
                    .toLowerCase()
                    .includes(search.trim().toLowerCase()),
                ) && (
                  <Empty
                    description={search.trim() ? "没有匹配的学生" : "暂无学生"}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="archive-list">
              {lessons.map((draft) => (
                <Flex
                  key={draft.lessonId}
                  justify="space-between"
                  align="center"
                  gap={12}
                >
                  <span>
                    <strong>{draft.course.name || "未命名课程"}</strong>
                    {draft.lessonId === current?.lessonId && (
                      <Tag color="processing">正在编辑</Tag>
                    )}
                    <small>
                      {lessonDate(draft)} · {draft.studentsList.length} 人
                    </small>
                  </span>
                  <Button
                    data-lesson-id={draft.lessonId}
                    onClick={() => showLesson(draft)}
                  >
                    查看课次
                  </Button>
                </Flex>
              ))}
              {!records.length && (
                <Typography.Text type="secondary">
                  已归档的课次会在这里显示。
                </Typography.Text>
              )}
            </div>
          )}
        </ContentTransition>
      </div>
    </Modal>
  );
}
