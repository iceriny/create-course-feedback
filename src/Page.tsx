// 导入React核心组件和钩子
import { FC, useCallback, useRef, useState } from "react";

// 导入Ant Design图标组件
import {
    CloseOutlined,
    EllipsisOutlined,
    FileTextFilled,
    LoadingOutlined,
    ThunderboltOutlined,
} from "@ant-design/icons";
// 导入Ant Design UI组件
import {
    Button,
    Card,
    DatePicker,
    Drawer,
    Flex,
    FloatButton,
    Form,
    Input,
    Space,
    ConfigProvider,
    theme,
    Select,
    Collapse,
} from "antd";
// 导入自定义组件
import StringListInput from "./StringListInput";

// 导入日期处理库
import dayjs from "dayjs";
// 导入消息接口类型
import type { JointContent } from "antd/es/message/interface";
// 导入AI API接口
import getAPI, { API } from "./AI_API";
// import { GetProps } from "antd/lib";

// type RangePickerProps = GetProps<typeof DatePicker.RangePicker>;

// 定义课程反馈模板，{{courseFeedback}}为占位符
let template = "{{courseFeedback}}";

// AI提示词模板，用于生成课程反馈内容
const PROMPT = `## 角色定位：编程教师
- 你是一位专注于小学和初高中学生编程教育的老师
- 以下[方括号]内容为重点要求

## 任务说明：
- 我会提供课程基本信息（课程名称、时间、内容概览、教学目标）
- 我会提供[单个]学生的课堂表现关键词
- 请针对这位学生的表现进行[优化扩写]，控制在[150字左右]

## 内容要求：
- [仅需撰写课堂表现部分]，不要修改其他内容
- 表现描述需[平衡指出优点和不足]，语气友善且有建设性
- [重要提醒]：这是发给家长的反馈，请注意家长感受和情绪
- [禁止添加虚构内容]，不要编造未提及的具体事件（如"某某最先完成..."）
- 使用[宏观描述]而非具体课堂细节
- 语言风格[自然口语化]，避免过于正式或官方的表述，要更亲切，接地气

## 输出格式：
请直接输出课堂表现文本，无需包含任何格式标记或额外内容`;
//  `## 你是一个编程老师, 主要教小学和初高中的同学学习编程.
// - 下文中标记[something]的内容是重点需要注意的内容
// ### 现在有一个任务:
// - 我{user}提供你基本信息, 具体为课程名, 时间, 课程内容, 教学目标.
// - 还会给你[单个]学生的课堂表现, 请你针对这个同学的课堂表现内容[优化]扩写, [大约150字].
// - [其中课堂表现是你唯一要写的内容].
// - [在写课堂表现时候, 要指出优点, 表明缺点, 并且要注意语气和礼貌.]
// - [请记住!!这是给家长提供的课程反馈, 一定要注意到家长的情绪.]
// - [禁止出现额外的你自己猜想的\`剧情\`, 不要编写没有明确存在的具体事件, 比如\`某某在xxx最先...\`这样的内容]
// - [请用更通用和宏观的语言表述问题,而非展示课堂细节.]
// - [请不要用太正式官方的语气, 要更口语化, 接地气一点.]

// ## 请仅仅回复课程反馈的正文部分, 不包括其任何无关的格式或内容.`;

// 从DatePicker组件中解构出RangePicker组件
const { RangePicker } = DatePicker;

// 定义组件Props接口
interface PageProps {
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

// 在LocalStorage中的 数组数据 增量添加数据
function addToLocalStorageArray(key: string, ...values: string[]) {
    // 从本地存储中获取数组
    const array: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    // 如果数组中已经存在该值，则不添加
    for (const value of values) {
        if (array.includes(value)) continue;
        // 向数组中添加新值
        array.push(value);
    }
    // 将数组保存到本地存储
    localStorage.setItem(key, JSON.stringify(array));
    return array;
}

// 获取LocalStorage中的 数组数据
function getLocalStorage(key: string) {
    const array = JSON.parse(localStorage.getItem(key) ?? "[]");
    return array;
}

interface ClassTime {
    readonly time: {
        readonly first: string;
        readonly last: string;
    };
}
interface StudentsInfo {
    name: string;
    content: string;
    think_content: string;
    loading: boolean;
}
// 主页组件定义
const Page: FC<PageProps> = ({ sendMessage, sendWarning }) => {
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
    // 用于存储班级列表
    const [classList, setClasses] = useState<string[]>(
        getLocalStorage("class-name")
    );
    // 标记表单是否已提交
    const isFinishedRef = useRef(false);
    // 设置抽屉是否打开的状态
    const [open, setOpen] = useState(false);
    // 获取主题token
    const { token } = useToken();

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
            `**课程名称:** 《${courseName}》\n` +
            `**授课时间:** @${time[0].format(
                "YYYY[年] MM[月]DD[日] HH:mm"
            )} -> ${time[1].format("HH:mm")}\n` +
            `**课程内容概览:**\n${courseContents.join("")}\n` +
            `**教学目标:**\n${courseObjectives.join("")}\n` +
            "**课堂表现:**\n" +
            "{{courseFeedback}}\n\n" +
            "哆啦人工智能小栈\n" +
            `${dayjs().format("YYYY[年] MM[月]DD[日]")}`;
        // 保存数据到本地存储
        const saveData: ClassTime = {
            time: {
                first: time[0].format("YYYY-MM-DD HH:mm"),
                last: time[1].format("YYYY-MM-DD HH:mm"),
            },
        };

        localStorage.setItem(className, JSON.stringify(saveData));
        const classList = addToLocalStorageArray("class-name", className);
        setClasses(classList);
        // 标记表单已完成
        isFinishedRef.current = true;
    }, [class_form]);

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
                setStudents(JSON.parse(students_str));
                // 为新增学生初始化内容
                const new_students_info = { ...students_info };
                for (const [index, value] of students.entries()) {
                    new_students_info[index] = {
                        name: value,
                        content: "",
                        think_content: "",
                        loading: false,
                    };
                }
                setStudentsInfo(new_students_info);
            }
        },
        [class_form, sendMessage, students, students_info]
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
            const new_content = { ...students_info };
            console.log("new_content:", new_content);
            new_content[index].loading = true;
            setStudentsInfo(new_content);
            // 调用AI API发送消息
            getAPI().sendMessage(
                // 成功回调，更新文本区域内容
                (content) => {
                    if (!content) return;
                    // content_form.setFieldValue(["content", index], content);
                    console.log("content:", content);
                    new_content[index].content = content;
                    setStudentsInfo(new_content);
                },
                // `完成`回调（空函数）
                () => {
                    const new_content = { ...students_info };
                    new_content[index].loading = false;
                    setStudentsInfo(new_content);
                },
                // 系统提示词
                { content: PROMPT, role: "system" },
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
            // 在文本区域添加等待提示
            // content_form.setFieldValue(
            //     ["content", index],
            //     content_form.getFieldValue(["content", index]) +
            //         "[请稍后, AI 正在思考...]"
            // );
        }
    }, [content_form, sendWarning, students, students_info]);

    return (
        <>
            {/* 设置抽屉 */}
            <Drawer
                title="设置"
                onClose={() => {
                    setOpen(false);
                }}
                open={open}
            >
                {/* API Key输入框 */}
                <Input
                    addonBefore="请输入API Key"
                    placeholder={
                        API.tokenReady() ? API.getMackToken() : "请输入"
                    }
                    onChange={(event) => {
                        const api_key = event.target.value.trim();
                        API.setToken(api_key);
                        localStorage.setItem("api_key", api_key);
                    }}
                />
            </Drawer>
            {/* 主体内容 */}
            <Flex vertical gap={20} justify="center" align="center">
                {/* 课程信息表单 */}
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
                        size="small"
                        title={`课程信息`}
                        style={{ minWidth: "800px" }}
                        actions={[
                            // 提交按钮
                            <Button
                                style={{ width: "100%" }}
                                type="link"
                                htmlType="submit"
                            >
                                提交
                            </Button>,
                            // AI优化按钮
                            <Button type="link" onClick={handleAIOptimize}>
                                <ThunderboltOutlined />
                                AI 优化
                            </Button>,
                            // 导入按钮
                            <Button
                                style={{ width: "100%" }}
                                type="link"
                                onClick={handleImport}
                            >
                                导入
                            </Button>,
                        ]}
                        // TODO: 完成卡片折叠 extra={}
                    >
                        {/* 班级名表单项 */}
                        <Form.Item
                            label="班级名"
                            name="class-name"
                            rules={[{ required: true }]}
                        >
                            <Input
                                addonAfter={
                                    <Select
                                        defaultValue={null}
                                        style={{ width: 120 }}
                                        onSelect={(value: string | null) => {
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

                        {/* 课程名称表单项 */}
                        <Form.Item
                            label="课程名称"
                            name="course-name"
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>

                        {/* 授课时间表单项 */}
                        <Form.Item
                            label="授课时间"
                            name="course-time"
                            rules={[{ required: true }]}
                        >
                            <RangePicker
                                showTime={{ format: "HH:mm" }}
                                format="YYYY-MM-DD HH:mm"
                                onChange={(value, dateString) => {
                                    console.log("Selected Time: ", value);
                                    console.log(
                                        "Formatted Selected Time: ",
                                        dateString
                                    );
                                }}
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
                                                    rules={[{ required: true }]}
                                                >
                                                    <Input
                                                        style={{ width: 350 }}
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
                                        validator: async (_, objectives) => {
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
                                                    rules={[{ required: true }]}
                                                >
                                                    <Input
                                                        style={{ width: 350 }}
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
                {/* 学生列表输入组件 */}
                <StringListInput
                    style={{ width: "800px" }}
                    values_={students}
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
                    onClick={() => {}}
                />
                {/* 学生内容表单 */}
                <Form form={content_form} name="student-content">
                    {/* 遍历学生列表生成内容卡片 */}
                    {students.map((student, index) => (
                        <Card
                            style={{ minWidth: "800px" }}
                            key={index}
                            size="small"
                            title={
                                <span>
                                    <span style={{ marginRight: "20px" }}>
                                        {index + 1}
                                    </span>
                                    {student}
                                </span>
                            }
                        >
                            {/* 学生课堂表现输入框 */}
                            <Form.Item name={["content", index]}>
                                <Input.TextArea
                                    size="small"
                                    title="填写学生课堂表现关键词"
                                    autoSize={{ minRows: 1, maxRows: 12 }}
                                    // onChange={(e) => {
                                    //     // 更新学生内容引用
                                    //     studentsContentRef.current.set(
                                    //         student,
                                    //         e.target.value
                                    //     );
                                    // }}
                                />
                            </Form.Item>

                            {
                                // 加载动画
                                students_info[index]?.loading && (
                                    <LoadingOutlined />
                                )
                            }
                            <Collapse
                                size="small"
                                items={[
                                    {
                                        key: `think_${index}`,
                                        label: "思考",
                                        children: (
                                            <p>
                                                {
                                                    // students_info[index]
                                                    //     ?.think_content
                                                }
                                            </p>
                                        ),
                                    },
                                    {
                                        key: `content_${index}`,
                                        label: "内容",
                                        children: (
                                            <p>
                                                {
                                                    students_info[index]
                                                        ?.think_content
                                                }
                                            </p>
                                        ),
                                    },
                                ]}
                                defaultActiveKey={[`content_${index}`]}
                            />
                        </Card>
                    ))}
                </Form>

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
                        navigator.clipboard.writeText(result);
                        sendMessage("已导出到剪切板.");
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
                                    color: API.tokenReady()
                                        ? undefined
                                        : "white",
                                }}
                            />
                        }
                        tooltip="展开设置面板."
                        style={{
                            insetBlockStart: 24,
                        }}
                        onClick={() => {
                            setOpen(true);
                        }}
                    />
                </ConfigProvider>
            </Flex>
        </>
    );
};
export default Page;
