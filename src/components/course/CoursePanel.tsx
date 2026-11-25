import IconButton from "../common/IconButton";
import { DownOutlined } from "@ant-design/icons";
const CourseTimePicker = lazy(() => import("./CourseTimePicker"));
import {
  lazy,
  memo,
  Suspense,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button, Card, Flex, Input, Popconfirm } from "antd";
import Select from "../common/Select";
import dayjs from "dayjs";
import { getCourseIssues, type CourseField } from "../../domain/course";
import type { LessonCourse } from "../../domain/lesson";
import { useRosterStore } from "../../store/rosterStore";
import { useCourseStore } from "../../store/courseStore";
import { readReusableLessons } from "../../services/persistence/lessonRepository";
import Disclosure from "../../motion/Disclosure";
import "../common/editor-motion.css";

function courseFlow(frame: HTMLElement) {
  const panel = frame.closest<HTMLElement>(".course-panel");
  const slot = panel?.parentElement;
  if (!panel || !slot) return;
  const below = slot.closest(".lesson-surface")?.nextElementSibling;
  const followers: HTMLElement[] = [];
  if (below instanceof HTMLElement) {
    if (below.classList.contains("workbench")) {
      followers.push(
        ...below.querySelectorAll<HTMLElement>(
          ":scope > :is(.workbench-toolbar, .roster-panel, .editor-area, .action-bar)",
        ),
      );
    } else if (below.classList.contains("welcome-panel")) followers.push(below);
  }
  const footer = slot
    .closest(".ant-layout")
    ?.querySelector<HTMLElement>(".ant-layout-footer");
  if (footer) followers.push(footer);
  return { panel, slot, followers };
}

const CourseReuseSelect = memo(function CourseReuseSelect({
  lessonId,
}: {
  lessonId: string;
}) {
  const setCourse = useRosterStore((state) => state.setCourse);
  const [reusable, setReusable] = useState<
    ReturnType<typeof readReusableLessons>
  >([]);
  const history = useCourseStore((state) => state.history);

  const courses = reusable.map(({ lessonId, activeClass, course }) => ({
    value: `lesson:${lessonId}`,
    title: course.name,
    detail: [
      activeClass,
      course.start && dayjs(course.start).format("M月D日 HH:mm"),
    ]
      .filter(Boolean)
      .join(" · "),
    patch: {
      name: course.name,
      contents: course.contents,
      objectives: course.objectives,
    },
  }));
  const legacyCourses = Object.entries(history)
    .filter(
      ([, item]) =>
        !reusable.some(
          ({ course }) =>
            course.name === item.courseName && course.start === item.time?.[0],
        ),
    )
    .map(([key, item]) => ({
      value: `template:${key}`,
      title: item.courseName,
      detail:
        item.time && dayjs(item.time[0]).year() > 2000
          ? dayjs(item.time[0]).format("M月D日 HH:mm")
          : "",
      patch: {
        name: item.courseName,
        contents: item.courseContents.map((v) => v.item).join("\n"),
        objectives: item.courseObjectives.map((v) => v.item).join("\n"),
      },
      legacyKey: key,
    }));
  const options: {
    value: string;
    title: string;
    detail: string;
    patch: Partial<LessonCourse>;
    legacyKey?: string;
  }[] = [...courses, ...legacyCourses];

  return (
    <Select<string>
      variant="filled"
      aria-label="复用历史课程"
      placeholder="复用历史课程"
      value={null}
      popupMatchSelectWidth={false}
      onOpenChange={(open) =>
        open && setReusable(readReusableLessons(lessonId))
      }
      showSearch={{ optionFilterProp: "keywords" }}
      options={options.map(({ value, title, detail, legacyKey }) => ({
        value,
        keywords: `${title} ${detail}`,
        label: (
          <Flex align="center" justify="space-between" gap={12}>
            <div className="reuse-option">
              <strong>{title}</strong>
              {detail && <small>{detail}</small>}
            </div>
            {legacyKey && (
              <Popconfirm
                title="删除这条课程模板？"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  useCourseStore.getState().removeHistoryItem(legacyKey);
                }}
              >
                <Button
                  aria-label={`删除课程模板 ${title}`}
                  size="small"
                  type="text"
                  danger
                  onClick={(e) => e.stopPropagation()}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
          </Flex>
        ),
      }))}
      onSelect={(value) => {
        const item = options.find((option) => option.value === value);
        if (item) setCourse(item.patch);
      }}
    />
  );
});

export default memo(function CoursePanel({
  focusRequest,
}: {
  focusRequest: { field: CourseField } | null;
}) {
  const course = useRosterStore((state) => state.course);
  const lessonId = useRosterStore((state) => state.lessonId);
  const setCourse = useRosterStore((state) => state.setCourse);
  const [expanded, setExpanded] = useState(
    () => getCourseIssues(course).length > 0,
  );
  const handledRequest = useRef<typeof focusRequest>(null);
  const reveal = Boolean(
    focusRequest && handledRequest.current !== focusRequest,
  );
  const open = expanded || reveal;
  const detailsId = useId();
  const toggleId = useId();
  const fields = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!focusRequest || handledRequest.current === focusRequest) return;
    handledRequest.current = focusRequest;
    setExpanded(true);
    const field = fields.current?.querySelector<HTMLElement>(
      `[data-course-field="${focusRequest.field}"]`,
    );
    (field?.querySelector<HTMLElement>("input, textarea") || field)?.focus();
  }, [focusRequest]);

  return (
    <div className="course-slot">
      <Card
        className="course-panel"
        styles={{ body: { paddingBlock: 0 } }}
        title="本次课程"
        extra={
          <Flex gap={8}>
            <CourseReuseSelect lessonId={lessonId} />
            <IconButton
              type="text"
              label={open ? "收起课程" : "编辑课程"}
              id={toggleId}
              className="course-toggle"
              icon={<DownOutlined />}
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => setExpanded(!open)}
            />
          </Flex>
        }
      >
        <Disclosure
          retainExpanded
          flow={courseFlow}
          id={detailsId}
          open={open}
          triggerId={toggleId}
          collapsed={
            <div className="course-summary">
              <strong>{course.name || "待填写课程名称"}</strong>
              <span>
                {course.start
                  ? dayjs(course.start).format("YYYY-MM-DD HH:mm")
                  : "未设置时间"}
                {course.end ? ` – ${dayjs(course.end).format("HH:mm")}` : ""}
              </span>
              <span>
                {course.contents.split("\n").filter(Boolean).length} 项课程内容
                · {course.objectives.split("\n").filter(Boolean).length}{" "}
                项教学目标
              </span>
            </div>
          }
        >
          <div className="course-grid" ref={fields}>
            <label data-course-field="name">
              课程名称
              <Input
                variant="filled"
                value={course.name}
                placeholder="例如：循环与条件判断"
                onChange={(e) => setCourse({ name: e.target.value })}
              />
            </label>
            <div className="field" data-course-field="time" tabIndex={-1}>
              <span>授课时间</span>
              <Suspense
                fallback={
                  <span className="course-time-fallback">
                    正在加载时间选择…
                  </span>
                }
              >
                <CourseTimePicker active={open} />
              </Suspense>
            </div>
            <label data-course-field="contents">
              课程内容
              <Input.TextArea
                variant="filled"
                value={course.contents}
                rows={3}
                placeholder="每行一项课程内容"
                onChange={(e) => setCourse({ contents: e.target.value })}
              />
            </label>
            <label data-course-field="objectives">
              教学目标
              <Input.TextArea
                variant="filled"
                value={course.objectives}
                rows={3}
                placeholder="每行一项教学目标"
                onChange={(e) => setCourse({ objectives: e.target.value })}
              />
            </label>
          </div>
        </Disclosure>
      </Card>
    </div>
  );
});
