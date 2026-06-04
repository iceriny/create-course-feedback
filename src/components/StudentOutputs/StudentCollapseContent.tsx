import { memo, useMemo } from "react";
import { Alert, Collapse, Flex, Typography } from "antd";
import CopyButton from "../CopyButton";
import { StudentsInfo } from "../types";

interface StudentCollapseContentProps {
  index: number;
  studentInfo: StudentsInfo;
  copyToClipboard: (text: string) => void;
}

/**
 * 学生输出内容折叠面板组件
 */
const StudentCollapseContent = memo(
  ({ index, studentInfo, copyToClipboard }: StudentCollapseContentProps) => {
    const quality = studentInfo.generation?.quality;
    const errorMessage = studentInfo.generation?.errorMessage;

    // 优化折叠面板配置，避免每次重新创建
    const collapseItems = useMemo(
      () => [
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
                  copyToClipboard(studentInfo.think_content);
                }}
              />
            </Flex>
          ),
          children: (
            <Typography.Paragraph type="secondary">
              {studentInfo.think_content}
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
                  copyToClipboard(studentInfo.content);
                }}
              />
            </Flex>
          ),
          children: (
            <Flex vertical gap={8}>
              {errorMessage && (
                <Alert showIcon type="error" title={errorMessage} />
              )}
              {quality && (
                <Alert
                  showIcon
                  type={quality.status === "pass" ? "success" : "warning"}
                  title={quality.status === "pass" ? "检查通过" : "建议确认"}
                  description={
                    quality.issues.length > 0
                      ? quality.issues.map((issue) => issue.message).join(" ")
                      : undefined
                  }
                />
              )}
              <Typography.Paragraph
                style={{
                  width: "100%",
                }}
              >
                {studentInfo.content}
              </Typography.Paragraph>
            </Flex>
          ),
        },
      ],
      [errorMessage, index, quality, studentInfo, copyToClipboard],
    );

    // 默认展开内容面板
    const defaultActiveKey = useMemo(() => [`content_${index}`], [index]);

    if (!studentInfo.activated) {
      return null;
    }

    return (
      <Collapse
        size="small"
        items={collapseItems}
        defaultActiveKey={defaultActiveKey}
      />
    );
  },
);

StudentCollapseContent.displayName = "StudentCollapseContent";

export default StudentCollapseContent;
