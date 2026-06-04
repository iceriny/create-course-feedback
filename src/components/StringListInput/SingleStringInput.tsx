import { Checkbox, Input, Space, theme } from "antd";
import type { InputProps as InputStringProps } from "antd";

export interface SingleNumberInputProps {
  defaultValue?: string;
  value?: string;
  activated?: boolean;
  id: string;
  index: number;
  onChange?: (value: string, index: number) => void;
  onPressEnter?: (value: string, index: number) => void;
  onBackspace?: (index: number) => void;
  onClick?: (index: number, value?: string) => void;
  onActive?: (index: number) => void;
}
const SingleNumberInput: React.FC<SingleNumberInputProps> = ({
  defaultValue,
  value,
  id,
  index,
  activated,
  onChange,
  onPressEnter,
  onBackspace,
  onClick,
  onActive,
}) => {
  const { token } = theme.useToken();
  const handleChange: InputStringProps["onChange"] = (value) => {
    const newValue = value.target.value;
    onChange?.(newValue, index);
  };
  const handlePressEnter: React.KeyboardEventHandler<HTMLInputElement> = (
    event,
  ) => {
    const element = event.target as HTMLInputElement;
    event.preventDefault();
    event.stopPropagation();
    onPressEnter?.(element.value, index);
  };
  const handleBackspace: React.KeyboardEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (
      event.key === "Backspace" &&
      (event.target as HTMLInputElement).value === ""
    ) {
      event.preventDefault();
      event.stopPropagation();
      onBackspace?.(index);
    }
  };
  const inputWidth = `${
    8 + (value === undefined ? 1 : value.toString().length - 1)
  }em`;

  return (
    <Space.Compact size="small" style={{ width: inputWidth }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: token.controlHeightSM,
          padding: `0 ${token.paddingXS}px`,
          color: token.colorText,
          background: token.colorFillAlter,
          border: `${token.lineWidth}px ${token.lineType} ${token.colorBorder}`,
          borderRight: 0,
          borderRadius: `${token.borderRadiusSM}px 0 0 ${token.borderRadiusSM}px`,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        onClick={() => {
          onClick?.(index, value);
        }}
      >
        <Checkbox
          style={{ paddingRight: "0.5em" }}
          checked={activated}
          onChange={() => {
            onActive?.(index);
          }}
        />
        {index + 1}
      </span>
      <Input
        id={id}
        defaultValue={defaultValue}
        value={value}
        type="text"
        size="small"
        placeholder="学生姓名"
        style={{
          flex: 1,
          minWidth: 0,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
        }}
        onChange={handleChange}
        onPressEnter={handlePressEnter}
        onKeyDown={handleBackspace}
      />
    </Space.Compact>
  );
};

export default SingleNumberInput;
