import {
    CloseOutlined,
    EllipsisOutlined,
    FileTextFilled,
    InfoCircleFilled,
    ThunderboltOutlined,
} from "@ant-design/icons";
import {
    Anchor,
    Button,
    Card,
    Col,
    ConfigProvider,
    DatePicker,
    FloatButton,
    Form,
    Input,
    Row,
    Select,
    Space,
    theme,
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
import getAPI, { API, type ModelType } from "../AI_API";

// 导入子组件
const StringListInput = lazy(() => import("./StringListInput"));
const SettingsDrawer = lazy(() => import("./SettingsDrawer"));
const StudentsList = lazy(() => import("./StudentsList"));

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
} from "./utils";

// 定义课程反馈模板，{{courseFeedback}}为占位符
let template = "{{courseFeedback}}";

// 从DatePicker组件中解构出RangePicker组件
const { RangePicker } = DatePicker;

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

    // 修改useEffect中的预加载代码，确保在正确的时机加载
    useEffect(() => {
        const h = localStorage.getItem("class-history");
        if (h) {
            setHistory(JSON.parse(h));
        }

        // 确保DOM已经渲染
        const timer = setTimeout(() => {
            preloadComponents();
        }, 1000);

        return () => clearTimeout(timer);
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
        // 构建课程反馈模板
        template =
            `**课程名称:**《${courseName}》\n\n` +
            `**授课时间:** @${time[0].format(
                "YYYY[年] MM[月]DD[日] HH:mm"
            )} -> ${time[1].format("HH:mm")}\n\n` +
            `**课程内容概览:**\n${courseContents.join("")}\n` +
            `**教学目标:**\n${courseObjectives.join("")}\n` +
            "**课堂表现:**\n" +
            "{{courseFeedback}}\n\n" +
            "哆啦人工智能小栈\n" +
            `${dayjs().format("YYYY[年] MM[月]DD[日]")}`;

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
        if (keys$.length > 10) {
            const delete_key = Object.keys(new_history)[0];
            delete new_history[delete_key];
        }
        // save
        setHistory(new_history);
        localStorage.setItem("class-history", JSON.stringify(new_history));

        // 标记表单已完成
        isFinishedRef.current = true;
    }, [class_form, history]);

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
            getAPI().sendMessage(
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
                { content: template, role: "user" },
                // 学生姓名
                { content: `学员姓名: ${students[index]}`, role: "user" },
                // 学生课堂表现原始内容
                {
                    content:
                        content_form.getFieldValue(["content", index]) ?? "",
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

    return (
        <>
            {/* 设置抽屉 */}
            <Suspense fallback={<div>加载中...</div>}>
                <SettingsDrawer
                    open={open}
                    setOpen={setOpen}
                    model={model}
                    setModel={setModel}
                    promptItems={promptItems}
                    setPromptItems={setPromptItems}
                    promptKey={promptKey}
                    setPromptKey={setPromptKey}
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
                                boxShadow:
                                    "10px 10px 80px 10px rgba(0, 0, 0, 0.1)",
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
                                <Button
                                    key="ai"
                                    type="link"
                                    onClick={handleAIOptimize}
                                >
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
                                            onSelect={(
                                                value: string | null
                                            ) => {
                                                if (value !== null) {
                                                    importClass(value);
                                                    class_form.setFieldValue(
                                                        "class-name",
                                                        value
                                                    );
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
                                            style={{ width: 120 }}
                                            onSelect={(
                                                value: string | null
                                            ) => {
                                                if (value !== null) {
                                                    handleLoadHistoryData(
                                                        value
                                                    );
                                                }
                                            }}
                                            options={Object.keys(history).map(
                                                (key) => ({
                                                    value: key,
                                                    label: history[key]
                                                        .courseName,
                                                })
                                            )}
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
                                                if (
                                                    !contents ||
                                                    contents.length < 1
                                                ) {
                                                    return Promise.reject(
                                                        new Error(
                                                            "至少需要有一个课程内容"
                                                        )
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
                                                        name={[
                                                            subField.name,
                                                            "item",
                                                        ]}
                                                        rules={[
                                                            { required: true },
                                                        ]}
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
                                                            opt.remove(
                                                                subField.name
                                                            );
                                                        }}
                                                    />
                                                </Space>
                                            ))}
                                            {/* 添加课程内容按钮 */}
                                            <Button
                                                type="dashed"
                                                onClick={() => opt.add()}
                                                block
                                            >
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
                                            validator: async (
                                                _,
                                                objectives
                                            ) => {
                                                if (
                                                    !objectives ||
                                                    objectives.length < 1
                                                ) {
                                                    return Promise.reject(
                                                        new Error(
                                                            "至少需要有一个课程目标"
                                                        )
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
                                                        name={[
                                                            subField.name,
                                                            "item",
                                                        ]}
                                                        rules={[
                                                            { required: true },
                                                        ]}
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
                                                            opt.remove(
                                                                subField.name
                                                            );
                                                        }}
                                                    />
                                                </Space>
                                            ))}
                                            {/* 添加课程内容按钮 */}
                                            <Button
                                                type="dashed"
                                                onClick={() => opt.add()}
                                                block
                                            >
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
                        <StringListInput
                            values_={students}
                            activated_list_={Object.values(students_info).map(
                                (student) => student.activated
                            )}
                            onChange={(values) => {
                                // 获取班级名称
                                const className =
                                    class_form.getFieldValue("class-name");
                                if (!className) return;
                                // 为新增学生初始化内容
                                const new_students_info = { ...students_info };
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
                            onClick={(index, value) => {
                                console.log("点击了学生:", index, value);
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

            {/* 导出按钮 */}
            <FloatButton
                icon={<FileTextFilled />}
                type="primary"
                tooltip="导出内容到剪切板."
                style={{ insetInlineEnd: 24 }}
                onClick={() => {
                    // 检查表单是否已提交
                    if (!isFinishedRef.current) {
                        sendWarning("内容可能不完整, 或未点击提交按钮.");
                    }
                    // 构建导出结果
                    let result = "";
                    for (const [index, student] of students.entries()) {
                        // 添加学生标题
                        result += `### ${student}\n`;
                        // 替换模板中的占位符
                        result += template.replace(
                            "{{courseFeedback}}",
                            students_info[index].content || ""
                        );
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
