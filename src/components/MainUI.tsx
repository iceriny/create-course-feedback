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

// 导入子组件
const StringListInput = lazy(() => import("./StringListInput"));
const SettingsDrawer = lazy(() => import("./SettingsDrawer"));
const StudentsList = lazy(() => import("./StudentsList"));
const TemplateEditor = lazy(() => import("./TemplateEditor"));
const CourseInfoCard = lazy(() => import("./CourseInfoCard"));

// 导入类型
import {
  ClassTime,
  HistorysType,
  HistoryType,
  PromptItem,
  PromptType,
} from "./types";

// 导入自定义Hook
import { useStudentsManager } from "../hooks";

// 导入常量和工具函数
import { PROMPTS } from "./constants";
import {
  addToLocalStorageArray,
  getLocalStorage,
  getPromptFromLocalStorage,
  replaceTemplate,
  batchGetLocalStorage,
  safeJsonParse,
} from "../utils";

// 定义默认模板
const DEFAULT_TEMPLATE = `**课程名称:** {{courseName}}

**授课时间:** {{courseTime}}

**课程内容概览:**
{{courseContents}}

**教学目标:**
{{courseObjectives}}

**课堂表现:**
{{courseFeedback}}

{{signature}}
{{currentDate}}`;

// 定义课程反馈模板，{{courseFeedback}}为占位符
const AI_TEMPLATE = `**课程名称:** {{courseName}}

**授课时间:** {{courseTime}}

**课程内容概览:**
{{courseContents}}

**教学目标:**
{{courseObjectives}}`;

const HISTORY_LENGTH = 20; // 历史记录的最大长度

// let template = DEFAULT_TEMPLATE;
// 定义可用的占位符
// const PLACEHOLDERS = {...};


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
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
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
    }, { timeout: 2000 });
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

const getStudentContentV2Text = (
  total: string,
  mastery_situation: string,
  attention: string,
  interaction: string,
  other: string,
) => {
  return `整体表现:${total},掌握情况:${mastery_situation},专注度:${attention},参与度:${interaction},其他:${other}`;
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
  const [customTemplate, setCustomTemplate] = useState(DEFAULT_TEMPLATE);
  const [exportTemplate, setExportTemplate] = useState(DEFAULT_TEMPLATE);
  // 使用ref而不是state存储AI模板，因为它对UI不可见
  const aiTemplateRef = useRef(AI_TEMPLATE);
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
      "ai-model"
    ];

    // 使用优化的批量读取函数
    const localStorageData = batchGetLocalStorage(localStorageKeys);

    // 批量设置状态
    let historyData = safeJsonParse(localStorageData["class-history"], {});

    // Migration logic for history data
    const needsMigration = Object.keys(historyData).some(
      (key) => !dayjs(key).isValid(),
    );

    if (needsMigration) {
      const migratedHistory: HistorysType = {};
      let migrationDate = dayjs("2000-01-01T00:00:00.000Z"); // Use a fixed base date

      Object.entries(historyData).forEach(([key, value]) => {
        if (dayjs(key).isValid()) {
          // Already new format
          migratedHistory[key] = value as HistoryType;
        } else {
          // Old format (UUID key), needs migration
          const newKey = migrationDate.toISOString();
          migratedHistory[newKey] = {
            ...(value as Omit<HistoryType, "time">), // Cast to old structure type
            time: [newKey, newKey],
          };
          migrationDate = migrationDate.add(1, "day");
        }
      });

      historyData = migratedHistory;
      localStorage.setItem("class-history", JSON.stringify(historyData));
      sendMessage("课程历史记录已成功迁移到新版本。");
    }

    if (Object.keys(historyData).length > 0) {
      setHistory(historyData);
    }

    if (localStorageData["feedback-template"]) {
      setCustomTemplate(localStorageData["feedback-template"]);
      setExportTemplate(localStorageData["feedback-template"]);
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

    return () => {
      unsubscribe();
    };
  }, [sendMessage]);

  // 拷贝到剪切板
  const copyToClipboard = useCallback(
    (text: string) => {
      // 复制到剪贴板
      navigator.clipboard.writeText(text);
      sendMessage("已导出到剪切板.");
    },
    [sendMessage],
  );

  // 处理表单提交的回调函数
  const handleSubmit = useCallback(() => {
    // 获取表单数据
    const data = class_form.getFieldsValue();
    // 添加get方法以便获取表单字段值
    data.get = (key: string) => {
      return data[key];
    };
    // 获取班级名称
    const className: string = data.get("class-name");
    // 获取课程名称
    const courseName = data.get("course-name") as string;
    // 获取课程内容并格式化为列表
    const courseContents = data
      .get("course-contents")
      .map((item: { item: string }) => `- ${item.item}\n`) as string[];
    // 获取教学目标并格式化为列表
    const courseObjectives = data
      .get("course-objectives")
      .map((item: { item: string }) => `- ${item.item}\n`) as string[];
    // 获取课程时间范围
    const time = data.get("course-time") as [dayjs.Dayjs, dayjs.Dayjs];

    // 使用封装的替换函数处理模板
    const processedTemplate = replaceTemplate(customTemplate, {
      courseName,
      courseTime: time,
      courseContents,
      courseObjectives,
      signature,
    });

    setExportTemplate(processedTemplate);

    // 为AI调用准备模板
    const aiProcessedTemplate = replaceTemplate(AI_TEMPLATE, {
      courseName,
      courseTime: time,
      courseContents,
      courseObjectives,
    });

    // 使用ref存储AI模板
    aiTemplateRef.current = aiProcessedTemplate;

    // 保存班级数据到本地存储
    const saveData: ClassTime = {
      time: {
        first: time[0].format("YYYY-MM-DD HH:mm"),
        last: time[1].format("YYYY-MM-DD HH:mm"),
      },
    };

    localStorage.setItem(className, JSON.stringify(saveData));
    const classList = addToLocalStorageArray("class-name", className);
    setClasses(classList);

    // 添加到历史记录
    const new_history = {
      ...history,
    };
    const newKey = time[0].toISOString();
    new_history[newKey] = {
      courseName,
      courseContents: data.get("course-contents"),
      courseObjectives: data.get("course-objectives"),
      time: [time[0].toISOString(), time[1].toISOString()],
    };

    // 限制历史记录的长度
    const keys$ = Object.keys(new_history);
    if (keys$.length > HISTORY_LENGTH) {
      const delete_key = Object.keys(new_history)[0];
      delete new_history[delete_key];
    }
    // save
    setHistory(new_history);
    localStorage.setItem("class-history", JSON.stringify(new_history));

    // 标记表单已完成
    isFinishedRef.current = true;

    // 添加提交成功的反馈
    sendMessage("课程信息提交成功！");
  }, [class_form, history, sendMessage, customTemplate, signature]);

  // 导入班级数据
  const importClass = useCallback(
    (key: string, updateClassName = false) => {
      const data = localStorage.getItem(key);
      if (data) {
        // 解析数据并设置表单字段值
        const dataObj: ClassTime = JSON.parse(data); // 获取原始时间的星期几和时分信息
        const old_first_time = dayjs(dataObj.time.first);
        const old_last_time = dayjs(dataObj.time.last);

        // 计算新的时间：使用上周同一天同一时间
        const new_first_time = dayjs()
          .subtract(1, "week")
          .day(old_first_time.day())
          .hour(old_first_time.hour())
          .minute(old_first_time.minute());

        const new_last_time = dayjs()
          .subtract(1, "week")
          .day(old_last_time.day())
          .hour(old_last_time.hour())
          .minute(old_last_time.minute());

        const fieldsToUpdate: { [key: string]: [dayjs.Dayjs, dayjs.Dayjs] | string } = {
          "course-time": [new_first_time, new_last_time],
        };

        // 如果需要更新班级名称（从选择器触发时）
        if (updateClassName) {
          fieldsToUpdate["class-name"] = key;
        }

        class_form.setFieldsValue(fieldsToUpdate);
      } else {
        // 未找到数据时发送提示消息
        sendMessage("未找到该班级的数据, 请检查班级名是否正确.");
      }
      // 从本地存储获取学生列表
      loadStudentsFromStorage(key);
    },
    [class_form, sendMessage, loadStudentsFromStorage],
  );

  // 处理导入班级数据的回调函数
  const handleImport = useCallback(() => {
    // 从本地存储获取班级数据
    const key = class_form.getFieldValue("class-name") as string;
    if (!key || key === "") {
      sendWarning("请先输入班级名.");
      return;
    }
    importClass(key);
  }, [class_form, importClass, sendWarning]);

  // 处理班级选择
  const handleClassSelect = useCallback(
    (className: string) => {
      importClass(className, true);
    },
    [importClass]
  );

  // 处理历史记录删除
  const handleHistoryDelete = useCallback(
    (key: string) => {
      const newHistory = {
        ...history,
      };
      delete newHistory[key];
      setHistory(newHistory);
      localStorage.setItem(
        "class-history",
        JSON.stringify(newHistory),
      );
    },
    [history]
  );

  // 处理单次AI调用
  const handleSingleAIOptimize = useCallback(
    (index: number) => {
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
            const currentContent = prevInfo.content || "";
            let cleanedContent = currentContent.replace(
              /(?:(?:\*\*)?课堂表现.*?(?::|：)(?:\*\*)?)(?::|：)?/,
              "",
            );
            cleanedContent = cleanedContent.replace(
              /\d{4}年 ?\d{1,2}月\d{1,2}(?:日|天)/,
              "",
            );
            cleanedContent = cleanedContent.replace(/哆啦人工智能小栈/, "");
            cleanedContent = cleanedContent.trim();

            return {
              ...prevInfo,
              content: cleanedContent,
              loading: false
            };
          });
        },
        // 系统提示词
        { content: promptItems[promptKey].prompt, role: "system" },
        // 课程模板
        { content: aiTemplateRef.current, role: "user" },
        // 学生姓名
        {
          content: `学员姓名: ${studentsList[index]?.name || ""}`,
          role: "user",
        },
        // 学生课堂表现原始内容
        {
          content:
            studentsList[index]?.version === "v1"
              ? (content_form.getFieldValue(["content", index]) ?? "")
              : (() => {
                  // 调试输出
                  const formValues = content_form.getFieldsValue();
                  console.log(`学生${index}的表单数据:`, formValues);
                  console.log(`学生${index}的content字段:`, formValues.content?.[index]);

                  const total = content_form.getFieldValue(["content", index, "total"]) ?? "";
                  const mastery = content_form.getFieldValue(["content", index, "mastery_situation"]) ?? "";
                  const attention = content_form.getFieldValue(["content", index, "attention"]) ?? "";
                  const interaction = content_form.getFieldValue(["content", index, "interaction"]) ?? "";
                  const other = content_form.getFieldValue(["content", index, "other"]) ?? "";

                  console.log(`学生${index}各字段值:`, {total, mastery, attention, interaction, other});

                  return getStudentContentV2Text(total, mastery, attention, interaction, other);
                })(),
          role: "user",
        },
      );
    },
    [content_form, promptItems, promptKey, studentsList, updateStudentInfo],
  );

  // 处理AI优化学生课堂表现的回调函数
  const handleAIOptimize = useCallback(() => {
    if (isFinishedRef.current === false) {
      sendWarning("请先完成课程信息的填写. 或再次点击提交按钮.");
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
  }, [handleSingleAIOptimize, sendWarning, studentsList, studentsInfo]);

  // 加载历史数据
  const handleLoadHistoryData = useCallback(
    (key: string) => {
      const data = history[key];
      if (data) {
        class_form.setFieldsValue({
          "course-name": data.courseName,
          "course-contents": data.courseContents,
          "course-objectives": data.courseObjectives,
          "course-time": [dayjs(data.time[0]), dayjs(data.time[1])],
        });
      }
    },
    [class_form, history],
  );

  // 复制单个学生内容（带模板）
  const handleCopyStudentWithTemplate = useCallback(
    (index: number) => {
      // 获取表单数据
      const data = class_form.getFieldsValue();
      // 添加get方法以便获取表单字段值
      const get = (key: string) => data[key];

      // 获取课程名称
      const courseName = get("course-name") as string;

      // 获取课程内容并格式化为列表
      const courseContents =
        get("course-contents")?.map(
          (item: { item: string }) => `- ${item.item}\n`,
        ) || [];

      // 获取教学目标并格式化为列表
      const courseObjectives =
        get("course-objectives")?.map(
          (item: { item: string }) => `- ${item.item}\n`,
        ) || [];

      // 获取课程时间范围
      const time = get("course-time") as [dayjs.Dayjs, dayjs.Dayjs] | undefined;

      // 获取学生信息
      const student = studentsList[index];
      if (!student) return;

      // 添加学生标题
      let result = `### ${student.name}\n`;

      // 使用封装的替换函数处理模板
      const studentTemplate = replaceTemplate(exportTemplate, {
        studentName: student.name,
        courseName,
        courseTime: time,
        courseContents,
        courseObjectives,
        signature,
        courseFeedback: studentsInfo[index]?.content || "",
      });

      result += studentTemplate;

      // 复制到剪贴板
      copyToClipboard(result);
    },
    [
      class_form,
      copyToClipboard,
      exportTemplate,
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
      setExportTemplate(newTemplate);
      setSignature(newSignature);

      // 关闭模态框
      setIsTemplateModalVisible(false);
    },
    [],
  );

  return (
    <>
      {/* 设置抽屉 */}
      <Suspense fallback={
        <Spin size="large" />
      }>
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
            onFinish={handleSubmit}
            onFieldsChange={() => (isFinishedRef.current = false)}
            initialValues={{ items: [{}] }}
          >
            {/* 课程信息卡片 */}
            <Suspense fallback={<Spin size="large" />}>
              <CourseInfoCard
                form={class_form}
                classList={classList}
                history={history}
                onSubmit={handleSubmit}
                onImport={handleImport}
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
          <Suspense fallback={
            <Spin size="large" />
          }>
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
                    sendWarning(error instanceof Error ? error.message : "发生未知错误");
                  }
                }}
                onClear={clearAllStudents}
                onActive={(index, activated_list) => {
                  updateStudentInfo(index, { activated: activated_list[index] });
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
                        const className = class_form.getFieldValue("class-name");
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
                        const { activated, total } = getActivatedStudentsCount();
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
              <Suspense fallback={
                  <Spin size="large" />
              }>
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
          // 检查表单是否已提交
          if (!isFinishedRef.current) {
            sendWarning("内容可能不完整, 或未点击提交按钮.");
          }

          // 获取表单数据
          const data = class_form.getFieldsValue();
          // 添加get方法以便获取表单字段值
          const get = (key: string) => data[key];

          // 获取课程名称
          const courseName = get("course-name") as string;

          // 获取课程内容并格式化为列表
          const courseContents =
            get("course-contents")?.map(
              (item: { item: string }) => `- ${item.item}\n`,
            ) || [];

          // 获取教学目标并格式化为列表
          const courseObjectives =
            get("course-objectives")?.map(
              (item: { item: string }) => `- ${item.item}\n`,
            ) || [];

          // 获取课程时间范围
          const time = get("course-time") as
            | [dayjs.Dayjs, dayjs.Dayjs]
            | undefined;

          // 构建导出结果
          let result = "";
          for (const [index, student] of studentsList.entries()) {
            // 添加学生标题
            result += `### ${student.name}\n`;

            // 使用封装的替换函数处理模板
            const studentTemplate = replaceTemplate(exportTemplate, {
              studentName: student.name,
              courseName,
              courseTime: time,
              courseContents,
              courseObjectives,
              signature,
              courseFeedback: studentsInfo[index]?.content || "",
            });

            result += studentTemplate;

            // 添加分隔线
            result += "\n\n---\n";
          }

          // 复制到剪贴板
          copyToClipboard(result);
        }}
      />
      {/* 过滤导出按钮 */}
      <FloatButton
        icon={<FileTextFilled />}
        type="primary"
        tooltip="导出内容到剪切板(不包括空反馈的学生以及没有打勾的学生)."
        style={{ insetInlineEnd: 24 }}
        onClick={() => {
          // 检查表单是否已提交
          if (!isFinishedRef.current) {
            sendWarning("内容可能不完整, 或未点击提交按钮.");
          }

          // 获取表单数据
          const data = class_form.getFieldsValue();
          // 添加get方法以便获取表单字段值
          const get = (key: string) => data[key];

          // 获取课程名称
          const courseName = get("course-name") as string;

          // 获取课程内容并格式化为列表
          const courseContents =
            get("course-contents")?.map(
              (item: { item: string }) => `- ${item.item}\n`,
            ) || [];

          // 获取教学目标并格式化为列表
          const courseObjectives =
            get("course-objectives")?.map(
              (item: { item: string }) => `- ${item.item}\n`,
            ) || [];

          // 获取课程时间范围
          const time = get("course-time") as
            | [dayjs.Dayjs, dayjs.Dayjs]
            | undefined;

          // 构建导出结果
          let result = "";
          for (const [index, student] of studentsList.entries()) {
            if (
              studentsInfo[index]?.content === "" ||
              !studentsInfo[index]?.activated
            )
              continue;
            // 添加学生标题
            result += `### ${student.name}\n`;

            // 使用封装的替换函数处理模板
            const studentTemplate = replaceTemplate(exportTemplate, {
              studentName: student.name,
              courseName,
              courseTime: time,
              courseContents,
              courseObjectives,
              signature,
              courseFeedback: studentsInfo[index]?.content || "",
            });

            result += studentTemplate;

            // 添加分隔线
            result += "\n\n---\n";
          }

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
