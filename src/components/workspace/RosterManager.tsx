import { Button, Flex, Input, Modal, Popconfirm } from "antd";
import Select from "../common/Select";
import { memo, useRef, useState } from "react";
import { useRosterStore } from "../../store/rosterStore";
import { cancelStudentGeneration } from "../../services/ai/workspaceGeneration";
import RosterMotionList from "./RosterMotionList";

const ManagedStudent = memo(function ManagedStudent({
  id,
  name,
}: {
  id?: string;
  name: string;
}) {
  const run = (
    action: (
      state: ReturnType<typeof useRosterStore.getState>,
      index: number,
    ) => void,
  ) => {
    if (!id) return;
    cancelStudentGeneration(id);
    const state = useRosterStore.getState();
    const index = state.studentsList.findIndex((student) => student.id === id);
    if (index >= 0) action(state, index);
  };
  return (
    <Flex data-roster-row={id} gap={8}>
      <Input
        aria-label={`修改 ${name} 姓名`}
        defaultValue={name}
        onBlur={(event) => {
          const nextName = event.currentTarget.value.trim() || name;
          event.currentTarget.value = nextName;
          if (nextName !== name)
            run((state, index) => state.renameStudent(index, nextName));
        }}
        onPressEnter={(event) => event.currentTarget.blur()}
      />
      <Popconfirm
        title={`移除 ${name} 及本次反馈？`}
        onConfirm={() => run((state, index) => state.removeStudent(index))}
      >
        <Button danger>移除</Button>
      </Popconfirm>
    </Flex>
  );
});

export default function RosterManager({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (studentId: string) => void;
}) {
  const students = useRosterStore((state) => state.studentsList);
  const defaultVersion = useRosterStore((state) => state.defaultStudentVersion);
  const [names, setNames] = useState("");
  const addedId = useRef("");

  return (
    <Modal
      title="管理学生名单"
      open={open}
      onCancel={onClose}
      footer={null}
      afterClose={() => {
        if (open) return;
        setNames("");
        if (addedId.current) {
          const id = addedId.current;
          addedId.current = "";
          onAdded(id);
        }
      }}
    >
      <Flex className="roster-defaults" align="end" gap={8} wrap>
        <label>
          班级默认记录方式
          <Select
            value={defaultVersion}
            onChange={useRosterStore.getState().setDefaultStudentVersion}
            options={[
              { value: "v1", label: "简要记录" },
              { value: "v2", label: "分项记录" },
            ]}
          />
        </label>
        {students.some((student) => student.version !== defaultVersion) && (
          <Button
            onClick={useRosterStore.getState().applyDefaultStudentVersion}
          >
            应用到全班
          </Button>
        )}
      </Flex>
      <label>
        添加学生
        <Input.TextArea
          value={names}
          onChange={(event) => setNames(event.target.value)}
          rows={4}
          placeholder="粘贴姓名，每行一人，也支持逗号、顿号和制表符。"
        />
      </label>
      <Button
        type="primary"
        className="add-students"
        disabled={!names.trim()}
        onClick={() => {
          const state = useRosterStore.getState();
          const before = state.studentsList.length;
          state.updateStudentsFromRawValues(
            [...state.getStudentNames(), names],
            state.activeClass,
          );
          const newStudent = useRosterStore.getState().studentsList[before];
          if (!newStudent?.id) return;
          addedId.current = newStudent.id;
          onClose();
        }}
      >
        添加到名单
      </Button>
      <RosterMotionList
        className="manage-students"
        order={JSON.stringify(students.map((student) => student.id))}
      >
        {students.map((student) => (
          <ManagedStudent
            key={student.id}
            id={student.id}
            name={student.name}
          />
        ))}
      </RosterMotionList>
    </Modal>
  );
}
