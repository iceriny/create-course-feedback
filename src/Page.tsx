import { FC, useRef, useState } from "react";

import { CloseOutlined, FileTextFilled } from "@ant-design/icons";
import {
    Button,
    Card,
    DatePicker,
    FloatButton,
    Form,
    Input,
    Space,
} from "antd";
import StringListInput from "./StringListInput";

import dayjs from "dayjs";
// import { GetProps } from "antd/lib";

// type RangePickerProps = GetProps<typeof DatePicker.RangePicker>;

let template = "{{courseFeedback}}";

const { RangePicker } = DatePicker;
const Page: FC = () => {
    const [form] = Form.useForm();
    const [students, setStudents] = useState<string[]>([]);
    const studentsContentRef = useRef<Map<string, string>>(new Map());

    return (
        <>
            <Form
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                form={form}
                name="dynamic_form_complex"
                style={{ maxWidth: 600 }}
                autoComplete="off"
                initialValues={{ items: [{}] }}
            >
                <div
                    style={{
                        display: "flex",
                        rowGap: 16,
                        flexDirection: "column",
                    }}
                >
                    <Card
                        size="small"
                        title={`课程信息`}
                        // TODO: 完成卡片折叠 extra={}
                    >
                        <Form.Item label="课程名称" name="course-name">
                            <Input />
                        </Form.Item>

                        <Form.Item label="授课时间" name="course-time">
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
                            <Form.List name="course-contents">
                                {(fields, opt) => (
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
                                    </div>
                                )}
                            </Form.List>
                        </Form.Item>
                        <Form.Item label="教学目标">
                            <Form.List name="course-objectives">
                                {(fields, opt) => (
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
                                    </div>
                                )}
                            </Form.List>
                        </Form.Item>
                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                onClick={(e) => {
                                    console.log(e);
                                    console.log(form.getFieldsValue());
                                    const data = form.getFieldsValue();
                                    data.get = (key: string) => {
                                        return data[key];
                                    };
                                    const courseName = data.get(
                                        "course-name"
                                    ) as string;
                                    const courseContents = data
                                        .get("course-contents")
                                        .map(
                                            (item: { item: string }) =>
                                                `- ${item.item}\n`
                                        ) as string[];
                                    const courseObjectives = data
                                        .get("course-objectives")
                                        .map(
                                            (item: { item: string }) =>
                                                `- ${item.item}\n`
                                        ) as string[];
                                    const time = data.get("course-time") as [
                                        dayjs.Dayjs,
                                        dayjs.Dayjs
                                    ];
                                    template =
                                        `**课程名称:** ${courseName}\n` +
                                        `**授课时间:** @${time[0].format(
                                            "YYYY[年] MM[月]DD[日] HH:mm"
                                        )} -> ${time[1].format("HH:mm")}\n` +
                                        `**课程内容概览:**\n${courseContents}\n` +
                                        `**教学目标:**\n${courseObjectives}\n` +
                                        "**课堂表现:**\n" +
                                        "{{courseFeedback}}\n\n" +
                                        "哆啦人工智能小栈\n" +
                                        `${time[0].format(
                                            "YYYY[年] MM[月]DD[日]"
                                        )}`;
                                }}
                            >
                                提交
                            </Button>
                        </Form.Item>
                    </Card>
                </div>
            </Form>
            <StringListInput
                onChange={(values) => {
                    for (const value of values) {
                        if (!studentsContentRef.current.has(value)) {
                            studentsContentRef.current.set(value, "");
                        }
                    }
                    setStudents(values);
                }}
                onClear={() => {
                    studentsContentRef.current.clear();
                    setStudents([]);
                }}
            />
            {students.map((student, index) => (
                <Card key={index} title={student}>
                    <Input.TextArea
                        size="small"
                        title="填写学生课堂表现关键词"
                        defaultValue={studentsContentRef.current.get(student)}
                        onChange={(e) => {
                            studentsContentRef.current.set(
                                student,
                                e.target.value
                            );
                        }}
                    />
                </Card>
            ))}
            <FloatButton
                icon={<FileTextFilled />}
                type="primary"
                tooltip="导出"
                style={{ insetInlineEnd: 24 }}
                onClick={() => {
                    let result = "";
                    for (const student of students) {
                        result += `### ${student}\n`;
                        result += template.replace(
                            "{{courseFeedback}}",
                            studentsContentRef.current.get(student) || ""
                        );
                        result += "\n\n---\n";
                    }
                    navigator.clipboard.writeText(result);
                }}
            />
        </>
    );
};
export default Page;
