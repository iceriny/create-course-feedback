import { LoadingOutlined, ReloadOutlined } from "@ant-design/icons";
import {
    Button,
    Card,
    Collapse,
    Flex,
    Form,
    Input,
    Typography,
    theme,
} from "antd";
import { memo } from "react";
import CopyButton from "./CopyButton";
import { StudentsInfo } from "./types";

const { useToken } = theme;

// 单个学生内容卡片组件属性接口
interface StudentContentCardProps {
    student: string;
    index: number;
    studentInfo: StudentsInfo;
    handleSingleAIOptimize: (index: number) => void;
    copyToClipboard: (text: string) => void;
}

/**
 * 单个学生内容卡片组件
 */
const StudentContentCard = memo(
    ({
        student,
        index,
        studentInfo,
        handleSingleAIOptimize,
        copyToClipboard,
    }: StudentContentCardProps) => {
        const { token } = useToken();

        return (
            <Card
                id={`student-content-${index}`}
                style={{
                    marginBottom: "2rem",
                    boxShadow: "10px 10px 20px 10px rgba(0, 0, 0, 0.05)",
                }}
                key={index}
                size="small"
                title={
                    <Flex justify="space-between">
                        <Typography.Text>
                            <span
                                style={{
                                    marginRight: "20px",
                                }}
                            >
                                {index + 1}
                            </span>
                            {student}
                        </Typography.Text>
                        <Button
                            type="link"
                            style={{ marginLeft: "3rem" }}
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                handleSingleAIOptimize(index);
                            }}
                            disabled={
                                studentInfo.content.length === 0 ||
                                studentInfo.loading
                            }
                        >
                            重新生成
                        </Button>
                    </Flex>
                }
            >
                {/* 学生课堂表现输入框 */}
                <Form.Item name={["content", index]}>
                    <Input.TextArea
                        disabled={!studentInfo.activated}
                        size="small"
                        title="填写学生课堂表现关键词"
                        autoSize={{
                            minRows: 1,
                            maxRows: 12,
                        }}
                    />
                </Form.Item>

                {
                    // 加载动画
                    studentInfo?.loading && (
                        <LoadingOutlined
                            style={{
                                color: token.colorPrimary,
                            }}
                        />
                    )
                }
                {/* ai输出内容 */}
                {studentInfo.activated && (
                    <Collapse
                        size="small"
                        items={[
                            {
                                key: `think_${index}`,
                                label: (
                                    <Flex justify="space-between">
                                        思考
                                        <CopyButton
                                            disabled={
                                                !studentInfo.activated ||
                                                studentInfo.loading ||
                                                studentInfo.think_content === ""
                                            }
                                            onClick={() => {
                                                copyToClipboard(
                                                    studentInfo?.think_content
                                                );
                                            }}
                                        />
                                    </Flex>
                                ),
                                children: (
                                    <Typography.Paragraph type="secondary">
                                        {studentInfo?.think_content}
                                    </Typography.Paragraph>
                                ),
                            },
                            {
                                key: `content_${index}`,
                                label: (
                                    <Flex justify="space-between">
                                        内容
                                        <CopyButton
                                            disabled={
                                                !studentInfo.activated ||
                                                studentInfo.loading ||
                                                studentInfo.content === ""
                                            }
                                            onClick={() => {
                                                copyToClipboard(
                                                    studentInfo?.content
                                                );
                                            }}
                                        />
                                    </Flex>
                                ),
                                children: (
                                    <Typography.Paragraph
                                        style={{
                                            width: "100%",
                                        }}
                                    >
                                        {studentInfo?.content}
                                    </Typography.Paragraph>
                                ),
                            },
                        ]}
                        defaultActiveKey={[`content_${index}`]}
                    />
                )}
            </Card>
        );
    }
);

export default StudentContentCard;
