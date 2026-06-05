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
import { API } from "../AI_API";
import type { CourseTemplateContext } from "../domain/course";
import { buildCourseTemplateContext } from "../domain/course";
import {
  buildFeedbackBatchMarkdown,
  buildStudentFeedbackMarkdown,
} from "../services/feedback/feedbackTemplate";
import { shiftClassTimeToPreviousWeek } from "../services/course/courseHistory";
import { compileCoursePromptContext } from "../services/prompt/promptCompiler";

// 导入子组件
const StringListInput = lazy(() => import("./StringListInput"));
const SettingsDrawer = lazy(() => import("./SettingsDrawer"));
const StudentsList = lazy(() => import("./StudentsList"));
const TemplateEditor = lazy(() => import("./TemplateEditor"));
const CourseInfoCard = lazy(() => import("./CourseInfoCard"));

// 导入自定义Hook
import { useFeedbackGeneration, useStudentsManager } from "../hooks";
import {
  useAIStore,
  useCourseStore,
  useFeedbackStore,
  useInputAssistantStore,
  useSettingsStore,
} from "../store";

// 导入常量和工具函数

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
  const classList = useCourseStore((state) => state.classList);
  const history = useCourseStore((state) => state.history);
  const hydrateCourseState = useCourseStore(
    (state) => state.hydrateCourseState,
  );
  const readStoredClassTime = useCourseStore(
    (state) => state.readStoredClassTime,
  );
  const removeHistoryItem = useCourseStore((state) => state.removeHistoryItem);
  const saveCourseContext = useCourseStore((state) => state.saveCourseContext);
  const customTemplate = useFeedbackStore((state) => state.customTemplate);
  const hydrateFeedbackSettings = useFeedbackStore(
    (state) => state.hydrateFeedbackSettings,
  );
  const setFeedbackTemplate = useFeedbackStore(
    (state) => state.setFeedbackTemplate,
  );
  const signature = useFeedbackStore((state) => state.signature);
  const isThrottled = useAIStore((state) => state.isThrottled);
  const setThrottleState = useAIStore((state) => state.setThrottleState);
  const throttleMessage = useAIStore((state) => state.throttleMessage);
  const hydrateSettings = useSettingsStore((state) => state.hydrateSettings);
  const model = useSettingsStore((state) => state.model);
  const promptItems = useSettingsStore((state) => state.promptItems);
  const promptKey = useSettingsStore((state) => state.promptKey);
  const setModel = useSettingsStore((state) => state.setModel);
  const setPromptItems = useSettingsStore((state) => state.setPromptItems);
  const setPromptKey = useSettingsStore((state) => state.setPromptKey);
  const savePromptItems = useSettingsStore((state) => state.savePromptItems);
  // 标记表单是否已提交
  const isFinishedRef = useRef(false);
  // 设置抽屉是否打开的状态
  const [open, setOpen] = useState(false);
  // 获取主题token
  const { token } = useToken();
  // 模板相关状态
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);

  // 优化初始化加载 - 使用批量操作和错误处理
  useEffect(() => {
    const { migrated } = hydrateCourseState();
    if (migrated) {
      sendMessage("课程历史记录已成功迁移到新版本。");
    }
    hydrateFeedbackSettings();
    hydrateSettings();

    // API 监听器设置
    const unsubscribe = API.addThrottleListener((isThrottled, message) => {
      setThrottleState(isThrottled, message);
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
  }, [
    hydrateCourseState,
    hydrateFeedbackSettings,
    hydrateSettings,
    loadV1Suggestions,
    loadV2CustomOptions,
    sendMessage,
    setThrottleState,
  ]);

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

    saveCourseContext(courseContext);

    // 标记表单已完成
    isFinishedRef.current = true;
  }, [getCourseTemplateContext, saveCourseContext]);

  // 导入班级数据
  const importClass = useCallback(
    (key: string, updateClassName = false) => {
      const className = key.trim();
      if (!className) return;

      const classTime = readStoredClassTime(className);
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
    [class_form, loadStudentsFromStorage, readStoredClassTime, sendMessage],
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
      removeHistoryItem(key);
    },
    [removeHistoryItem],
  );

  const {
    generateActivatedFeedback: handleAIOptimize,
    generateSingleFeedback: handleSingleAIOptimize,
  } = useFeedbackGeneration({
    contentForm: content_form,
    ensureCourseSaved: handleSubmit,
    getCoursePromptContext: getAIClassContent,
    isCourseSavedRef: isFinishedRef,
    promptItem: promptItems[promptKey],
    prompt: promptItems[promptKey].prompt,
    promptKey,
    sendWarning,
    studentsInfo,
    studentsList,
    updateStudentInfo,
  });

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
      setFeedbackTemplate(newTemplate, newSignature);

      // 关闭模态框
      setIsTemplateModalVisible(false);
    },
    [setFeedbackTemplate],
  );

  return (
    <>
      {/* 设置抽屉 */}
      <Suspense fallback={<Spin size="large" />}>
        <SettingsDrawer
          open={open}
          setOpen={setOpen}
          model={model}
          setModel={setModel}
          promptItems={promptItems}
          setPromptItems={setPromptItems}
          promptKey={promptKey}
          setPromptKey={setPromptKey}
          savePromptItems={savePromptItems}
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
