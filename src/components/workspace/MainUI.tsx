import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Empty, Flex, Spin } from "antd";
import { SortAscendingOutlined, TeamOutlined } from "@ant-design/icons";
import type { JointContent } from "antd/es/message/interface";
import { useShallow } from "zustand/react/shallow";
import IconButton from "../common/IconButton";
import useOverlay from "../../motion/useOverlay";
import CoursePanel from "../course/CoursePanel";
import StudentEditor from "../student/StudentEditor";
import BatchActions from "./BatchActions";
import FeedbackPreview from "./FeedbackPreview";
import LessonHistory from "./LessonHistory";
import WorkspaceHeader, { CreateClassForm } from "./WorkspaceHeader";
import WorkbenchToolbar, {
  MobileStudentNavigation,
  WorkbenchPagination,
  WorkbenchShortcutHelp,
} from "./WorkbenchToolbar";
import useStudentNavigation from "./useStudentNavigation";
import useWorkbenchShortcuts, {
  useMobileStudentSwipe,
} from "./useWorkbenchShortcuts";
import useFeedbackCopyFlow, {
  pendingFeedbackCopyIds,
} from "./useFeedbackCopyFlow";
import {
  countRosterStatuses,
  matchesRosterFilter,
  type RosterEntry,
  type RosterFilter,
} from "./rosterStatus";
import Roster from "./Roster";
import RosterManager from "./RosterManager";
import SaveStatus from "./SaveStatus";
import useWorkbenchDock from "./useWorkbenchDock";
import ViewportEditor from "./ViewportEditor";
import type { StudentBasicInfo } from "../../types";
import EditorStage from "../../motion/EditorStage";
import LessonSurface from "../../motion/LessonSurface";
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
import type { CourseField } from "../../domain/course";
import type { LessonDraft } from "../../domain/lesson";
import {
  feedbackStatus,
  isBatchGenerationCandidate,
  isFeedbackConfirmed,
  type FeedbackStatus,
} from "../../domain/feedbackStatus";
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
  const [compact, setCompact] = useState(
    () => localStorage.getItem("editorMode") === "compact",
  );
  const [pageSize, setPageSize] = useState(6);
  const {
    cards,
    preferredId,
    rememberStudent,
    navigateStudent,
    navigationTarget,
  } = useStudentNavigation(lessonId, workbenchRef);
  const [focusedCard, setFocusedCard] = useState<{
    lessonId: string;
    id: string;
  }>();
  const [confirmation, setConfirmation] = useState<{
    name: string;
    lessonId: string;
  }>();
  const onConfirmed = useCallback((name: string) => {
    setConfirmation({ name, lessonId: useRosterStore.getState().lessonId });
  }, []);
  const settingsDrawer = useOverlay<{ field?: AiSetupField }>();
  const templateEditor = useOverlay<true>();
  const { show: openSettings } = settingsDrawer;
  const { show: showTemplate } = templateEditor;
  const openFeedbackTemplate = useCallback(
    () => showTemplate(true),
    [showTemplate],
  );
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
  const shortcutHelp = useOverlay<true>();
  const [courseFocus, setCourseFocus] = useState<{ field: CourseField } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const issues = getGenerationIssues(course);

  const entries = useMemo<RosterEntry[]>(
    () =>
      students.map((student, index) => ({
        student,
        index,
        status:
          statuses[index] === "copied"
            ? "confirmed"
            : (statuses[index] as FeedbackStatus),
        copied: statuses[index] === "copied",
      })),
    [students, statuses],
  );
  const matchingSearch = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? entries.filter(({ student }) =>
          student.name.toLowerCase().includes(query),
        )
      : entries;
  }, [entries, search]);
  const rosterCounts = useMemo(
    () => countRosterStatuses(matchingSearch),
    [matchingSearch],
  );
  const progressCounts = useMemo(() => {
    const counts = countRosterStatuses(entries);
    return {
      total: entries.length - (counts.inactive ?? 0),
      done: counts.confirmed ?? 0,
      processing: counts.processing ?? 0,
      failed: counts.failed ?? 0,
    };
  }, [entries]);
  const visible = useMemo(
    () => matchingSearch.filter((entry) => matchesRosterFilter(entry, filter)),
    [matchingSearch, filter],
  );
  const pinned =
    focusedCard?.lessonId === lessonId && focusedCard.id === preferredId
      ? matchingSearch.find(({ student }) => student.id === preferredId)
      : undefined;
  const current =
    visible.find(({ student }) => student.id === preferredId) ??
    pinned ??
    visible[0];
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
  const editorEntries =
    current && currentOffset < 0
      ? [...visible, current].sort((a, b) => a.index - b.index)
      : visible;
  const editorOffset = current ? editorEntries.indexOf(current) : -1;
  const compactPage = Math.max(1, Math.floor(editorOffset / pageSize) + 1);
  const compactEntries = editorEntries.slice(
    (compactPage - 1) * pageSize,
    compactPage * pageSize,
  );
  const displayed = compact ? compactEntries : current ? [current] : [];
  const clearFilters = useCallback(() => {
    setSearch("");
    setFilter("all");
    setFocusedCard(undefined);
  }, []);

  const stepStudent = (direction: -1 | 1) => {
    const next =
      currentOffset >= 0
        ? visible[currentOffset + direction]
        : direction > 0
          ? visible[0]
          : undefined;
    if (!next?.student.id) return false;
    setFocusedCard(undefined);
    navigateStudent(next.student.id);
    return true;
  };

  const openShortcuts = shortcutHelp.show;
  useWorkbenchShortcuts({
    workbenchRef,
    blocked: Boolean(
      settingsDrawer.overlay ||
        templateEditor.overlay ||
        history.overlay ||
        shortcutHelp.overlay ||
        openRoster,
    ),
    step: stepStudent,
    showHelp: () => openShortcuts(true),
  });
  const swipe = useMobileStudentSwipe(stepStudent);

  const selectProgress = (next: "processing" | "failed") => {
    if (filter === next && !search) {
      clearFilters();
      return;
    }
    const first = entries.find((entry) => matchesRosterFilter(entry, next));
    if (!first?.student.id) return;
    setSearch("");
    setFilter(next);
    setFocusedCard(undefined);
    navigateStudent(first.student.id);
  };

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
    if (!useRosterStore.getState().loadStudentsFromStorage(name)) return false;
    useCourseStore.getState().hydrateCourseState();
    setCourseFocus(null);
    clearFilters();
    return true;
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
      if (pendingFeedbackCopyIds().length)
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

  const copyFlow = useFeedbackCopyFlow({
    sendMessage,
    sendWarning,
    fixIssue,
    openTemplate: openFeedbackTemplate,
  });
  const previewDialog = copyFlow.dialog;
  const preview = previewDialog.overlay?.content;

  const previewArchivedStudent = (draft: LessonDraft, index: number) => {
    if (copyFlow.showArchived(draft, index)) return;
    templateAfterHistory.current = true;
    history.close();
  };

  const afterLessonChange = () => {
    setCourseFocus(null);
    clearFilters();
  };

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
        onFocusCapture={() => {
          rememberStudent(id);
          setFocusedCard((previous) =>
            previous?.id === id && previous.lessonId === lessonId
              ? previous
              : { id, lessonId },
          );
        }}
        onBlurCapture={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          )
            return;
          setFocusedCard((previous) =>
            previous?.id === id ? undefined : previous,
          );
        }}
        {...(isCompact ? {} : swipe)}
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
            selected={id === currentId}
            issue={issues[0]?.message}
            onGenerate={generate}
            onFixIssue={fixFirstIssue}
            compact={isCompact}
            onPreview={copyFlow.showPreview}
            onCopy={copyFlow.copyStudent}
            onRecordNext={recordNext}
            onReviewNext={reviewNext}
            onConfirmed={onConfirmed}
          />
        </ViewportEditor>
      </div>
    );
  };

  return (
    <>
      <WorkspaceHeader
        activeClass={activeClass}
        classes={classes}
        onSwitchClass={switchClass}
        onStartLesson={() => {
          if (useRosterStore.getState().newLesson()) afterLessonChange();
        }}
        onHistory={() => {
          templateAfterHistory.current = false;
          history.show({
            current: getCurrentLessonDraft(),
            records: readArchivedLessons(activeClass),
          });
        }}
        onTemplate={openFeedbackTemplate}
        onSettings={() => showSettings({})}
      />
      <main
        className="page-content"
        aria-label={activeClass || "课程反馈工作台"}
      >
        <div className="workspace">
          {activeClass && <h1 className="visually-hidden">{activeClass}</h1>}
          <SaveStatus
            onLoadLatest={() => {
              cancelGeneration();
              if (loadLatestLessonDraft()) afterLessonChange();
            }}
          />
          <LessonSurface lesson={activeClass ? lessonId : ""}>
            {!activeClass ? (
              <div className="welcome-panel">
                <h1>开始本次课的反馈</h1>
                <Empty description="创建班级后即可添加学生名单。">
                  <CreateClassForm onCreate={switchClass} />
                </Empty>
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
                  <WorkbenchToolbar
                    compact={compact}
                    setCompact={(value) => {
                      setCompact(value);
                      try {
                        localStorage.setItem(
                          "editorMode",
                          value ? "compact" : "single",
                        );
                      } catch {
                        /* Layout still changes in this session. */
                      }
                    }}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    resumeLabel={
                      current
                        ? `${resumeLabel} ${current.student.name}`
                        : undefined
                    }
                    onResume={() =>
                      navigateStudent(
                        currentId,
                        resumeFeedback
                          ? "feedback"
                          : resumeLabel === "继续记录"
                            ? "observation"
                            : "card",
                      )
                    }
                    confirmation={
                      confirmation?.lessonId === lessonId
                        ? confirmation
                        : undefined
                    }
                    counts={progressCounts}
                    filter={filter}
                    onFilter={selectProgress}
                    onShowHelp={() => openShortcuts(true)}
                  />
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
                            onClick={
                              useRosterStore.getState().sortStudentsByName
                            }
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
                        setFilter={(next) => {
                          setFocusedCard(undefined);
                          setFilter(next);
                        }}
                        counts={rosterCounts}
                        search={search}
                        setSearch={(query) => {
                          setFocusedCard(undefined);
                          setSearch(query);
                        }}
                      />
                      <Button
                        className="invert-participation"
                        type="text"
                        onClick={() =>
                          useRosterStore
                            .getState()
                            .toggleAllStudentsActivation()
                        }
                      >
                        反转参与选择
                      </Button>
                    </div>
                  </aside>
                  <div className="editor-area">
                    {current && !compact && (
                      <MobileStudentNavigation
                        name={current.student.name}
                        position={currentOffset}
                        total={visible.length}
                        step={stepStudent}
                      />
                    )}
                    <EditorStage
                      key={lessonId}
                      compact={compact && Boolean(currentId)}
                      cursor={current?.index ?? -1}
                      navigation={navigationTarget}
                      neighbors={
                        compact
                          ? []
                          : [
                              visible[currentOffset + 1],
                              visible[currentOffset - 1],
                            ]
                              .filter(Boolean)
                              .map(({ student }) => editor(student, false))
                      }
                      revision={JSON.stringify([
                        compact,
                        ...displayed.map(({ student }) => student.id),
                      ])}
                      cards={
                        currentId
                          ? displayed.map(({ student }) =>
                              editor(student, compact),
                            )
                          : [
                              <div
                                key="empty"
                                data-current-editor="true"
                                className="editor-empty"
                              >
                                <Empty description="没有符合条件的学生">
                                  <Button onClick={clearFilters}>
                                    清除筛选
                                  </Button>
                                </Empty>
                              </div>,
                            ]
                      }
                    />
                    {editorEntries.length > pageSize && (
                      <div hidden={!compact}>
                        <WorkbenchPagination
                          page={compactPage}
                          pageSize={pageSize}
                          total={editorEntries.length}
                          onChange={(page, size) => {
                            const id =
                              editorEntries[(page - 1) * size]?.student.id ??
                              currentId;
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
                    onCopy={() => copyFlow.showPreview()}
                    onCopyNext={copyFlow.startQueue}
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
        </div>
      </main>
      {shortcutHelp.overlay && (
        <WorkbenchShortcutHelp
          open={shortcutHelp.overlay.open}
          onClose={shortcutHelp.close}
          afterClose={shortcutHelp.afterClose}
        />
      )}
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
          format={copyFlow.format}
          setFormat={copyFlow.setFormat}
          queue={
            preview.queue
              ? {
                  index: preview.queue.index,
                  total: preview.queue.ids.length,
                  direction: preview.queue.direction,
                }
              : undefined
          }
          onPrevious={() => copyFlow.moveQueue(preview, "backward")}
          onSkip={() => copyFlow.moveQueue(preview, "forward")}
          onClose={previewDialog.close}
          onCopy={copyFlow.copyPreview}
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
    </>
  );
}
