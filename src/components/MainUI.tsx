// React核心导入
import {
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";

// Ant Design图标 - 按需导入
import {
  EllipsisOutlined,
  FileTextFilled,
  LoadingOutlined,
  ExportOutlined,
  OrderedListOutlined,
  CheckSquareOutlined,
} from "@ant-design/icons";

// Ant Design核心组件
import {
  Anchor,
  Button,
  Col,
  ConfigProvider,
  Flex,
  FloatButton,
  Form,
  Row,
  Spin,
  Tag,
  theme,
  Tooltip,
  Typography,
} from "antd";
import type { JointContent } from "antd/es/message/interface";

// 工具库
import dayjs from "dayjs";
import { API, type ModelType } from "../AI_API";
import type { CourseTemplateContext } from "../domain/course";
import { buildCourseTemplateContext } from "../domain/course";
import { formatStructuredStudentPerformance } from "../domain/student";
import {
  buildFeedbackBatchMarkdown,
  buildStudentFeedbackMarkdown,
  cleanGeneratedFeedback,
  DEFAULT_FEEDBACK_TEMPLATE,
} from "../services/feedback/feedbackTemplate";
import {
  addCourseContextToHistory,
  buildClassTimeFromCourseContext,
  migrateCourseHistory,
  parseStoredClassTime,
  removeCourseHistoryItem,
  shiftClassTimeToPreviousWeek,
} from "../services/course/courseHistory";
import {
  buildStudentGenerationMessages,
  compileCoursePromptContext,
} from "../services/prompt/promptCompiler";

// 导入子组件
const StringListInput = lazy(() => import("./StringListInput"));
const SettingsDrawer = lazy(() => import("./SettingsDrawer"));
const StudentsList = lazy(() => import("./StudentsList"));
const TemplateEditor = lazy(() => import("./TemplateEditor"));
const CourseInfoCard = lazy(() => import("./CourseInfoCard"));

// 导入类型
import { HistorysType, PromptItem, PromptType } from "./types";

// 导入自定义Hook
import { useStudentsManager } from "../hooks";
import { useInputAssistantStore } from "../store/InputAssistantStore";

// 导入常量和工具函数
import { PROMPTS } from "./constants";
import {
  addToLocalStorageArray,
  getLocalStorage,
  getPromptFromLocalStorage,
  batchGetLocalStorage,
  safeJsonParse,
} from "../utils";

// 定义组件Props接口
interface MainUIProps {
  // 发送普通消息的函数
  sendMessage: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction,
  ) => void;
  // 发送警告消息的函数
  sendWarning: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction,
  ) => void;
}

// 从theme中解构出useToken钩子
const { useToken } = theme;

// 智能预加载函数 - 使用 requestIdleCallback 在空闲时预加载
const preloadComponents = () => {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
        const promises = [
          import("./StringListInput"),
          import("./SettingsDrawer"),
          import("./StudentsList"),
          import("./TemplateEditor"),
          import("./CourseInfoCard"),
        ];

        Promise.all(promises).catch((error) => {
          console.error("组件预加载失败:", error);
        });
      },
      { timeout: 2000 },
    );
  } else {
    // 降级到 setTimeout
    setTimeout(() => {
      const promises = [
        import("./StringListInput"),
        import("./SettingsDrawer"),
        import("./StudentsList"),
        import("./TemplateEditor"),
        import("./CourseInfoCard"),
      ];

      Promise.all(promises).catch((error) => {
        console.error("组件预加载失败:", error);
      });
    }, 1000);
  }
};

/**
 * 主页组件
 */
const MainUI: FC<MainUIProps> = ({ sendMessage, sendWarning }) => {
  // 创建课程信息表单实例
  const [class_form] = Form.useForm();
  // 创建学生内容表单实例
  const [content_form] = Form.useForm();

  // 使用学生管理Hook
  const {
    studentsList,
    studentsInfo,
    loadStudentsFromStorage,
    updateStudentsFromRawValues,
    updateStudentGender,
    updateStudentVersion,
    updateStudentInfo,
    clearAllStudents,
    toggleAllStudentsActivation,
    sortStudentsByName,
    getStudentNames,
    getActivatedStudentsCount,
  } = useStudentsManager();

  // 使用输入助手 Store
  const loadV1Suggestions = useInputAssistantStore(
    (state) => state.loadV1Suggestions,
  );
  const loadV2CustomOptions = useInputAssistantStore(
    (state) => state.loadV2CustomOptions,
  );
  // 提示词Key
  const [promptKey, setPromptKey] = useState<PromptType>("programming");
  // 提示词内容
  const [promptItems, setPromptItems] = useState<Record<string, PromptItem>>({
    ...PROMPTS,
    ...getPromptFromLocalStorage(),
  });
  // 用于存储班级列表
  const [classList, setClasses] = useState<string[]>(
    getLocalStorage("class-name"),
  );
  // 标记表单是否已提交
  const isFinishedRef = useRef(false);
  // 设置抽屉是否打开的状态
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<ModelType>(API.getModel);
  // 历史课程信息
  const [history, setHistory] = useState<HistorysType>({});
  // 获取主题token
  const { token } = useToken();
  // 节流状态
  const [isThrottled, setIsThrottled] = useState(false);
  // 节流消息
  const [throttleMessage, setThrottleMessage] = useState("");
  // 模板相关状态
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [customTemplate, setCustomTemplate] = useState(
    DEFAULT_FEEDBACK_TEMPLATE,
  );
  const [signature, setSignature] = useState("哆啦人工智能小栈");

  const handleSetModel = useCallback(
    (model: ModelType) => {
      setModel(model);
      localStorage.setItem("ai-model", JSON.stringify(model));
      API.setModel(model);
    },
    [setModel],
  );

  // 优化初始化加载 - 使用批量操作和错误处理
  useEffect(() => {
    const localStorageKeys = [
      "class-history",
      "feedback-template",
      "signature",
      "ai-model",
    ];

    // 使用优化的批量读取函数
    const localStorageData = batchGetLocalStorage(localStorageKeys);

    const rawHistoryData = safeJsonParse(localStorageData["class-history"], {});
    const { history: historyData, migrated } =
      migrateCourseHistory(rawHistoryData);

    if (migrated) {
      localStorage.setItem("class-history", JSON.stringify(historyData));
      sendMessage("课程历史记录已成功迁移到新版本。");
    }

    if (Object.keys(historyData).length > 0) {
      setHistory(historyData);
    }

    if (localStorageData["feedback-template"]) {
      setCustomTemplate(localStorageData["feedback-template"]);
    }

    if (localStorageData["signature"]) {
      setSignature(localStorageData["signature"]);
    }

    const modelData = safeJsonParse(localStorageData["ai-model"], null);
    if (modelData) {
      setModel(modelData);
      API.setModel(modelData);
    }

    // API 监听器设置
    const unsubscribe = API.addThrottleListener((isThrottled, message) => {
      setIsThrottled(isThrottled);
      setThrottleMessage(message);
    });

    // 延迟预加载组件
    preloadComponents();

    // 加载输入助手数据
    loadV1Suggestions().catch((error) => {
      console.error("Failed to load V1 suggestions:", error);
    });
    loadV2CustomOptions().catch((error) => {
      console.error("Failed to load V2 custom options:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [sendMessage, loadV1Suggestions, loadV2CustomOptions]);

  // 拷贝到剪切板
  const copyToClipboard = useCallback(
    (text: string) => {
      // 复制到剪贴板
      navigator.clipboard.writeText(text);
      sendMessage("已导出到剪切板.");
    },
    [sendMessage],
  );

  const getCourseTemplateContext =
    useCallback((): CourseTemplateContext | null => {
      return buildCourseTemplateContext(class_form.getFieldsValue());
    }, [class_form]);

  const getAIClassContent = useCallback(() => {
    const courseContext = getCourseTemplateContext();
    if (!courseContext) return null;

    return compileCoursePromptContext(courseContext);
  }, [getCourseTemplateContext]);

  // 处理表单提交的回调函数
  const handleSubmit = useCallback(() => {
    const courseContext = getCourseTemplateContext();

    if (!courseContext) {
      isFinishedRef.current = false;
      return;
    }

    // 保存班级数据到本地存储
    const saveData = buildClassTimeFromCourseContext(courseContext);

    localStorage.setItem(courseContext.className, JSON.stringify(saveData));
    const classList = addToLocalStorageArray(
      "class-name",
      courseContext.className,
    );
    setClasses(classList);

    // 添加到历史记录
    const newHistory = addCourseContextToHistory(history, courseContext);
    setHistory(newHistory);
    localStorage.setItem("class-history", JSON.stringify(newHistory));

    // 标记表单已完成
    isFinishedRef.current = true;
  }, [getCourseTemplateContext, history]);

  // 导入班级数据
  const importClass = useCallback(
    (key: string, updateClassName = false) => {
      const className = key.trim();
      if (!className) return;

      const data = localStorage.getItem(className);
      const classTime = parseStoredClassTime(data);
      if (classTime) {
        const [newFirstTime, newLastTime] =
          shiftClassTimeToPreviousWeek(classTime);

        const fieldsToUpdate: {
          [key: string]: [dayjs.Dayjs, dayjs.Dayjs] | string;
        } = {
          "course-time": [newFirstTime, newLastTime],
        };

        // 如果需要更新班级名称（从选择器触发时）
        if (updateClassName) {
          fieldsToUpdate["class-name"] = className;
        }

        class_form.setFieldsValue(fieldsToUpdate);
        sendMessage("班级信息已加载。");
      } else {
        // 未找到数据时发送提示消息
        sendMessage("未找到该班级的数据, 请检查班级名是否正确.");
      }
      // 从本地存储获取学生列表
      loadStudentsFromStorage(className);
    },
    [class_form, sendMessage, loadStudentsFromStorage],
  );

  // 处理导入班级数据的回调函数
  //   const handleImport = useCallback(() => {
  //     // 从本地存储获取班级数据
  //     const key = class_form.getFieldValue("class-name") as string;
  //     if (!key || key === "") {
  //       sendWarning("请先输入班级名.");
  //       return;
  //     }
  //     importClass(key);
  //   }, [class_form, importClass, sendWarning]);

  // 处理班级选择
  const handleClassSelect = useCallback(
    (className: string) => {
      importClass(className, true);
    },
    [importClass],
  );

  // 处理历史记录删除
  const handleHistoryDelete = useCallback(
    (key: string) => {
      const newHistory = removeCourseHistoryItem(history, key);
      setHistory(newHistory);
      localStorage.setItem("class-history", JSON.stringify(newHistory));
    },
    [history],
  );

  // 处理单次AI调用
  const handleSingleAIOptimize = useCallback(
    (index: number) => {
      const classContent = getAIClassContent();
      if (!classContent) {
        sendWarning("请先补完整课程信息。");
        return;
      }

      if (!isFinishedRef.current) {
        handleSubmit();
      }

      // 设置学生为加载状态
      updateStudentInfo(index, { loading: true });

      // 调用AI API发送消息
      new API().sendMessage(
        // 成功回调，更新文本区域内容
        (content, type) => {
          if (type === null || content === null) return;

          // 更新特定学生的内容
          switch (type) {
            case "content":
              updateStudentInfo(index, { content });
              break;
            case "reasoning_content":
              updateStudentInfo(index, { think_content: content });
              break;
            default:
              console.warn("未知的type");
              break;
          }
        },
        // `完成`回调
        () => {
          // 使用函数式更新来获取最新的状态
          updateStudentInfo(index, (prevInfo) => {
            return {
              ...prevInfo,
              content: cleanGeneratedFeedback(prevInfo.content || ""),
              loading: false,
            };
          });
        },
        ...buildStudentGenerationMessages({
          systemPrompt: promptItems[promptKey].prompt,
          coursePromptContext: classContent,
          student: studentsList[index],
          performanceText:
            studentsList[index]?.version === "v1"
              ? (content_form.getFieldValue(["content", index]) ?? "")
              : formatStructuredStudentPerformance(studentsList[index].gender, {
                  total: content_form.getFieldValue([
                    "content",
                    index,
                    "total",
                  ]),
                  mastery_situation: content_form.getFieldValue([
                    "content",
                    index,
                    "mastery_situation",
                  ]),
                  attention: content_form.getFieldValue([
                    "content",
                    index,
                    "attention",
                  ]),
                  interaction: content_form.getFieldValue([
                    "content",
                    index,
                    "interaction",
                  ]),
                  other: content_form.getFieldValue([
                    "content",
                    index,
                    "other",
                  ]),
                }),
        }),
      );
    },
    [
      content_form,
      getAIClassContent,
      handleSubmit,
      promptItems,
      promptKey,
      sendWarning,
      studentsList,
      updateStudentInfo,
    ],
  );

  // 处理AI优化学生课堂表现的回调函数
  const handleAIOptimize = useCallback(() => {
    if (!getAIClassContent()) {
      sendWarning("请先补完整课程信息。");
      return;
    }
    if (API.tokenReady() === false) {
      sendWarning("请先输入API Key.");
      return;
    }
    // 遍历学生列表
    for (const [index] of studentsList.entries()) {
      if (studentsInfo[index]?.activated) {
        handleSingleAIOptimize(index);
      }
    }
  }, [
    getAIClassContent,
    handleSingleAIOptimize,
    sendWarning,
    studentsList,
    studentsInfo,
  ]);

  // 加载历史数据
  const handleLoadHistoryData = useCallback(
    (key: string) => {
      const data = history[key];
      if (data) {
        const fieldsToUpdate: {
          "course-name": string;
          "course-contents": { item: string }[];
          "course-objectives": { item: string }[];
          "course-time"?: [dayjs.Dayjs, dayjs.Dayjs];
        } = {
          "course-name": data.courseName,
          "course-contents": data.courseContents,
          "course-objectives": data.courseObjectives,
        };

        if (data.time) {
          fieldsToUpdate["course-time"] = [
            dayjs(data.time[0]),
            dayjs(data.time[1]),
          ];
        }

        class_form.setFieldsValue(fieldsToUpdate);
      }
      window.setTimeout(handleSubmit, 0);
    },
    [class_form, history, handleSubmit],
  );

  // 复制单个学生内容（带模板）
  const handleCopyStudentWithTemplate = useCallback(
    (index: number) => {
      const courseContext = getCourseTemplateContext();
      if (!courseContext) {
        sendWarning("请先补完整课程信息。");
        return;
      }

      // 获取学生信息
      const student = studentsList[index];
      if (!student) return;

      const result = buildStudentFeedbackMarkdown({
        courseContext,
        customTemplate,
        signature,
        student,
        studentInfo: studentsInfo[index],
      });

      // 复制到剪贴板
      copyToClipboard(result);
    },
    [
      copyToClipboard,
      customTemplate,
      getCourseTemplateContext,
      sendWarning,
      signature,
      studentsList,
      studentsInfo,
    ],
  );

  // 处理模板保存
  const handleTemplateSave = useCallback(
    (newTemplate: string, newSignature: string) => {
      // 保存模板到localStorage
      localStorage.setItem("feedback-template", newTemplate);
      localStorage.setItem("signature", newSignature);

      // 更新状态
      setCustomTemplate(newTemplate);
      setSignature(newSignature);

      // 关闭模态框
      setIsTemplateModalVisible(false);
    },
    [],
  );

  return (
    <>
      {/* 设置抽屉 */}
      <Suspense fallback={<Spin size="large" />}>
        <SettingsDrawer
          open={open}
          setOpen={setOpen}
          model={model}
          setModel={handleSetModel}
          promptItems={promptItems}
          setPromptItems={setPromptItems}
          promptKey={promptKey}
          setPromptKey={setPromptKey}
          sendMessage={sendMessage}
        />
      </Suspense>

      {/* 模板编辑器 */}
      <TemplateEditor
        isOpen={isTemplateModalVisible}
        onClose={() => setIsTemplateModalVisible(false)}
        onSave={handleTemplateSave}
        initialTemplate={customTemplate}
        initialSignature={signature}
        sendMessage={sendMessage}
      />

      {/* 主体内容 */}
      <Row gutter={[72, 64]}>
        <Col span={2} />
        <Col span={16}>
          <Form
            layout="vertical"
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 18 }}
            form={class_form}
            name="course-info"
            autoComplete="off"
            // onFinish={handleSubmit}
            onFieldsChange={() => (isFinishedRef.current = false)}
            initialValues={{ items: [{}] }}
          >
            {/* 课程信息卡片 */}
            <Suspense fallback={<Spin size="large" />}>
              <CourseInfoCard
                form={class_form}
                classList={classList}
                history={history}
                // onImport={handleImport}
                onHandleSubmit={handleSubmit}
                onAIOptimize={handleAIOptimize}
                onTemplateEdit={() => setIsTemplateModalVisible(true)}
                onClassSelect={handleClassSelect}
                onHistoryLoad={handleLoadHistoryData}
                onHistoryDelete={handleHistoryDelete}
              />
            </Suspense>
          </Form>
        </Col>
        <Col span={6}>
          {/* 学生列表输入组件 */}
          <Suspense fallback={<Spin size="large" />}>
            <Flex vertical gap={10}>
              <StringListInput
                values_={getStudentNames()}
                activated_list_={Object.values(studentsInfo).map(
                  (student) => student.activated,
                )}
                onChange={(raw_values) => {
                  try {
                    // 获取班级名称
                    const className = class_form.getFieldValue("class-name");
                    updateStudentsFromRawValues(raw_values, className);
                  } catch (error) {
                    sendWarning(
                      error instanceof Error ? error.message : "发生未知错误",
                    );
                  }
                }}
                onClear={clearAllStudents}
                onActive={(index, activated_list) => {
                  updateStudentInfo(index, {
                    activated: activated_list[index],
                  });
                }}
              />
              {studentsList.length > 0 && (
                <Flex gap={10}>
                  <Tooltip placement="top" title="选择反转">
                    <Button
                      icon={<CheckSquareOutlined />}
                      size="small"
                      onClick={toggleAllStudentsActivation}
                    />
                  </Tooltip>
                  <Tooltip placement="top" title="复制学生列表">
                    <Button
                      icon={<ExportOutlined />}
                      size="small"
                      onClick={() => {
                        copyToClipboard(getStudentNames().join(", "));
                      }}
                    />
                  </Tooltip>
                  <Tooltip placement="top" title="按首字母顺序排序">
                    <Button
                      icon={<OrderedListOutlined />}
                      size="small"
                      onClick={() => {
                        const className =
                          class_form.getFieldValue("class-name");
                        if (!className) return;
                        sortStudentsByName(className);
                      }}
                    />
                  </Tooltip>
                  <Tooltip placement="top" title="人数统计">
                    <Typography.Text
                      style={{
                        textAlign: "center",
                      }}
                    >
                      {(() => {
                        const { activated, total } =
                          getActivatedStudentsCount();
                        return `${activated}/${total}人`;
                      })()}
                    </Typography.Text>
                  </Tooltip>
                </Flex>
              )}
            </Flex>
          </Suspense>
        </Col>

        <Col span={2} />
        <Col span={16}>
          {/* 学生内容表单 */}
          {studentsList.length > 0 && (
            <Form form={content_form} name="student-content">
              {/* 使用优化后的学生列表组件 */}
              <Suspense fallback={<Spin size="large" />}>
                <StudentsList
                  students={studentsList}
                  students_info={studentsInfo}
                  className={class_form.getFieldValue("class-name") || ""}
                  handleSingleAIOptimize={handleSingleAIOptimize}
                  copyToClipboard={copyToClipboard}
                  copyStudentWithTemplate={handleCopyStudentWithTemplate}
                  onUpdateStudentGender={(index, gender) => {
                    const className = class_form.getFieldValue("class-name");
                    if (className) {
                      updateStudentGender(index, gender, className);
                    }
                  }}
                  onUpdateStudentVersion={(index, version) => {
                    const className = class_form.getFieldValue("class-name");
                    if (className) {
                      updateStudentVersion(index, version, className);
                    }
                  }}
                  sendWarning={sendWarning}
                />
              </Suspense>
            </Form>
          )}
        </Col>
        {/* 侧边锚点 */}
        <Col span={6}>
          {studentsList.length > 0 && (
            <Anchor
              offsetTop={100}
              items={[
                {
                  key: "course-info-card-anchor",
                  title: "回到顶部",
                  href: "#course-info-card",
                },
              ].concat(
                studentsList.map((student, index) => {
                  return {
                    key: `student-content-anchor-${index}`,
                    title: student.name,
                    href: `#student-content-${index}`,
                  };
                }),
              )}
            />
          )}
        </Col>
      </Row>

      {/* 节流提醒 */}
      {isThrottled && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 1000,
            padding: "10px 15px",
            background: token.colorWarning,
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Spin
            indicator={
              <LoadingOutlined style={{ fontSize: 18, color: "#fff" }} spin />
            }
          />
          <Tag color="warning">{throttleMessage}</Tag>
        </div>
      )}

      {/* 导出按钮 */}
      <FloatButton
        icon={<FileTextFilled />}
        type="default"
        tooltip="导出内容到剪切板."
        style={{ insetInlineEnd: 24 + 24 + 24 }}
        onClick={() => {
          const courseContext = getCourseTemplateContext();
          if (!courseContext) {
            sendWarning("请先补完整课程信息。");
            return;
          }

          const result = buildFeedbackBatchMarkdown({
            courseContext,
            customTemplate,
            signature,
            students: studentsList,
            studentsInfo,
          });

          // 复制到剪贴板
          copyToClipboard(result);
        }}
      />
      {/* 过滤导出按钮 */}
      <FloatButton
        icon={<FileTextFilled />}
        type="primary"
        tooltip="导出已选且有反馈的内容"
        style={{ insetInlineEnd: 24 }}
        onClick={() => {
          const courseContext = getCourseTemplateContext();
          if (!courseContext) {
            sendWarning("请先补完整课程信息。");
            return;
          }

          const result = buildFeedbackBatchMarkdown({
            courseContext,
            customTemplate,
            signature,
            students: studentsList,
            studentsInfo,
            onlyReadyAndActivated: true,
          });

          // 复制到剪贴板
          copyToClipboard(result);
        }}
      />
      {/* 设置按钮 - 根据API状态改变样式 */}
      <ConfigProvider
        theme={{
          token: API.tokenReady()
            ? undefined
            : {
                colorBgElevated: token.colorError,
              },
        }}
      >
        <FloatButton
          icon={
            <EllipsisOutlined
              style={{
                color: API.tokenReady() ? undefined : "white",
              }}
            />
          }
          tooltip="展开设置面板."
          style={{
            insetBlockEnd: 128,
          }}
          onClick={() => {
            setOpen(true);
          }}
        />
      </ConfigProvider>
    </>
  );
};

export default MainUI;
