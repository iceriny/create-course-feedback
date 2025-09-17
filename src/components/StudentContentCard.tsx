// Ant Design 图标 - 按需导入
import { LoadingOutlined, ReloadOutlined } from "@ant-design/icons";

// Ant Design 组件 - 按需导入
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

// React hooks
import { memo } from "react";

// 内部组件和类型
import CopyButton from "./CopyButton";
import { StudentsInfo, StudentContentPropsVersion } from "./types";

const { useToken } = theme;

// 单个学生内容卡片组件属性接口
interface StudentContentCardProps {
  student: string;
  index: number;
  studentInfo: StudentsInfo;
  propsVersion: StudentContentPropsVersion;
  handleSingleAIOptimize: (index: number) => void;
  copyToClipboard: (text: string) => void;
  copyStudentWithTemplate: (index: number) => void;
}


const StudentContentItem = [
  {
    itemKey: "total",
    label: "整体表现",
  },
  {
    itemKey: "mastery_situation",
    label: "掌握情况",
  },
  {
    itemKey: "attention",
    label: "专注度",
  },
  {
    itemKey: "interaction",
    label: "互动",
  },
  {
    itemKey: "other",
    label: "其他",
  }
];

/**
 * 单个学生内容卡片组件
 */
const StudentContentCard = memo(
  ({
    student,
    index,
    studentInfo,
    propsVersion,
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
        {propsVersion === "v1" ? (
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
        ) : (
          StudentContentItem.map((item) =>
            <Form.Item
              key={`${index}-${item.itemKey}`}
              name={["content", index, item.itemKey]}
              label={item.label}
              labelCol={{ span: 2 }}
            >
              <Input.TextArea
                disabled={!studentInfo.activated}
                size="small"
                autoSize={{
                  minRows: 1,
                  maxRows: 12,
                }}
                style={{ padding: "8px" }}
              />
            </Form.Item>
          )
        )}

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
