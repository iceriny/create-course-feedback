import ProgressBar from "./ProgressBar";
import Roster from "./Roster";
import BatchActions from "./BatchActions";
import SaveStatus from "./SaveStatus";
import IconButton from "../common/IconButton";
import { useAppearanceStore } from "../../store/appearanceStore";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Button,
  Empty,
  Flex,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Pagination,
  Select,
  Spin,
  Tooltip,
  Dropdown,
} from "antd";
import {
  SettingOutlined,
  PlusOutlined,
  SortAscendingOutlined,
  EditOutlined,
  HistoryOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
} from "@ant-design/icons";
import type { JointContent } from "antd/es/message/interface";
import {
  flushLessonDraft,
  useRosterStore,
  type LessonDraft,
} from "../../store/rosterStore";
import {
  useCourseStore,
  useFeedbackStore,
  useSettingsStore,
} from "../../store";
import { useInputAssistantStore } from "../../store/InputAssistantStore";
import {
  buildFeedbackBatchMarkdown,
  buildStudentFeedbackMarkdown,
  toPlainText,
} from "../../services/feedback/feedbackTemplate";
import {
  cancelGeneration,
  courseContext,
  generateFeedback,
} from "../../services/ai/workspaceGeneration";
import CoursePanel from "../course/CoursePanel";
import StudentEditor from "../student/StudentEditor";
const SettingsDrawer = lazy(() => import("../settings/SettingsDrawer"));
const TemplateEditor = lazy(() => import("../settings/TemplateEditor"));
interface Props {
  sendMessage: (content: JointContent) => void;
  sendWarning: (content: JointContent) => void;
}

export default function MainUI({ sendMessage, sendWarning }: Props) {
  const activeClass = useRosterStore((s) => s.activeClass);
  const lessonId = useRosterStore((s) => s.lessonId);
  const students = useRosterStore((s) => s.studentsList);
  const settings = useSettingsStore();
  const feedback = useFeedbackStore();
  const classes = useCourseStore((s) => s.classList);
  const appearance = useAppearanceStore();
  const [compact, setCompact] = useState(
    () => localStorage.getItem("editorMode") === "compact",
  );
  const [pageSize, setPageSize] = useState(6);
  const [selected, setSelected] = useState("");
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [navigationTarget, setNavigationTarget] = useState<{
    id: string;
    input: boolean;
  } | null>(null);
  const navigateStudent = useCallback((id: string, input = false) => {
    setSelected(id);
    setNavigationTarget({ id, input });
  }, []);
  useLayoutEffect(() => {
    if (!navigationTarget) return;
    const card = cards.current.get(navigationTarget.id);
    if (card) {
      const target = navigationTarget.input
        ? card.querySelector<HTMLTextAreaElement>("[data-observation]")
        : card;
      (target || card).focus({ preventScroll: true });
      card.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
    setNavigationTarget(null);
  }, [navigationTarget]);
  const [classInput, setClassInput] = useState("");
  const [openSettings, setOpenSettings] = useState(false);
  const [openTemplate, setOpenTemplate] = useState(false);
  const [openRoster, setOpenRoster] = useState(false);
  const [archives, setArchives] = useState<LessonDraft[] | null>(null);
  const [names, setNames] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [format, setFormat] = useState("plain");
  useEffect(() => {
    useCourseStore.getState().hydrateCourseState();
    useFeedbackStore.getState().hydrateFeedbackSettings();
    useSettingsStore.getState().hydrateSettings();
    void useInputAssistantStore.getState().loadV1Suggestions();
    void useInputAssistantStore.getState().loadV2CustomOptions();
    const last = localStorage.getItem("lastActiveClass");
    if (last) useRosterStore.getState().loadStudentsFromStorage(last);
    return () => {
      flushLessonDraft();
      cancelGeneration();
    };
  }, []);
  useEffect(() => {
    cancelGeneration();
  }, [lessonId]);
  const currentId = students.some((s) => s.id === selected)
    ? selected
    : students[0]?.id || "";
  const compactPage =
    Math.floor(
      Math.max(
        0,
        students.findIndex((s) => s.id === currentId),
      ) / pageSize,
    ) + 1;
  const visibleStudents = students.slice(
    (compactPage - 1) * pageSize,
    compactPage * pageSize,
  );
  const switchClass = (name: string) => {
    cancelGeneration();
    useRosterStore.getState().loadStudentsFromStorage(name);
    useCourseStore.getState().hydrateCourseState();
    setClassInput("");
  };
  const generate = useCallback(
    (index?: number, failedOnly = false) => {
      try {
        const state = useRosterStore.getState();
        const indices =
          index === undefined
            ? state.studentsList.flatMap((_, i) => {
                const info = state.studentsInfo[i];
                return (
                  failedOnly
                    ? info.generation?.status === "failed"
                    : !info.content || info.generation?.status === "failed"
                )
                  ? [i]
                  : [];
              })
            : [index];
        const count = generateFeedback(indices);
        if (!count) {
          sendWarning("没有可生成的学生，请先填写课堂观察并勾选学生。");
          return;
        }
        const context = courseContext();
        if (context) useCourseStore.getState().saveCourseContext(context);
        sendMessage(`已开始生成 ${count} 人的反馈。`);
      } catch (error) {
        sendWarning((error as Error).message);
      }
    },
    [sendMessage, sendWarning],
  );
  const next = useCallback(
    (fromId = currentId) => {
      const index = students.findIndex((s) => s.id === fromId);
      const ordered = [
        ...students.slice(index + 1),
        ...students.slice(0, index + 1),
      ];
      const state = useRosterStore.getState();
      const target = ordered.find((s) => {
        const info = state.studentsInfo[students.indexOf(s)];
        return info.activated && !info.confirmed;
      });
      if (target) {
        navigateStudent(target.id!, true);
      } else sendMessage("本次反馈已全部确认。");
    },
    [currentId, students, sendMessage, navigateStudent],
  );
  const showPreview = (single = false, studentId = currentId) => {
    const context = courseContext();
    if (!context) {
      sendWarning("请先补全课程信息。");
      return;
    }
    const state = useRosterStore.getState();
    const index = students.findIndex((s) => s.id === studentId);
    const input = {
      courseContext: context,
      customTemplate: feedback.customTemplate,
      signature: feedback.signature,
    };
    if (single) {
      const info = state.studentsInfo[index];
      if (info?.loading || info?.generation?.status === "failed") {
        sendWarning("请先完成反馈校对。");
        return;
      }
      setPreview(
        buildStudentFeedbackMarkdown({
          ...input,
          student: students[index],
          studentInfo: info,
        }),
      );
      setPreviewIds([studentId]);
    } else {
      const result = buildFeedbackBatchMarkdown({
        ...input,
        students,
        studentsInfo: state.studentsInfo,
        onlyReadyAndActivated: true,
        onlyConfirmed: true,
      });
      if (!result) {
        sendWarning("请先确认至少一份反馈。");
        return;
      }
      setPreview(result);
      setPreviewIds(
        students
          .filter(
            (_, i) =>
              state.studentsInfo[i].confirmed &&
              state.studentsInfo[i].activated &&
              !state.studentsInfo[i].loading,
          )
          .map((s) => s.id!),
      );
    }
  };
  const previewText =
    format === "plain" ? toPlainText(preview || "") : preview || "";
  return (
    <div className="workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">课程反馈</div>
          <h1>{activeClass || "开始本次课的反馈"}</h1>
        </div>
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
            <Button
              aria-label="切换外观"
              title="切换外观"
              icon={<SunOutlined />}
            />
          </Dropdown>
          <Button icon={<EditOutlined />} onClick={() => setOpenTemplate(true)}>
            反馈模板
          </Button>
          <IconButton
            label="设置"
            icon={<SettingOutlined />}
            onClick={() => setOpenSettings(true)}
          />
        </Flex>
      </div>
      <div className="class-bar">
        <Select
          aria-label="切换班级"
          value={activeClass || undefined}
          placeholder="选择班级"
          onChange={switchClass}
          options={Array.from(
            new Set([...classes, activeClass].filter(Boolean)),
          ).map((value) => ({ value, label: value }))}
        />
        <Input
          aria-label="新班级名称"
          value={classInput}
          onChange={(e) => setClassInput(e.target.value)}
          placeholder="新班级名称"
          onPressEnter={() => classInput.trim() && switchClass(classInput)}
        />
        <IconButton
          label="新建班级"
          icon={<PlusOutlined />}
          disabled={!classInput.trim()}
          onClick={() => switchClass(classInput)}
        />
        {activeClass && (
          <Popconfirm
            title="保存本次记录并开始新一课？"
            description="学生名单保留，课程信息与课堂表现将重新填写。"
            onConfirm={() => {
              cancelGeneration();
              useRosterStore.getState().newLesson();
            }}
          >
            <Button icon={<CalendarOutlined />}>开始新课</Button>
          </Popconfirm>
        )}
        {activeClass && (
          <Button
            icon={<HistoryOutlined />}
            onClick={() => {
              const records: LessonDraft[] = [];
              for (const key of Object.keys(localStorage)) {
                if (!key.startsWith("lessonArchive:")) continue;
                try {
                  const record = JSON.parse(localStorage.getItem(key)!);
                  if (record.activeClass === activeClass) records.push(record);
                } catch {
                  /* 跳过无法读取的记录。 */
                }
              }
              setArchives(
                records.sort((a, b) =>
                  b.course.start.localeCompare(a.course.start),
                ),
              );
            }}
          >
            历史课次
          </Button>
        )}
        <SaveStatus />
      </div>
      {!activeClass ? (
        <div className="welcome-panel">
          <Empty description="选择或新建班级后，添加名单并记录本次课堂表现。" />
        </div>
      ) : (
        <>
          <CoursePanel key={lessonId} />
          <ProgressBar />
          <div className="view-toolbar">
            <Segmented
              aria-label="编辑布局"
              value={compact ? "compact" : "single"}
              options={[
                {
                  value: "single",
                  label: (
                    <Tooltip title="逐人编辑">
                      <UserOutlined aria-label="逐人编辑" />
                    </Tooltip>
                  ),
                },
                {
                  value: "compact",
                  label: (
                    <Tooltip title="紧凑 · 多人编辑">
                      <AppstoreOutlined aria-label="紧凑 · 多人编辑" />
                    </Tooltip>
                  ),
                },
              ]}
              onChange={(value) => {
                setCompact(value === "compact");
                localStorage.setItem("editorMode", value);
              }}
            />
            {compact && (
              <Select
                aria-label="每页人数"
                value={pageSize}
                options={[6, 10, 16, 24, 50].map((value) => ({
                  value,
                  label: `每页 ${value} 人`,
                }))}
                onChange={setPageSize}
              />
            )}
            {compact && <span>同时记录、对照多名学生的表现</span>}
          </div>
          <div className="workbench">
            <aside className="roster-panel">
              <Flex justify="space-between" align="center">
                <h2>
                  学生 <span>{students.length}</span>
                </h2>
                <IconButton
                  type="text"
                  icon={<SortAscendingOutlined />}
                  label="按姓名排序"
                  onClick={() =>
                    useRosterStore.getState().sortStudentsByName(activeClass)
                  }
                />
              </Flex>
              <Roster selected={currentId} onSelect={navigateStudent} />
              <Flex gap={8}>
                <Button
                  aria-label="管理名单"
                  icon={<TeamOutlined />}
                  onClick={() => {
                    setNames("");
                    setOpenRoster(true);
                  }}
                >
                  管理
                </Button>
                <Button
                  icon={<CheckSquareOutlined />}
                  type="text"
                  onClick={() =>
                    useRosterStore.getState().toggleAllStudentsActivation()
                  }
                >
                  反转选择
                </Button>
              </Flex>
            </aside>
            <main className="editor-area">
              {currentId && compact ? (
                <>
                  <div className="compact-grid">
                    {visibleStudents.map((s) => (
                      <div
                        key={s.id}
                        data-student-id={s.id}
                        className="student-card-anchor"
                        tabIndex={-1}
                        aria-label={`${s.name}的详情`}
                        ref={(node) => {
                          if (node) cards.current.set(s.id!, node);
                          else cards.current.delete(s.id!);
                        }}
                        onFocusCapture={() => setSelected(s.id!)}
                      >
                        <StudentEditor
                          id={s.id!}
                          compact
                          onGenerate={generate}
                          onNext={() => next(s.id)}
                          onPreview={() => showPreview(true, s.id)}
                        />
                      </div>
                    ))}
                  </div>
                  <Pagination
                    current={compactPage}
                    pageSize={pageSize}
                    total={students.length}
                    showSizeChanger
                    pageSizeOptions={[6, 10, 16, 24, 50]}
                    onChange={(page, size) => {
                      setPageSize(size);
                      navigateStudent(
                        students[(page - 1) * size]?.id ||
                          students[0]?.id ||
                          "",
                      );
                    }}
                  />
                </>
              ) : currentId ? (
                <div
                  data-student-id={currentId}
                  className="student-card-anchor"
                  tabIndex={-1}
                  aria-label={`${students.find((s) => s.id === currentId)?.name}的详情`}
                  ref={(node) => {
                    if (node) cards.current.set(currentId, node);
                    else cards.current.delete(currentId);
                  }}
                  onFocusCapture={() => setSelected(currentId)}
                >
                  <StudentEditor
                    key={currentId}
                    id={currentId}
                    onGenerate={generate}
                    onNext={() => next()}
                    onPreview={() => showPreview(true)}
                  />
                </div>
              ) : (
                <CardEmpty onAdd={() => setOpenRoster(true)} />
              )}
            </main>
          </div>
          <BatchActions onGenerate={generate} onCopy={() => showPreview()} />
        </>
      )}
      <Modal
        title="历史课次"
        open={archives !== null}
        onCancel={() => setArchives(null)}
        footer={null}
      >
        {!archives?.length ? (
          <Empty description="开始新一课后，本次记录会保存在这里。" />
        ) : (
          <div className="archive-list">
            {archives.map((draft) => (
              <Flex
                key={draft.lessonId}
                justify="space-between"
                align="center"
                gap={12}
              >
                <span>
                  {draft.course.name || "未命名课程"}
                  <small>
                    {draft.course.start
                      ? new Date(draft.course.start).toLocaleDateString()
                      : "未设置时间"}{" "}
                    · {draft.studentsList.length} 人
                  </small>
                </span>
                <Button
                  onClick={() => {
                    cancelGeneration();
                    useRosterStore.getState().restoreLesson(draft);
                    setArchives(null);
                  }}
                >
                  恢复课次
                </Button>
              </Flex>
            ))}
          </div>
        )}
      </Modal>
      <Modal
        title="管理学生名单"
        open={openRoster}
        onCancel={() => setOpenRoster(false)}
        footer={null}
      >
        <div className="manage-students">
          {students.map((s, i) => (
            <Flex key={s.id} gap={8}>
              <Input
                aria-label={`修改 ${s.name} 姓名`}
                defaultValue={s.name}
                onBlur={(e) => {
                  if (e.target.value.trim() === s.name) return;
                  cancelGeneration();
                  useRosterStore.getState().renameStudent(i, e.target.value);
                }}
              />
              <Popconfirm
                title={`移除 ${s.name} 及本次反馈？`}
                onConfirm={() => {
                  cancelGeneration();
                  useRosterStore.getState().removeStudent(i);
                }}
              >
                <Button danger>移除</Button>
              </Popconfirm>
            </Flex>
          ))}
        </div>
        <label>
          添加学生
          <Input.TextArea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={4}
            placeholder="粘贴姓名，每行一人，也支持逗号、顿号和制表符。"
          />
        </label>
        <Button
          type="primary"
          className="add-students"
          disabled={!names.trim()}
          onClick={() => {
            const state = useRosterStore.getState();
            state.updateStudentsFromRawValues(
              [...state.getStudentNames(), names],
              activeClass,
            );
            setNames("");
            setOpenRoster(false);
          }}
        >
          添加到名单
        </Button>
      </Modal>
      <Modal
        title="反馈预览"
        open={preview !== null}
        onCancel={() => setPreview(null)}
        footer={
          <Button
            type="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(previewText);
                const state = useRosterStore.getState();
                previewIds.forEach((id) => {
                  const index = state.studentsList.findIndex(
                    (s) => s.id === id,
                  );
                  if (index >= 0)
                    state.updateStudentInfo(index, {
                      copiedAt: new Date().toISOString(),
                    });
                });
                sendMessage("已复制反馈。");
              } catch {
                sendWarning("复制失败，请选中预览内容手动复制。");
              }
            }}
          >
            复制反馈
          </Button>
        }
        width={720}
      >
        <Select
          aria-label="复制格式"
          value={format}
          onChange={setFormat}
          options={[
            { value: "plain", label: "纯文本" },
            { value: "markdown", label: "Markdown" },
          ]}
        />
        <Input.TextArea
          aria-label="最终反馈预览"
          className="export-preview"
          readOnly
          value={previewText}
          rows={16}
        />
      </Modal>
      <Suspense fallback={<Spin />}>
        {openSettings && (
          <SettingsDrawer
            open={openSettings}
            setOpen={setOpenSettings}
            model={settings.model}
            setModel={settings.setModel}
            promptItems={settings.promptItems}
            setPromptItems={settings.setPromptItems}
            promptKey={settings.promptKey}
            setPromptKey={settings.setPromptKey}
            savePromptItems={settings.savePromptItems}
            sendMessage={sendMessage}
          />
        )}
        {openTemplate && (
          <TemplateEditor
            isOpen={openTemplate}
            onClose={() => setOpenTemplate(false)}
            onSave={(template, signature) => {
              feedback.setFeedbackTemplate(template, signature);
              setOpenTemplate(false);
            }}
            initialTemplate={feedback.customTemplate}
            initialSignature={feedback.signature}
            sendMessage={sendMessage}
          />
        )}
      </Suspense>
    </div>
  );
}
function CardEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="welcome-panel">
      <Empty description="添加学生后，开始记录课堂表现">
        <Button type="primary" onClick={onAdd}>
          添加学生
        </Button>
      </Empty>
    </div>
  );
}
