import { FC, useCallback, useRef, useState } from "react";

import {
    CloseOutlined,
    EllipsisOutlined,
    FileTextFilled,
    ThunderboltOutlined,
} from "@ant-design/icons";
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
} from "antd";
import StringListInput from "./StringListInput";

import dayjs from "dayjs";
import type { JointContent } from "antd/es/message/interface";
import getAPI, { API } from "./AI_API";
// import { GetProps } from "antd/lib";

// type RangePickerProps = GetProps<typeof DatePicker.RangePicker>;

let template = "{{courseFeedback}}";

const PROMPT = `## 你是一个编程老师, 主要教小学和初高中的同学学习编程.
### 现在有一个任务:
- 需要我提供你基本结构, 具体为课程名,时间, 课程内容, 教学目标,以及课堂表现
- 其中课堂表现是你唯一要写的内容.
- 你会根据提供的关键词扩写(大约150字)课堂表现.
- 在写课堂表现时候, 要指出优点,表明缺点, 并且要注意语气和礼貌.
- 请记住!!这是给家长提供的课程反馈, 一定要注意到家长的情绪.
- 禁止出现额外的你自己猜想的\`剧情\`, 不要编写没有明确存在的具体事件, 比如\`某某在xxx最先...\`这样的内容
- 请用更通用和宏观的语言表述问题,而非展示课堂细节.

## 请仅仅回复课程反馈的正文部分, 不包括其任何无关的格式或内容.`;

const { RangePicker } = DatePicker;

interface PageProps {
    sendMessage: (
        content: JointContent,
        duration?: number | VoidFunction,
        onClose?: VoidFunction
    ) => void;
    sendWarning: (
        content: JointContent,
        duration?: number | VoidFunction,
        onClose?: VoidFunction
    ) => void;
}
const Page: FC<PageProps> = ({ sendMessage, sendWarning }) => {
    const [class_form] = Form.useForm();
    const [content_form] = Form.useForm();
    const [students, setStudents] = useState<string[]>([]);
    const studentsContentRef = useRef<Map<string, string>>(new Map());
    const isFinishedRef = useRef(false);
    const [open, setOpen] = useState(false);

    const handleSubmit = useCallback(() => {
        const data = class_form.getFieldsValue();
        data.get = (key: string) => {
            return data[key];
        };
        const className = data.get("class-name");
        const courseName = data.get("course-name") as string;
        const courseContents = data
            .get("course-contents")
            .map((item: { item: string }) => `- ${item.item}\n`) as string[];
        const courseObjectives = data
            .get("course-objectives")
            .map((item: { item: string }) => `- ${item.item}\n`) as string[];
        const time = data.get("course-time") as [dayjs.Dayjs, dayjs.Dayjs];
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
            `${time[0].format("YYYY[年] MM[月]DD[日]")}`;
        // 数据过滤!
        const saveData = {
            time: {
                first: time[0].format("YYYY-MM-DD HH:mm"),
                last: time[1].format("YYYY-MM-DD HH:mm"),
            },
        };
        localStorage.setItem(className, JSON.stringify(saveData));
        isFinishedRef.current = true;
    }, [class_form]);
    const handleImport = useCallback(() => {
        const data = localStorage.getItem(
            class_form.getFieldValue("class-name")
        );
        if (data) {
            const dataObj = JSON.parse(data);
            class_form.setFieldsValue({
                "course-time": [
                    dayjs(dataObj.time.first),
                    dayjs(dataObj.time.last),
                ],
            });
        } else {
            sendMessage("未找到该班级的数据, 请检查班级名是否正确.");
        }
        const students = localStorage.getItem(
            `${class_form.getFieldValue("class-name")}_std`
        );
        if (students) {
            setStudents(JSON.parse(students));
        }
    }, [class_form, sendMessage]);
    const handleAIOptimize = useCallback(() => {
        for (const [index] of students.entries()) {
            content_form.setFieldValue(
                ["content", index],
                "请稍后, AI 正在思考..."
            );
            getAPI().sendMessage(
                (content) => {
                    if (!content) return;
                    content_form.setFieldValue(["content", index], content);
                },
                () => {},
                { content: PROMPT, role: "system" },
                { content: template, role: "user" },
                {
                    content:
                        content_form.getFieldValue(["content", index]) ?? "",
                    role: "user",
                }
            );
        }
    }, [content_form, students]);
    return (
        <>
            <Drawer
                title="设置"
                onClose={() => {
                    setOpen(false);
                }}
                open={open}
            >
                <Input
                    addonBefore="请输入API Key"
                    onChange={(event) => {
                        console.log(event.target.value.trim());
                        API.setToken(event.target.value.trim());
                    }}
                />
            </Drawer>
            <Flex vertical gap={20} justify="center" align="center">
                <Form
                    labelCol={{ span: 6 }}
                    wrapperCol={{ span: 18 }}
                    form={class_form}
                    name="course-info"
                    autoComplete="off"
                    onFinish={handleSubmit}
                    initialValues={{ items: [{}] }}
                >
                    <Card
                        size="small"
                        title={`课程信息`}
                        style={{ minWidth: "800px" }}
                        actions={[
                            <Button type="link" htmlType="submit">
                                提交
                            </Button>,
                            <Button type="link" onClick={handleImport}>
                                导入
                            </Button>,
                            <Button type="link" onClick={handleAIOptimize}>
                                <ThunderboltOutlined />
                                AI 优化
                            </Button>,
                        ]}
                        // TODO: 完成卡片折叠 extra={}
                    >
                        <Form.Item
                            label="班级名"
                            name="class-name"
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            label="课程名称"
                            name="course-name"
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>

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
                                                <CloseOutlined
                                                    onClick={() => {
                                                        opt.remove(
                                                            subField.name
                                                        );
                                                    }}
                                                />
                                            </Space>
                                        ))}
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
                                                        placeholder="填写教学目标"
                                                    />
                                                </Form.Item>
                                                <CloseOutlined
                                                    onClick={() => {
                                                        opt.remove(
                                                            subField.name
                                                        );
                                                    }}
                                                />
                                            </Space>
                                        ))}
                                        <Button
                                            type="dashed"
                                            onClick={() => opt.add()}
                                            block
                                        >
                                            + 添加教学目标
                                        </Button>
                                        <Form.ErrorList errors={errors} />
                                    </div>
                                )}
                            </Form.List>
                        </Form.Item>
                    </Card>
                </Form>
                <StringListInput
                    style={{ width: "800px" }}
                    values_={students}
                    onChange={(values) => {
                        const className =
                            class_form.getFieldValue("class-name");
                        if (!className) return;
                        for (const value of values) {
                            if (!studentsContentRef.current.has(value)) {
                                studentsContentRef.current.set(value, "");
                            }
                        }
                        setStudents(values);
                        localStorage.setItem(
                            `${className}_std`,
                            JSON.stringify(values)
                        );
                    }}
                    onClear={() => {
                        studentsContentRef.current.clear();
                        setStudents([]);
                    }}
                    onClick={() => {}}
                />
                <Form form={content_form} name="student-content">
                    {students.map((student, index) => (
                        <Card
                            style={{ minWidth: "800px" }}
                            key={index}
                            size="small"
                            title={
                                <span>
                                    <span style={{ marginRight: "20px" }}>
                                        {index}
                                    </span>
                                    {student}
                                </span>
                            }
                        >
                            <Form.Item name={["content", index]}>
                                <Input.TextArea
                                    size="small"
                                    title="填写学生课堂表现关键词"
                                    autoSize={{ minRows: 1, maxRows: 12 }}
                                    onChange={(e) => {
                                        studentsContentRef.current.set(
                                            student,
                                            e.target.value
                                        );
                                    }}
                                />
                            </Form.Item>
                        </Card>
                    ))}
                </Form>

                <FloatButton
                    icon={<FileTextFilled />}
                    type="primary"
                    tooltip="导出内容到剪切板."
                    style={{ insetInlineEnd: 24 }}
                    onClick={() => {
                        if (!isFinishedRef.current) {
                            sendWarning("内容可能不完整, 或未点击提交按钮.");
                        }
                        let result = "";
                        for (const [index, student] of students.entries()) {
                            result += `### ${student}\n`;
                            result += template.replace(
                                "{{courseFeedback}}",
                                content_form.getFieldValue([
                                    "content",
                                    index,
                                ]) || ""
                            );
                            result += "\n\n---\n";
                        }
                        navigator.clipboard.writeText(result);
                        sendMessage("已导出到剪切板.");
                    }}
                />
                <FloatButton
                    icon={<EllipsisOutlined />}
                    tooltip="展开设置面板."
                    style={{ insetBlockStart: 24 }}
                    onClick={() => {
                        setOpen(true);
                    }}
                />
            </Flex>
        </>
    );
};
export default Page;
