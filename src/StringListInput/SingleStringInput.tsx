import { Input } from "antd";
import type { InputProps as InputStringProps } from "antd";

export interface SingleNumberInputProps {
    defaultValue?: string;
    value?: string;
    id: string;
    index: number;
    onChange?: (value: string, index: number) => void;
    onPressEnter?: (value: string, index: number) => void;
    onBackspace?: (index: number) => void;
}
const SingleNumberInput: React.FC<SingleNumberInputProps> = ({
    defaultValue,
    value,
    id,
    index,
    onChange,
    onPressEnter,
    onBackspace,
}) => {
    const handleChange: InputStringProps["onChange"] = (value) => {
        const newValue = value.target.value;
        onChange?.(newValue, index);
    };
    const handlePressEnter: React.KeyboardEventHandler<HTMLInputElement> = (
        event
    ) => {
        const element = event.target as HTMLInputElement;
        onPressEnter?.(element.value, index);
    };
    const handleBackspace: React.KeyboardEventHandler<HTMLInputElement> = (
        event
    ) => {
        if (
            event.key === "Backspace" &&
            (event.target as HTMLInputElement).value === ""
        ) {
            onBackspace?.(index);
        }
    };
    return (
        <Input
            id={id}
            defaultValue={defaultValue}
            value={value}
            addonBefore={`${index + 1}`}
            type="text"
            size="small"
            placeholder="学生姓名"
            style={{
                width: `${
                    8 + (value === undefined ? 1 : value.toString().length - 1)
                }em`,
            }}
            onChange={handleChange}
            onPressEnter={handlePressEnter}
            onKeyDown={handleBackspace}
        />
    );
};

export default SingleNumberInput;
