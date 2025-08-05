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
  copyStudentWithTemplate: (index: number) => void;
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
    copyStudentWithTemplate,
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
            <Typography.Text style={{ alignContent: "center" }}>
              <span
                style={{
                  marginRight: "20px",
                }}
              >
                {index + 1}
              </span>
              {student}
            </Typography.Text>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Button
                type="link"
                style={{ marginLeft: "1rem" }}
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  handleSingleAIOptimize(index);
                }}
                disabled={studentInfo.loading}
              >
                重新或单独生成
              </Button>
              <CopyButton
                disabled={!studentInfo.activated || studentInfo.loading}
                onClick={() => {
                  copyStudentWithTemplate(index);
                }}
              />
            </div>
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
            style={{ padding: "8px" }}
          />
        </Form.Item>

        {
          // 加载动画
          studentInfo?.loading && (
            <Flex
              justify="center"
              align="center"
              style={{
                marginTop: "1rem",
                marginBottom: "1rem",
              }}
            >
              <LoadingOutlined
                style={{
                  fontSize: "1.5rem",
                  color: token.colorPrimary,
                }}
              />
            </Flex>
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
                        copyToClipboard(studentInfo?.think_content);
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
                        copyToClipboard(studentInfo?.content);
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
  },
);

export default StudentContentCard;
