import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Dropdown,
  Empty,
  Flex,
  Input,
  Popconfirm,
  Popover,
  Segmented,
  Spin,
} from "antd";
import {
  CalendarOutlined,
  DesktopOutlined,
  EditOutlined,
  HistoryOutlined,
  MoonOutlined,
  PlusOutlined,
  SettingOutlined,
  SortAscendingOutlined,
  SunOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { JointContent } from "antd/es/message/interface";
import { useShallow } from "zustand/react/shallow";
import IconButton from "../common/IconButton";
import Select from "../common/Select";
import Pagination from "../common/Pagination";
import {
  selectTooltipProps,
  withoutOptionTitles,
} from "../common/selectTooltips";
import useOverlay from "../../motion/useOverlay";
import CoursePanel from "../course/CoursePanel";
import StudentEditor from "../student/StudentEditor";
import BatchActions from "./BatchActions";
import FeedbackPreview from "./FeedbackPreview";
import LessonHistory from "./LessonHistory";
import ProgressBar from "./ProgressBar";
import Roster from "./Roster";
import RosterManager from "./RosterManager";
import SaveStatus from "./SaveStatus";
import useWorkbenchDock from "./useWorkbenchDock";
import ViewportEditor from "./ViewportEditor";
import type { StudentBasicInfo } from "../../types";
import EditorStage from "../../motion/EditorStage";
import LessonSurface from "../../motion/LessonSurface";
import { prefersReducedMotion } from "../../motion/engine";
import {
  flushLessonDraft,
  getCurrentLessonDraft,
  loadLatestLessonDraft,
  useRosterStore,
} from "../../store/rosterStore";
import {
  useCourseStore,
  useFeedbackStore,
  useInputAssistantStore,
  useSettingsStore,
} from "../../store";
import { useAppearanceStore } from "../../store/appearanceStore";
import {
  getCourseIssues,
  lessonCourseContext,
  type CourseField,
} from "../../domain/course";
import type { LessonDraft } from "../../domain/lesson";
import {
  feedbackStatus,
  isBatchGenerationCandidate,
  isFeedbackConfirmed,
  isFeedbackReviewable,
  type FeedbackStatus,
} from "../../domain/feedbackStatus";
import {
  buildFeedbackBatchMarkdown,
  buildStudentFeedbackMarkdown,
  getFeedbackTemplateIssues,
} from "../../services/feedback/feedbackTemplate";
import {
  cancelGeneration,
  generateFeedback,
  getGenerationIssues,
  type AiSetupField,
  type GenerationIssue,
} from "../../services/ai/workspaceGeneration";
import { readArchivedLessons } from "../../services/persistence/lessonRepository";

const SettingsDrawer = lazy(() => import("../settings/SettingsDrawer"));
const TemplateEditor = lazy(() => import("../settings/TemplateEditor"));

interface Props {
  sendMessage: (content: JointContent) => void;
  sendWarning: (content: JointContent) => void;
}

type FocusTarget = "card" | "observation" | "feedback";
type Filter = FeedbackStatus | "all" | "uncopied";
const pageSizes = [6, 10, 16, 24, 50];
const pageSizeChoices = pageSizes.map((value) => ({
  value,
  label: `每页 ${value} 人`,
}));
const paginationSizeChanger = {
  ...selectTooltipProps,
  options: withoutOptionTitles(
    pageSizes.map((value) => ({ value, label: `${value} 条/页` })),
  ),
};
type Preview = {
  markdown: string;
  detail: string;
  lessonId?: string;
  studentIds: string[];
  singleId?: string;
  sequential?: boolean;
};

function savedStudent(lessonId: string) {
  try {
    return localStorage.getItem(`lessonSelection:${lessonId}`) ?? "";
  } catch {
    return "";
  }
}

function pendingCopy(exclude?: string) {
  const { studentsList, studentsInfo } = useRosterStore.getState();
  const selectedIndex = studentsList.findIndex(
    (student) => student.id === exclude,
  );
  return [
    ...studentsList.slice(selectedIndex + 1),
    ...studentsList.slice(0, selectedIndex + 1),
  ].find((student) => {
    const info = studentsInfo[studentsList.indexOf(student)];
    return (
      student.id !== exclude && isFeedbackConfirmed(info) && !info.copiedAt
    );
  })?.id;
}

export default function MainUI({ sendMessage, sendWarning }: Props) {
  const activeClass = useRosterStore((state) => state.activeClass);
  const lessonId = useRosterStore((state) => state.lessonId);
  const course = useRosterStore((state) => state.course);
  const students = useRosterStore((state) => state.studentsList);
  const workbenchRef = useWorkbenchDock(
    lessonId,
    Boolean(activeClass && students.length),
  );
  const statuses = useRosterStore(
    useShallow(({ studentsList, studentsInfo }) =>
      studentsList.map((student, index) => {
        const info = studentsInfo[index];
        const status = feedbackStatus(student, info);
        return status === "confirmed" && info.copiedAt ? "copied" : status;
      }),
    ),
  );
  const settings = useSettingsStore();
  const feedback = useFeedbackStore();
  const classes = useCourseStore((state) => state.classList);
  const appearance = useAppearanceStore();
  const [compact, setCompact] = useState(
    () => localStorage.getItem("editorMode") === "compact",
  );
  const [pageSize, setPageSize] = useState(6);
  const [selected, setSelected] = useState<{ lessonId: string; id: string }>();
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [confirmation, setConfirmation] = useState<{
    name: string;
    lessonId: string;
  }>();
  const onConfirmed = useCallback((name: string) => {
    setConfirmation({ name, lessonId: useRosterStore.getState().lessonId });
  }, []);
  const [navigationTarget, setNavigationTarget] = useState<{
    id: string;
    target: FocusTarget;
    lessonId: string;
  }>();
  const [classInput, setClassInput] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);
  const settingsDrawer = useOverlay<{ field?: AiSetupField }>();
  const templateEditor = useOverlay<true>();
  const { show: openSettings } = settingsDrawer;
  const { show: showTemplate } = templateEditor;
  const settingsReturnStudent = useRef<string>(undefined);
  const showSettings = useCallback(
    (content: { field?: AiSetupField }) => {
      settingsReturnStudent.current = undefined;
      openSettings(content);
    },
    [openSettings],
  );
  const templateAfterHistory = useRef(false);
  const [openRoster, setOpenRoster] = useState(false);
  const history = useOverlay<{
    current: ReturnType<typeof getCurrentLessonDraft>;
    records: LessonDraft[];
  }>();
  const previewDialog = useOverlay<Preview>();
  const { show: setPreview } = previewDialog;
  const preview = previewDialog.overlay?.content;
  const [format, setFormat] = useState<"plain" | "markdown">("plain");
  const [courseFocus, setCourseFocus] = useState<{ field: CourseField } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const issues = getGenerationIssues(course);

  const lastStudent = useMemo(() => savedStudent(lessonId), [lessonId]);
  const preferredId =
    selected?.lessonId === lessonId ? selected.id : lastStudent;
  const entries = useMemo(
    () =>
      students.map((student, index) => ({
        student,
        index,
        status:
          statuses[index] === "copied"
            ? ("confirmed" as const)
            : (statuses[index] as FeedbackStatus),
        copied: statuses[index] === "copied",
      })),
    [students, statuses],
  );
  const visible = useMemo(
    () =>
      entries.filter(
        ({ student, status, copied }) =>
          student.name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (filter === "all" ||
            (filter === "uncopied"
              ? status === "confirmed" && !copied
              : filter === status)),
      ),
    [entries, search, filter],
  );
  const current =
    visible.find(({ student }) => student.id === preferredId) ?? visible[0];
  const currentId = current?.student.id ?? "";
  const resumeFeedback =
    current &&
    (["ready", "confirmed", "needs_update"] as const).some(
      (status) => status === current.status,
    );
  const resumeLabel =
    current?.status === "confirmed"
      ? "查看反馈"
      : resumeFeedback
        ? "继续校对"
        : current && ["unrecorded", "recorded"].includes(current.status)
          ? "继续记录"
          : "查看学生";
  const currentOffset = current ? visible.indexOf(current) : -1;
  const compactPage = Math.max(1, Math.floor(currentOffset / pageSize) + 1);
  const compactEntries = visible.slice(
    (compactPage - 1) * pageSize,
    compactPage * pageSize,
  );
  const displayed = compact ? compactEntries : current ? [current] : [];
  const clearFilters = useCallback(() => {
    setSearch("");
    setFilter("all");
  }, []);

  const rememberStudent = useCallback((id: string) => {
    const { lessonId } = useRosterStore.getState();
    setSelected((previous) =>
      previous?.id === id && previous.lessonId === lessonId
        ? previous
        : { id, lessonId },
    );
    try {
      if (savedStudent(lessonId) !== id)
        localStorage.setItem(`lessonSelection:${lessonId}`, id);
    } catch {
      /* The student can still be selected when browser storage is full. */
    }
  }, []);

  const navigateStudent = useCallback(
    (id: string, target: FocusTarget = "card") => {
      rememberStudent(id);
      setNavigationTarget({
        id,
        target,
        lessonId: useRosterStore.getState().lessonId,
      });
    },
    [rememberStudent],
  );

  useLayoutEffect(() => {
    if (navigationTarget?.lessonId !== lessonId) return;
    const card = cards.current.get(navigationTarget.id);
    if (!card) return;
    const selector =
      navigationTarget.target === "feedback"
        ? "[data-feedback-body]"
        : "[data-observation]";
    const target =
      navigationTarget.target === "card"
        ? card
        : (card.querySelector<HTMLElement>(selector) ?? card);
    target.focus({ preventScroll: true });
    const workbench = workbenchRef.current;
    const toolbar = workbench?.querySelector(".workbench-toolbar");
    const toolbarStyle = toolbar && getComputedStyle(toolbar);
    const inset =
      toolbar && toolbarStyle?.position === "sticky"
        ? toolbar.clientHeight + Number.parseFloat(toolbarStyle.top) + 12
        : 0;
    const isCard = navigationTarget.target === "card";
    const actionBar = isCard ? workbench?.querySelector(".action-bar") : null;
    const reveal = () => {
      const rect = target.getBoundingClientRect();
      const bar = actionBar?.getBoundingClientRect();
      const visibleBottom =
        bar && bar.bottom > 0 ? Math.min(innerHeight, bar.top) : innerHeight;
      if (rect.top >= inset - 1 && rect.bottom <= visibleBottom - 8) return 0;
      const top = isCard
        ? inset
        : Math.max(inset, (innerHeight + inset - rect.height) / 2);
      const offset = window.scrollY;
      const page = document.scrollingElement;
      const end = Math.max(
        0,
        (page?.scrollHeight ?? innerHeight) - innerHeight,
      );
      const destination = Math.min(end, Math.max(0, offset + rect.top - top));
      const distance = Math.abs(destination - offset);
      if (distance <= 1) return 0;
      window.scrollTo({
        top: destination,
        behavior: prefersReducedMotion() ? "instant" : "smooth",
      });
      return distance;
    };
    const distance = reveal();
    if (!distance || prefersReducedMotion()) return;
    const stage =
      distance >= innerHeight
        ? card.closest(".editor-stage.compact-grid")
        : null;
    stage?.setAttribute("data-navigation-scrolling", "");
    const controller = new AbortController();
    let settleTimer: number;
    let canRetry = Boolean(stage);
    const cancel = () => {
      controller.abort();
      window.clearTimeout(settleTimer);
      stage?.removeAttribute("data-navigation-scrolling");
    };
    // Allow for late geometry updates and browsers without scrollend.
    const finish = () => {
      const remaining = target.isConnected ? reveal() : 0;
      if (canRetry && remaining >= innerHeight && !prefersReducedMotion()) {
        canRetry = false;
        scheduleFinish(1200);
        return;
      }
      cancel();
    };
    const scheduleFinish = (delay: number) => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(finish, delay);
    };
    scheduleFinish(1200);
    if (stage) {
      window.addEventListener("scroll", () => scheduleFinish(150), {
        passive: true,
        signal: controller.signal,
      });
    }
    window.addEventListener("scrollend", finish, {
      signal: controller.signal,
    });
    window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .addEventListener("change", finish, {
        once: true,
        signal: controller.signal,
      });
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"])
      window.addEventListener(type, cancel, {
        once: true,
        passive: true,
        signal: controller.signal,
      });
    return cancel;
  }, [lessonId, navigationTarget, workbenchRef]);

  useEffect(() => {
    void useInputAssistantStore.getState().loadV1Suggestions();
    void useInputAssistantStore.getState().loadV2CustomOptions();
    return () => {
      cancelGeneration();
      flushLessonDraft();
    };
  }, []);
  useEffect(() => {
    cancelGeneration();
  }, [lessonId]);

  const switchClass = (name: string) => {
    if (!useRosterStore.getState().loadStudentsFromStorage(name)) return;
    useCourseStore.getState().hydrateCourseState();
    setClassInput("");
    setCreatingClass(false);
    setCourseFocus(null);
    clearFilters();
  };
  const fixIssue = useCallback(
    (issue: GenerationIssue) => {
      if (issue.section === "settings") showSettings({ field: issue.field });
      else setCourseFocus({ field: issue.field });
    },
    [showSettings],
  );
  const fixFirstIssue = useCallback(() => {
    const [issue] = getGenerationIssues();
    if (issue) fixIssue(issue);
  }, [fixIssue]);

  const generate = useCallback(
    (studentId?: string, failedOnly = false) => {
      const issue = getGenerationIssues()[0];
      if (issue) {
        fixIssue(issue);
        return;
      }
      const { studentsList, studentsInfo } = useRosterStore.getState();
      const indices = studentsList.flatMap((student, index) => {
        const info = studentsInfo[index];
        const included = studentId
          ? student.id === studentId
          : isBatchGenerationCandidate(student, info) &&
            (!failedOnly || info.generation?.status === "failed");
        return included ? [index] : [];
      });
      try {
        const count = generateFeedback(indices);
        if (count) sendMessage(`已开始生成 ${count} 人的反馈。`);
      } catch (error) {
        sendWarning((error as Error).message);
      }
    },
    [fixIssue, sendMessage, sendWarning],
  );

  const nextStudent = useCallback(
    (fromId: string, target: "observation" | "feedback") => {
      const { studentsList, studentsInfo } = useRosterStore.getState();
      const from = studentsList.findIndex((student) => student.id === fromId);
      const ordered = [
        ...studentsList.slice(from + 1),
        ...studentsList.slice(0, Math.max(0, from)),
      ];
      const student = ordered.find((entry) => {
        const status = feedbackStatus(
          entry,
          studentsInfo[studentsList.indexOf(entry)],
        );
        return status === (target === "observation" ? "unrecorded" : "ready");
      });
      if (student?.id) {
        if (
          search ||
          (filter !== "all" &&
            filter !== (target === "observation" ? "unrecorded" : "ready"))
        )
          clearFilters();
        navigateStudent(student.id, target);
        return;
      }
      if (target === "observation") {
        sendMessage("没有其他待记录的学生。");
        return;
      }
      const active = Object.values(studentsInfo).filter(
        (info) => info.activated,
      );
      sendMessage(
        active.every(isFeedbackConfirmed)
          ? "本次反馈已全部确认。"
          : "暂时没有其他待校对的反馈。",
      );
      if (pendingCopy())
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>("[data-copy-next]")?.focus(),
        );
    },
    [clearFilters, filter, navigateStudent, search, sendMessage],
  );

  const recordNext = useCallback(
    (id: string) => nextStudent(id, "observation"),
    [nextStudent],
  );
  const reviewNext = useCallback(
    (id: string) => nextStudent(id, "feedback"),
    [nextStudent],
  );

  const showPreview = useCallback(
    (studentId?: string, sequential = false) => {
      const { activeClass, course, studentsList, studentsInfo, lessonId } =
        useRosterStore.getState();
      const issue = getCourseIssues(course)[0];
      const context = lessonCourseContext(activeClass, course);
      if (issue || !context) {
        if (issue) {
          sendWarning(`预览前请先${issue.message}。`);
          fixIssue({ ...issue, section: "course" });
        }
        return;
      }
      const { customTemplate, signature } = useFeedbackStore.getState();
      const templateIssue = getFeedbackTemplateIssues(customTemplate)[0];
      if (templateIssue) {
        sendWarning(templateIssue);
        showTemplate(true);
        return;
      }
      const input = { courseContext: context, customTemplate, signature };
      if (studentId) {
        const index = studentsList.findIndex(
          (student) => student.id === studentId,
        );
        const info = studentsInfo[index];
        if (!isFeedbackReviewable(info)) return;
        const student = studentsList[index];
        setPreview({
          markdown: buildStudentFeedbackMarkdown({
            ...input,
            student,
            studentInfo: info,
          }),
          detail: student.name,
          lessonId,
          studentIds: [studentId],
          singleId: studentId,
          sequential,
        });
        return;
      }
      const studentIds = studentsList
        .filter((_, index) => isFeedbackConfirmed(studentsInfo[index]))
        .map((student) => student.id!);
      if (!studentIds.length) return;
      setPreview({
        markdown: buildFeedbackBatchMarkdown({
          ...input,
          students: studentsList,
          studentsInfo,
          onlyReadyAndActivated: true,
          onlyConfirmed: true,
        }),
        detail: `${studentIds.length} 份已确认反馈`,
        lessonId,
        studentIds,
      });
    },
    [fixIssue, sendWarning, setPreview, showTemplate],
  );

  const previewArchivedStudent = (draft: LessonDraft, index: number) => {
    const student = draft.studentsList[index];
    const info = draft.studentsInfo[index];
    const context = lessonCourseContext(draft.activeClass, draft.course);
    const { customTemplate, signature } = feedback;
    const templateIssue =
      context && getFeedbackTemplateIssues(customTemplate)[0];
    if (templateIssue) {
      sendWarning(templateIssue);
      templateAfterHistory.current = true;
      history.close();
      return;
    }
    setPreview({
      markdown: context
        ? buildStudentFeedbackMarkdown({
            courseContext: context,
            student,
            studentInfo: info,
            customTemplate,
            signature,
          })
        : `### ${student.name}\n${info.content}`,
      detail: `${student.name} · ${draft.course.name || "未命名课程"}`,
      studentIds: [],
    });
  };

  const copied = (advance: boolean) => {
    if (!preview) return;
    const state = useRosterStore.getState();
    if (state.lessonId === preview.lessonId) {
      const copiedAt = new Date().toISOString();
      preview.studentIds.forEach((id) => {
        const index = state.studentsList.findIndex(
          (student) => student.id === id,
        );
        if (index >= 0 && isFeedbackReviewable(state.studentsInfo[index]))
          state.updateStudentInfo(index, { copiedAt });
      });
    }
    sendMessage("已复制反馈。");
    if (!advance) return;
    const target = pendingCopy(preview.singleId);
    if (target) showPreview(target, true);
    else previewDialog.close();
  };

  const afterLessonChange = () => {
    setCourseFocus(null);
    clearFilters();
  };

  const newClassControls = (
    <Flex gap={8} className="new-class-controls">
      <Input
        aria-label="新班级名称"
        value={classInput}
        onChange={(event) => setClassInput(event.target.value)}
        placeholder="新班级名称"
        autoFocus={Boolean(activeClass)}
        onPressEnter={() => classInput.trim() && switchClass(classInput)}
      />
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={!classInput.trim()}
        onClick={() => switchClass(classInput)}
      >
        创建班级
      </Button>
    </Flex>
  );

  const editor = (student: StudentBasicInfo, isCompact: boolean) => {
    const id = student.id!;
    return (
      <div
        key={id}
        data-student-id={id}
        data-current-editor={id === currentId}
        className={`student-card-anchor ${isCompact ? "compact-editor" : "single-editor"}`}
        tabIndex={-1}
        aria-label={`${student.name}的详情`}
        ref={(node) => {
          if (node) cards.current.set(id, node);
          else cards.current.delete(id);
        }}
        onFocusCapture={() => rememberStudent(id)}
      >
        <div className="editor-backplate" aria-hidden="true" />
        <ViewportEditor
          defer={isCompact && compactEntries.length > 2}
          selected={id === currentId}
          detailed={student.version === "v2"}
          name={student.name}
        >
          <StudentEditor
            id={id}
            issue={issues[0]?.message}
            onGenerate={generate}
            onFixIssue={fixFirstIssue}
            onPreview={showPreview}
            onRecordNext={recordNext}
            onReviewNext={reviewNext}
            onConfirmed={onConfirmed}
          />
        </ViewportEditor>
      </div>
    );
  };

  return (
    <div className="workspace">
      <div className="workspace-heading">
        <h1 key={activeClass}>{activeClass || "开始本次课的反馈"}</h1>
        <Flex gap={8} wrap>
          <Dropdown
            trigger={["click"]}
            menu={{
              selectedKeys: [appearance.mode],
              items: [
                { key: "system", label: "跟随系统", icon: <DesktopOutlined /> },
                { key: "light", label: "浅色模式", icon: <SunOutlined /> },
                { key: "dark", label: "暗色模式", icon: <MoonOutlined /> },
              ],
              onClick: ({ key }) =>
                appearance.setMode(key as "system" | "light" | "dark"),
            }}
          >
            <IconButton
              label="切换外观"
              icon={
                <span key={appearance.mode} className="appearance-icon">
                  {appearance.mode === "system" ? (
                    <DesktopOutlined />
                  ) : appearance.mode === "dark" ? (
                    <MoonOutlined />
                  ) : (
                    <SunOutlined />
                  )}
                </span>
              }
            />
          </Dropdown>
          <Button icon={<EditOutlined />} onClick={() => showTemplate(true)}>
            反馈模板
          </Button>
          <IconButton
            label="设置"
            icon={<SettingOutlined />}
            onClick={() => showSettings({})}
          />
        </Flex>
      </div>
      <div className={activeClass ? "class-bar active-class-bar" : "class-bar"}>
        {(activeClass || classes.length > 0) && (
          <Select
            aria-label="切换班级"
            value={activeClass || undefined}
            placeholder="选择班级"
            onChange={switchClass}
            options={Array.from(
              new Set([...classes, activeClass].filter(Boolean)),
            ).map((value) => ({ value, label: value }))}
          />
        )}
        {!activeClass && newClassControls}
        {activeClass && (
          <Flex className="lesson-actions" gap={8}>
            <Popconfirm
              title="保存本次记录并开始新一课？"
              description="学生名单保留，新课从空白的课堂记录开始。"
              onConfirm={() => {
                if (useRosterStore.getState().newLesson()) afterLessonChange();
              }}
            >
              <Button icon={<CalendarOutlined />}>开始新课</Button>
            </Popconfirm>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => {
                templateAfterHistory.current = false;
                history.show({
                  current: getCurrentLessonDraft(),
                  records: readArchivedLessons(activeClass),
                });
              }}
            >
              历史课次
            </Button>
          </Flex>
        )}
        {activeClass && (
          <Popover
            trigger="click"
            placement="bottomLeft"
            open={creatingClass}
            onOpenChange={setCreatingClass}
            content={newClassControls}
          >
            <IconButton
              className="new-class-trigger"
              label="新建班级"
              tooltipClassName="new-class-tooltip"
              icon={<PlusOutlined />}
            >
              <span>新建班级</span>
            </IconButton>
          </Popover>
        )}
      </div>
      <SaveStatus
        onLoadLatest={() => {
          cancelGeneration();
          if (loadLatestLessonDraft()) afterLessonChange();
        }}
      />
      <LessonSurface lesson={activeClass ? lessonId : ""}>
        {!activeClass ? (
          <div className="welcome-panel">
            <Empty description="创建班级后即可添加学生名单。" />
          </div>
        ) : (
          <CoursePanel key={lessonId} focusRequest={courseFocus} />
        )}
      </LessonSurface>
      {activeClass &&
        (students.length > 0 ? (
          <>
            <div className="workbench" ref={workbenchRef} key={activeClass}>
              <span className="workbench-threshold" aria-hidden="true" />
              <div className="workbench-toolbar">
                <div className="view-toolbar">
                  <Segmented
                    aria-label="编辑布局"
                    value={compact ? "compact" : "single"}
                    options={[
                      { value: "single", label: "逐人编辑", title: "" },
                      { value: "compact", label: "多人编辑", title: "" },
                    ]}
                    onChange={(value) => {
                      setCompact(value === "compact");
                      try {
                        localStorage.setItem("editorMode", value);
                      } catch {
                        /* Layout still changes in this session. */
                      }
                    }}
                  />
                  <span hidden={!compact}>
                    <Select
                      aria-label="每页人数"
                      value={pageSize}
                      options={pageSizeChoices}
                      onChange={setPageSize}
                    />
                  </span>
                  {currentId && (
                    <Button
                      className="resume-student"
                      onClick={() =>
                        navigateStudent(
                          currentId,
                          resumeFeedback
                            ? "feedback"
                            : resumeLabel === "继续记录"
                              ? "observation"
                              : "card",
                        )
                      }
                    >
                      {resumeLabel} {current.student.name}
                    </Button>
                  )}
                </div>
                <ProgressBar
                  confirmation={
                    confirmation?.lessonId === lessonId
                      ? confirmation
                      : undefined
                  }
                />
              </div>
              <aside className="roster-panel">
                <div className="roster-panel-content">
                  <Flex
                    justify="space-between"
                    align="center"
                    className="roster-heading"
                  >
                    <h2>
                      学生 <span>{students.length}</span>
                    </h2>
                    <Flex gap={4}>
                      <IconButton
                        type="text"
                        icon={<SortAscendingOutlined />}
                        label="按姓名排序"
                        onClick={useRosterStore.getState().sortStudentsByName}
                      />
                      <IconButton
                        type="text"
                        label="管理名单"
                        icon={<TeamOutlined />}
                        onClick={() => setOpenRoster(true)}
                      />
                    </Flex>
                  </Flex>
                  <Roster
                    entries={visible}
                    selected={currentId}
                    onSelect={navigateStudent}
                    filter={filter}
                    setFilter={setFilter}
                    search={search}
                    setSearch={setSearch}
                  />
                  <Button
                    className="invert-participation"
                    type="text"
                    onClick={() =>
                      useRosterStore.getState().toggleAllStudentsActivation()
                    }
                  >
                    反转参与选择
                  </Button>
                </div>
              </aside>
              <div className="editor-area">
                <EditorStage
                  key={lessonId}
                  compact={compact && Boolean(currentId)}
                  cursor={current?.index ?? -1}
                  navigation={navigationTarget}
                  neighbors={
                    compact
                      ? []
                      : [visible[currentOffset + 1], visible[currentOffset - 1]]
                          .filter(Boolean)
                          .map(({ student }) => editor(student, false))
                  }
                  revision={JSON.stringify([
                    compact,
                    ...displayed.map(({ student }) => student.id),
                  ])}
                  cards={
                    currentId
                      ? displayed.map(({ student }) => editor(student, compact))
                      : [
                          <div
                            key="empty"
                            data-current-editor="true"
                            className="editor-empty"
                          >
                            <Empty description="没有符合条件的学生">
                              <Button onClick={clearFilters}>清除筛选</Button>
                            </Empty>
                          </div>,
                        ]
                  }
                />
                {visible.length > pageSize && (
                  <div hidden={!compact}>
                    <Pagination
                      current={compactPage}
                      pageSize={pageSize}
                      total={visible.length}
                      showSizeChanger={paginationSizeChanger}
                      pageSizeOptions={pageSizes}
                      onChange={(page, size) => {
                        const id =
                          visible[(page - 1) * size]?.student.id ?? currentId;
                        setPageSize(size);
                        navigateStudent(id);
                      }}
                    />
                  </div>
                )}
              </div>
              <BatchActions
                key={lessonId}
                issues={issues}
                onFix={fixIssue}
                onGenerate={(failedOnly) => generate(undefined, failedOnly)}
                onCopy={() => showPreview()}
                onCopyNext={() => {
                  const next = pendingCopy();
                  if (next) showPreview(next, true);
                }}
              />
            </div>
          </>
        ) : (
          <div className="welcome-panel">
            <Empty description="添加学生后，开始记录课堂表现">
              <Button type="primary" onClick={() => setOpenRoster(true)}>
                添加学生
              </Button>
            </Empty>
          </div>
        ))}
      {history.overlay && (
        <LessonHistory
          open={history.overlay.open}
          current={history.overlay.content.current}
          records={history.overlay.content.records}
          onClose={history.close}
          afterClose={() => {
            history.afterClose();
            if (!templateAfterHistory.current || history.overlay?.open) return;
            templateAfterHistory.current = false;
            showTemplate(true);
          }}
          onContinue={(draft) => {
            if (!useRosterStore.getState().restoreLesson(draft)) {
              history.close();
              return;
            }
            afterLessonChange();
            history.close();
          }}
          onReuse={({ course }) => {
            useRosterStore.getState().setCourse({
              name: course.name,
              contents: course.contents,
              objectives: course.objectives,
            });
            history.close();
            sendMessage("已复用教案。");
          }}
          onPreview={previewArchivedStudent}
        />
      )}
      <RosterManager
        open={openRoster}
        onClose={() => setOpenRoster(false)}
        onAdded={(id) => {
          clearFilters();
          navigateStudent(id, "observation");
        }}
      />
      {previewDialog.overlay && preview && (
        <FeedbackPreview
          open={previewDialog.overlay.open}
          afterClose={previewDialog.afterClose}
          markdown={preview.markdown}
          detail={preview.detail}
          contentKey={preview.singleId ?? preview.detail}
          format={format}
          setFormat={setFormat}
          continuation={
            preview.singleId && pendingCopy(preview.singleId)
              ? "next"
              : preview.sequential
                ? "finish"
                : undefined
          }
          onClose={previewDialog.close}
          onCopied={copied}
          onCopyError={() => sendWarning("已选中预览内容，可以手动复制。")}
        />
      )}
      {settingsDrawer.overlay && (
        <Suspense fallback={<Spin fullscreen />}>
          <SettingsDrawer
            open={settingsDrawer.overlay.open}
            onClose={settingsDrawer.close}
            afterClose={() => {
              settingsDrawer.afterClose();
              if (settingsDrawer.overlay?.open) return;
              const id = settingsReturnStudent.current;
              settingsReturnStudent.current = undefined;
              if (id) navigateStudent(id);
            }}
            model={settings.model}
            setModel={(model) => useSettingsStore.setState({ model })}
            focusField={settingsDrawer.overlay.content.field}
            onConnected={() => {
              settingsReturnStudent.current = currentId;
              settingsDrawer.close();
            }}
            promptItems={settings.promptItems}
            setPromptItems={settings.setPromptItems}
            promptKey={settings.promptKey}
            setPromptKey={settings.setPromptKey}
            savePromptItems={settings.savePromptItems}
            sendMessage={sendMessage}
          />
        </Suspense>
      )}
      {templateEditor.overlay && (
        <Suspense fallback={<Spin fullscreen />}>
          <TemplateEditor
            isOpen={templateEditor.overlay.open}
            onClose={templateEditor.close}
            afterClose={templateEditor.afterClose}
            onSave={(template, signature) => {
              feedback.setFeedbackTemplate(template, signature);
              templateEditor.close();
            }}
            initialTemplate={feedback.customTemplate}
            initialSignature={feedback.signature}
            sendMessage={sendMessage}
          />
        </Suspense>
      )}
    </div>
  );
}
