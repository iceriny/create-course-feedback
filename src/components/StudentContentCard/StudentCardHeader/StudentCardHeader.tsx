import { memo, useCallback } from "react";
import { Button, Flex, Select, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import CopyButton from "../../CopyButton";
import { StudentBasicInfo, StudentsInfo } from "../../types";

interface StudentCardHeaderProps {
  student: StudentBasicInfo;
  index: number;
  studentInfo: StudentsInfo;
  handleSingleAIOptimize: (index: number) => void;
  copyStudentWithTemplate: (index: number) => void;
  onUpdateStudentGender: (index: number, gender: "male" | "female") => void;
  onUpdateStudentVersion: (index: number, version: "v1" | "v2") => void;
}

// 性别选项配置
const GENDER_OPTIONS = [
  { label: "男", value: "male" },
  { label: "女", value: "female" }
];

// 版本选项配置
const VERSION_OPTIONS = [
  { label: "V1", value: "v1" },
  { label: "V2", value: "v2" }
];

/**
 * 学生卡片头部组件
 */
const StudentCardHeader = memo(({
  student,
  index,
  studentInfo,
  handleSingleAIOptimize,
  copyStudentWithTemplate,
  onUpdateStudentGender,
  onUpdateStudentVersion
}: StudentCardHeaderProps) => {

  // 处理性别变更
  const handleGenderChange = useCallback((value: "male" | "female") => {
    onUpdateStudentGender(index, value);
  }, [index, onUpdateStudentGender]);

  // 处理版本变更
  const handleVersionChange = useCallback((value: "v1" | "v2") => {
    onUpdateStudentVersion(index, value);
  }, [index, onUpdateStudentVersion]);

  // 处理AI优化
  const handleAIOptimize = useCallback(() => {
    handleSingleAIOptimize(index);
  }, [index, handleSingleAIOptimize]);

  // 处理复制
  const handleCopy = useCallback(() => {
    copyStudentWithTemplate(index);
  }, [index, copyStudentWithTemplate]);

  return (
    <Flex justify="space-between" align="center">
      <div style={{ display: "flex", alignItems: "center" }}>
        <Typography.Text style={{ alignContent: "center", marginRight: "20px" }}>
          <span style={{ marginRight: "20px" }}>
            {index + 1}
          </span>
          {student.name}
        </Typography.Text>

        <Select
          size="small"
          style={{ width: 80, marginRight: 10 }}
          options={GENDER_OPTIONS}
          value={student.gender}
          onChange={handleGenderChange}
        />

        <Select
          size="small"
          style={{ width: 60 }}
          options={VERSION_OPTIONS}
          value={student.version}
          onChange={handleVersionChange}
        />
      </div>

      <div style={{ display: "inline-flex", alignItems: "center" }}>
        <Button
          type="link"
          style={{ marginLeft: "1rem" }}
          size="small"
          icon={<ReloadOutlined />}
          onClick={handleAIOptimize}
          disabled={studentInfo.loading}
        >
          重新或单独生成
        </Button>

        <CopyButton
          disabled={!studentInfo.activated || studentInfo.loading}
          onClick={handleCopy}
        />
      </div>
    </Flex>
  );
});

StudentCardHeader.displayName = "StudentCardHeader";

export default StudentCardHeader;
