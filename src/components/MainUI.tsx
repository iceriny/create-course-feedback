import {
  CloseOutlined,
  EditOutlined,
  EllipsisOutlined,
  FileTextFilled,
  InfoCircleFilled,
  LoadingOutlined,
  ThunderboltOutlined,
  ExportOutlined,
  OrderedListOutlined,
  CheckSquareOutlined,
} from "@ant-design/icons";
import {
  Anchor,
  Button,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Flex,
  FloatButton,
  Form,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  theme,
  Tooltip,
  Typography,
} from "antd";
import type { JointContent } from "antd/es/message/interface";
import dayjs from "dayjs";
import {
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { v4 as uuid_v4 } from "uuid";
import { API, type ModelType } from "../AI_API";
import { downloadJson } from "../utilities";

// 导入子组件
const StringListInput = lazy(() => import("./StringListInput"));
const SettingsDrawer = lazy(() => import("./SettingsDrawer"));
const StudentsList = lazy(() => import("./StudentsList"));
const TemplateEditor = lazy(() => import("./TemplateEditor"));

// 导入类型
import {
  ClassTime,
  HistorysType,
  PromptItem,
  PromptType,
  StudentsInfo,
} from "./types";

// 导入常量和工具函数
import { PROMPTS } from "./constants";
import {
  addToLocalStorageArray,
  getLocalStorage,
  getPromptFromLocalStorage,
  replaceTemplate,
} from "./utils";

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

// 从DatePicker组件中解构出RangePicker组件
const { RangePicker } = DatePicker;

const ExportALLLocalStorage = () => {
  console.log(
    "=== EXPORT ALL LOCALSTORAGE ===\n--- Traversing with Object.keys ---"
  );
  const EXPORT_OBJECT: Record<string, string> = {};
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    try {
      // 尝试获取并打印
      const value = localStorage.getItem(key);
      console.log(`--- PARSE ---\nKey: ${key},\nValue: ${value}\n------`);
      EXPORT_OBJECT[key] = JSON.parse(value || "");
    } catch (e) {
      // 某些浏览器在特定模式下（如隐私模式）可能会在访问时抛出异常
      console.error(`Could not get item with key: ${key}`, e);
    }
  });
  console.log("\n--- EXPORTED ALL ---");
  // 下载导出对象
  downloadJson(
    EXPORT_OBJECT,
    `备份_${dayjs().format("YYYY-MM-DD-HH-mm")}.json`
  );
};
const ImportLocalStorage = (file: File) => {
  console.log("=== IMPORT LOCALSTORAGE ===");
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const content = event.target?.result as string;
      const data = JSON.parse(content);
      Object.keys(data).forEach((key) => {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
      console.log("=== IMPORT SUCCESS ===");
    } catch (error) {
      console.error("导入失败:", error);
    }
  };
  reader.readAsText(file);
};

// 定义组件Props接口
interface MainUIProps {
  // 发送普通消息的函数
  sendMessage: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction
  ) => void;
  // 发送警告消息的函数
  sendWarning: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction
  ) => void;
}

// 从theme中解构出useToken钩子
const { useToken } = theme;

// 修改预加载函数，确保组件正确初始化
const preloadComponents = () => {
  // 预加载所有懒加载组件
  const promises = [
    import("./StringListInput"),
    import("./SettingsDrawer"),
    import("./StudentsList"),
  ];

  // 不关心结果，只是为了预加载
  Promise.all(promises).catch((error) => {
    console.error("组件预加载失败:", error);
  });
};

/**
 * 主页组件
 */
const MainUI: FC<MainUIProps> = ({ sendMessage, sendWarning }) => {
  // 创建课程信息表单实例
  const [class_form] = Form.useForm();
  // 创建学生内容表单实例
  const [content_form] = Form.useForm();
  // 学生列表状态
  const [students, setStudents] = useState<string[]>([]);
  // 用于存储每个学生的信息
  const [students_info, setStudentsInfo] = useState<{
    [key: number]: StudentsInfo;
  }>({});
  // 提示词Key
  const [promptKey, setPromptKey] = useState<PromptType>("programming");
  // 提示词内容
  const [promptItems, setPromptItems] = useState<Record<string, PromptItem>>({
    ...PROMPTS,
    ...getPromptFromLocalStorage(),
  });
  // 用于存储班级列表
  const [classList, setClasses] = useState<string[]>(
    getLocalStorage("class-name")
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
    [setModel]
  );

  // 修改useEffect中的预加载代码，确保在正确的时机加载
  useEffect(() => {
    const h = localStorage.getItem("class-history");
    if (h) {
      setHistory(JSON.parse(h));
    }

    // 加载保存的模板和签名
    const savedTemplate = localStorage.getItem("feedback-template");
    if (savedTemplate) {
      setCustomTemplate(savedTemplate);
      setExportTemplate(savedTemplate);
    }

    const savedSignature = localStorage.getItem("signature");
    if (savedSignature) {
      setSignature(savedSignature);
    }

    // 确保DOM已经渲染
    const timer = setTimeout(() => {
      preloadComponents();
    }, 1000);

    // 添加节流状态监听器
    // const api = getAPI();
    const unsubscribe = API.addThrottleListener((isThrottled, message) => {
      setIsThrottled(isThrottled);
      setThrottleMessage(message);
    });

    const aiModel = localStorage.getItem("ai-model");
    if (aiModel) {
      setModel(JSON.parse(aiModel));
      API.setModel(JSON.parse(aiModel));
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // 拷贝到剪切板
  const copyToClipboard = useCallback(
    (text: string) => {
      // 复制到剪贴板
      navigator.clipboard.writeText(text);
      sendMessage("已导出到剪切板.");
    },
    [sendMessage]
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
    const Already_Existing_Names = new Set();
    for (const key in new_history) {
      const { courseName: _courseName } = new_history[key];
      Already_Existing_Names.add(_courseName);
    }

    if (Already_Existing_Names.has(courseName)) {
      for (const key in new_history) {
        const { courseName: _courseName } = new_history[key];
        if (_courseName === courseName) {
          new_history[key] = {
            courseName,
            courseContents: data.get("course-contents"),
            courseObjectives: data.get("course-objectives"),
          };
        }
      }
    } else {
      const newKey = uuid_v4();
      new_history[newKey] = {
        courseName,
        courseContents: data.get("course-contents"),
        courseObjectives: data.get("course-objectives"),
      };
    }

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
    (key: string) => {
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

        class_form.setFieldsValue({
          "course-time": [new_first_time, new_last_time],
        });
      } else {
        // 未找到数据时发送提示消息
        sendMessage("未找到该班级的数据, 请检查班级名是否正确.");
      }
      // 从本地存储获取学生列表
      const students_str = localStorage.getItem(`${key}_std`);
      if (students_str) {
        // 设置学生列表状态
        const _students: string[] = JSON.parse(students_str);
        setStudents(_students);
        // 为新增学生初始化内容
        const new_students_info: { [key: number]: StudentsInfo } = {};
        for (const [index, value] of _students.entries()) {
          new_students_info[index] = {
            name: value,
            content: "",
            think_content: "",
            loading: false,
            activated: true,
          };
        }
        setStudentsInfo(new_students_info);
      }
    },
    [class_form, sendMessage]
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

  // 处理单次AI调用
  const handleSingleAIOptimize = useCallback(
    (index: number) => {
      // 创建一个对象更新函数，避免更新整个students_info对象
      setStudentsInfo((prevInfo) => {
        const updatedInfo = { ...prevInfo };
        updatedInfo[index] = {
          ...updatedInfo[index],
          loading: true,
        };
        return updatedInfo;
      });

      // 调用AI API发送消息
      new API().sendMessage(
        // 成功回调，更新文本区域内容
        (content, type) => {
          if (type === null || content === null) return;

          // 使用函数式更新，只更新特定学生的内容
          setStudentsInfo((prevInfo) => {
            const updatedInfo = { ...prevInfo };

            switch (type) {
              case "content":
                updatedInfo[index] = {
                  ...updatedInfo[index],
                  content: content,
                };
                break;
              case "reasoning_content":
                updatedInfo[index] = {
                  ...updatedInfo[index],
                  think_content: content,
                };
                break;
              default:
                console.warn("未知的type");
                break;
            }

            return updatedInfo;
          });
        },
        // `完成`回调
        () => {
          setStudentsInfo((prevInfo) => {
            const updatedInfo = { ...prevInfo };
            let _content = updatedInfo[index].content.replace(
              /(?:(?:\*\*)?课堂表现.*?(?::|：)(?:\*\*)?)(?::|：)?/,
              ""
            );
            _content = _content.replace(
              /\d{4}年 ?\d{1,2}月\d{1,2}(?:日|天)/,
              ""
            );
            _content = _content.replace(/哆啦人工智能小栈/, "");
            _content = _content.trim();

            updatedInfo[index] = {
              ...updatedInfo[index],
              content: _content,
              loading: false,
            };

            return updatedInfo;
          });
        },
        // 系统提示词
        { content: promptItems[promptKey].prompt, role: "system" },
        // 课程模板
        { content: aiTemplateRef.current, role: "user" },
        // 学生姓名
        { content: `学员姓名: ${students[index]}`, role: "user" },
        // 学生课堂表现原始内容
        {
          content: content_form.getFieldValue(["content", index]) ?? "",
          role: "user",
        }
      );
    },
    [content_form, promptItems, promptKey, students]
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
    for (const [index] of students.entries()) {
      if (students_info[index].activated) {
        handleSingleAIOptimize(index);
      }
    }
  }, [handleSingleAIOptimize, sendWarning, students, students_info]);

  // 加载历史数据
  const handleLoadHistoryData = useCallback(
    (key: string) => {
      const data = history[key];
      if (data) {
        class_form.setFieldsValue({
          "course-name": data.courseName,
          "course-contents": data.courseContents,
          "course-objectives": data.courseObjectives,
        });
      }
    },
    [class_form, history]
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
          (item: { item: string }) => `- ${item.item}\n`
        ) || [];

      // 获取教学目标并格式化为列表
      const courseObjectives =
        get("course-objectives")?.map(
          (item: { item: string }) => `- ${item.item}\n`
        ) || [];

      // 获取课程时间范围
      const time = get("course-time") as [dayjs.Dayjs, dayjs.Dayjs] | undefined;

      // 获取学生名称
      const student = students[index];

      // 添加学生标题
      let result = `### ${student}\n`;

      // 使用封装的替换函数处理模板
      const studentTemplate = replaceTemplate(exportTemplate, {
        courseName,
        courseTime: time,
        courseContents,
        courseObjectives,
        signature,
        courseFeedback: students_info[index]?.content || "",
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
      students,
      students_info,
    ]
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
    []
  );

  return (
    <>
      {/* 设置抽屉 */}
      <Suspense fallback={<div>加载中...</div>}>
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
      <Suspense fallback={<div>加载中...</div>}>
        <TemplateEditor
          isOpen={isTemplateModalVisible}
          onClose={() => setIsTemplateModalVisible(false)}
          onSave={handleTemplateSave}
          initialTemplate={customTemplate}
          initialSignature={signature}
          sendMessage={sendMessage}
        />
      </Suspense>

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
            <Card
              id="course-info-card"
              size="default"
              title={
                <>
                  <InfoCircleFilled
                    style={{
                      marginRight: "2rem",
                      color: token.colorPrimary,
                    }}
                  />
                  课程信息
                </>
              }
              style={{
                minWidth: "800px",
                boxShadow: "10px 10px 80px 10px rgba(0, 0, 0, 0.1)",
              }}
              actions={[
                // 提交按钮
                <Button
                  key="submit"
                  style={{ width: "100%" }}
                  type="link"
                  htmlType="submit"
                >
                  提交
                </Button>,
                // AI优化按钮
                <Button key="ai" type="link" onClick={handleAIOptimize}>
                  <ThunderboltOutlined />
                  AI 优化
                </Button>,
                // 导入按钮
                <Button
                  key="import"
                  style={{ width: "100%" }}
                  type="link"
                  onClick={handleImport}
                >
                  导入
                </Button>,
                // 自定义模板按钮
                <Button
                  key="template"
                  style={{ width: "100%" }}
                  type="link"
                  onClick={() => {
                    setIsTemplateModalVisible(true);
                  }}
                >
                  <EditOutlined />
                  自定义模板
                </Button>,
              ]}
            >
              {/* 班级名 表单项 */}
              <Form.Item
                label="班级名"
                name="class-name"
                rules={[{ required: true }]}
              >
                <Input
                  addonAfter={
                    <Select
                      defaultValue={null}
                      notFoundContent="无录入班级信息"
                      placeholder="选择班级"
                      style={{ width: 120 }}
                      onSelect={(value: string | null) => {
                        if (value !== null) {
                          importClass(value);
                          class_form.setFieldValue("class-name", value);
                        }
                      }}
                      options={classList.map((item) => ({
                        value: item,
                        label: item,
                      }))}
                    />
                  }
                />
              </Form.Item>

              {/* 课程名称 表单项 */}
              <Form.Item
                label="课程名称"
                name="course-name"
                rules={[{ required: true }]}
              >
                <Input
                  addonAfter={
                    <Select
                      defaultValue={null}
                      notFoundContent="无历史记录"
                      placeholder="历史记录"
                      style={{ width: 200 }}
                      onSelect={(value: string | null) => {
                        if (value !== null) {
                          handleLoadHistoryData(value);
                        }
                      }}
                      optionRender={(options) => {
                        const value = options?.value;
                        if (!value) return null;
                        return (
                          <Flex gap={10} align="center">
                            {options.data.label.length > 10
                              ? options.data.label.slice(0, 10) + "..."
                              : options.data.label}
                            <Button
                              icon={
                                <CloseOutlined
                                  style={{ color: token.colorError }}
                                />
                              }
                              type="link"
                              onClick={() => {
                                const newHistory = {
                                  ...history,
                                };
                                delete newHistory[value];
                                setHistory(newHistory);
                                localStorage.setItem(
                                  "class-history",
                                  JSON.stringify(newHistory)
                                );
                              }}
                            />
                          </Flex>
                        );
                      }}
                      options={Object.keys(history).map((key) => ({
                        value: key,
                        label: history[key].courseName,
                      }))}
                    />
                  }
                />
              </Form.Item>

              {/* 授课时间 表单项 */}
              <Form.Item
                label="授课时间"
                name="course-time"
                rules={[{ required: true }]}
              >
                <RangePicker
                  needConfirm={false}
                  renderExtraFooter={() => {
                    const pickerDate: dayjs.Dayjs[] =
                      class_form.getFieldValue("course-time");
                    const set = (date: dayjs.Dayjs[]) => {
                      class_form.setFieldValue("course-time", date);
                    };
                    return (
                      <Flex
                        style={{
                          width: "100%",
                          margin: "12px 0",
                          justifyContent: "end",
                        }}
                        gap={5}
                      >
                        <Tooltip
                          title="当前选择日期的昨天"
                          mouseEnterDelay={0.6}
                        >
                          <Button
                            style={{ padding: 12 }}
                            size="small"
                            type="link"
                            onClick={() => {
                              set([
                                pickerDate[0].subtract(1, "day"),
                                pickerDate[1].subtract(1, "day"),
                              ]);
                            }}
                          >
                            昨天
                          </Button>
                        </Tooltip>
                        <Tooltip
                          title="当前选择日期的前一周同一天"
                          mouseEnterDelay={0.6}
                        >
                          <Button
                            style={{ padding: 12 }}
                            size="small"
                            type="link"
                            onClick={() => {
                              set([
                                pickerDate[0].subtract(1, "week"),
                                pickerDate[1].subtract(1, "week"),
                              ]);
                            }}
                          >
                            上周
                          </Button>
                        </Tooltip>
                        <Tooltip
                          title="将选择的日期设置为今天"
                          mouseEnterDelay={0.6}
                        >
                          <Button
                            style={{ padding: 12 }}
                            size="small"
                            type="primary"
                            onClick={() => {
                              let start = dayjs().startOf("day");
                              let end = dayjs().startOf("day");
                              console.log("pickerDate", pickerDate);
                              start = start
                                .set("hour", pickerDate[0].hour())
                                .set("minute", pickerDate[0].minute())
                                .set("second", pickerDate[0].second());
                              end = end
                                .set("hour", pickerDate[1].hour())
                                .set("minute", pickerDate[1].minute())
                                .set("second", pickerDate[1].second());
                              set([start, end]);
                            }}
                          >
                            本日
                          </Button>
                        </Tooltip>
                      </Flex>
                    );
                  }}
                  showTime={{ format: "HH:mm" }}
                  format="YYYY-MM-DD HH:mm"
                />
              </Form.Item>
              {/* 课程内容表单项 */}
              <Form.Item label="课程内容">
                <Form.List
                  name="course-contents"
                  rules={[
                    {
                      validator: async (_, contents) => {
                        if (!contents || contents.length < 1) {
                          return Promise.reject(
                            new Error("至少需要有一个课程内容")
                          );
                        }
                      },
                    },
                  ]}
                >
                  {(fields, opt, { errors }) => (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        rowGap: 16,
                      }}
                    >
                      {/* 遍历课程内容字段 */}
                      {fields.map((subField) => (
                        <Space key={subField.key}>
                          <Form.Item
                            noStyle
                            name={[subField.name, "item"]}
                            rules={[{ required: true }]}
                          >
                            <Input
                              style={{
                                width: 350,
                              }}
                              onPressEnter={() => {
                                opt.add();
                              }}
                              placeholder="填写课程内容"
                            />
                          </Form.Item>
                          {/* 删除按钮 */}
                          <CloseOutlined
                            onClick={() => {
                              opt.remove(subField.name);
                            }}
                          />
                        </Space>
                      ))}
                      {/* 添加课程内容按钮 */}
                      <Button type="dashed" onClick={() => opt.add()} block>
                        + 添加课程内容
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </div>
                  )}
                </Form.List>
              </Form.Item>
              {/* 教学目标表单项 */}
              <Form.Item label="教学目标">
                <Form.List
                  name="course-objectives"
                  rules={[
                    {
                      validator: async (_, objectives) => {
                        if (!objectives || objectives.length < 1) {
                          return Promise.reject(
                            new Error("至少需要有一个课程目标")
                          );
                        }
                      },
                    },
                  ]}
                >
                  {(fields, opt, { errors }) => (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        rowGap: 16,
                      }}
                    >
                      {fields.map((subField) => (
                        <Space key={subField.key}>
                          <Form.Item
                            noStyle
                            name={[subField.name, "item"]}
                            rules={[{ required: true }]}
                          >
                            <Input
                              style={{
                                width: 350,
                              }}
                              placeholder="填写课程内容"
                            />
                          </Form.Item>
                          {/* 删除按钮 */}
                          <CloseOutlined
                            onClick={() => {
                              opt.remove(subField.name);
                            }}
                          />
                        </Space>
                      ))}
                      {/* 添加课程内容按钮 */}
                      <Button type="dashed" onClick={() => opt.add()} block>
                        + 添加课程内容
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </div>
                  )}
                </Form.List>
              </Form.Item>
            </Card>
          </Form>
        </Col>
        <Col span={6}>
          {/* 学生列表输入组件 */}
          <Suspense fallback={<div>加载中...</div>}>
            <Flex vertical gap={10}>
              <StringListInput
                values_={students}
                activated_list_={Object.values(students_info).map(
                  (student) => student.activated
                )}
                onChange={(values) => {
                  // 获取班级名称
                  const className = class_form.getFieldValue("class-name");
                  if (!className) return;
                  // 为新增学生初始化内容
                  const new_students_info = {
                    ...students_info,
                  };
                  for (const [index, value] of values.entries()) {
                    new_students_info[index] = {
                      name: value,
                      content: "",
                      think_content: "",
                      loading: false,
                      activated: true,
                    };
                  }
                  setStudentsInfo(new_students_info);
                  // 更新学生列表状态
                  setStudents(values);
                  // 保存学生列表到本地存储
                  localStorage.setItem(
                    `${className}_std`,
                    JSON.stringify(values)
                  );
                }}
                onClear={() => {
                  // 清空学生内容引用和学生列表
                  setStudentsInfo({});
                  setStudents([]);
                }}
                onActive={(index, activated_list) => {
                  setStudentsInfo((prevInfo) => {
                    const updatedInfo = { ...prevInfo };
                    updatedInfo[index] = {
                      ...updatedInfo[index],
                      activated: activated_list[index],
                    };
                    return updatedInfo;
                  });
                }}
              />
              {students.length > 0 && (
                <Flex gap={10}>
                  <Tooltip placement="top" title="选择反转">
                    <Button
                      icon={<CheckSquareOutlined />}
                      size="small"
                      onClick={() => {
                        const new_students_info = {
                          ...students_info,
                        };
                        for (const key in new_students_info) {
                          new_students_info[key].activated =
                            !new_students_info[key].activated;
                        }
                        setStudentsInfo(new_students_info);
                      }}
                    />
                  </Tooltip>
                  <Tooltip placement="top" title="复制学生列表">
                    <Button
                      icon={<ExportOutlined />}
                      size="small"
                      onClick={() => {
                        copyToClipboard(students.join(", "));
                      }}
                    />
                  </Tooltip>
                  <Tooltip placement="top" title="按首字母顺序排序">
                    <Button
                      icon={<OrderedListOutlined />}
                      size="small"
                      onClick={() => {
                        const new_students = [...students].sort((a, b) =>
                          a.localeCompare(b)
                        );
                        setStudents(new_students);
                        const sortedStudents = Object.fromEntries(
                          Object.entries(students_info)
                            .map(([key, value]) => ({
                              key: Number(key),
                              value,
                            })) // 转换键为数字
                            .sort((a, b) =>
                              a.value.name.localeCompare(b.value.name)
                            ) // 按 name 排序
                            .map((item, index) => [index, item.value])
                        ) as Record<number, StudentsInfo>;

                        setStudentsInfo(sortedStudents);
                        const className =
                          class_form.getFieldValue("class-name");
                        if (!className) return;
                        localStorage.setItem(
                          `${className}_std`,
                          JSON.stringify(new_students)
                        );
                      }}
                    />
                  </Tooltip>
                  <Tooltip placement="top" title="人数统计">
                    <Typography.Text
                      style={{
                        textAlign: "center",
                      }}
                    >
                      {`${
                        Object.values(students_info).filter(
                          (item) => item.activated
                        ).length
                      }/${students.length}人`}
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
          <Form form={content_form} name="student-content">
            {/* 使用优化后的学生列表组件 */}
            <Suspense fallback={<div>加载中...</div>}>
              <StudentsList
                students={students}
                students_info={students_info}
                handleSingleAIOptimize={handleSingleAIOptimize}
                copyToClipboard={copyToClipboard}
                copyStudentWithTemplate={handleCopyStudentWithTemplate}
              />
            </Suspense>
          </Form>
        </Col>
        {/* 侧边锚点 */}
        <Col span={6}>
          {students.length > 0 && (
            <Anchor
              offsetTop={100}
              items={[
                {
                  key: "course-info-card-anchor",
                  title: "回到顶部",
                  href: "#course-info-card",
                },
              ].concat(
                students.map((value, index) => {
                  return {
                    key: `student-content-anchor-${index}`,
                    title: value,
                    href: `#student-content-${index}`,
                  };
                })
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
              (item: { item: string }) => `- ${item.item}\n`
            ) || [];

          // 获取教学目标并格式化为列表
          const courseObjectives =
            get("course-objectives")?.map(
              (item: { item: string }) => `- ${item.item}\n`
            ) || [];

          // 获取课程时间范围
          const time = get("course-time") as
            | [dayjs.Dayjs, dayjs.Dayjs]
            | undefined;

          // 构建导出结果
          let result = "";
          for (const [index, student] of students.entries()) {
            // 添加学生标题
            result += `### ${student}\n`;

            // 使用封装的替换函数处理模板
            const studentTemplate = replaceTemplate(exportTemplate, {
              courseName,
              courseTime: time,
              courseContents,
              courseObjectives,
              signature,
              courseFeedback: students_info[index]?.content || "",
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
              (item: { item: string }) => `- ${item.item}\n`
            ) || [];

          // 获取教学目标并格式化为列表
          const courseObjectives =
            get("course-objectives")?.map(
              (item: { item: string }) => `- ${item.item}\n`
            ) || [];

          // 获取课程时间范围
          const time = get("course-time") as
            | [dayjs.Dayjs, dayjs.Dayjs]
            | undefined;

          // 构建导出结果
          let result = "";
          for (const [index, student] of students.entries()) {
            if (
              students_info[index]?.content === "" ||
              !students_info[index]?.activated
            )
              continue;
            // 添加学生标题
            result += `### ${student}\n`;

            // 使用封装的替换函数处理模板
            const studentTemplate = replaceTemplate(exportTemplate, {
              courseName,
              courseTime: time,
              courseContents,
              courseObjectives,
              signature,
              courseFeedback: students_info[index]?.content || "",
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
