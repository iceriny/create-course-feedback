import { Button, Flex } from "antd";
import { DeleteOutlined } from "@ant-design/icons";

import SingleNumberInput, { SingleNumberInputProps } from "./SingleStringInput";
import { useCallback, useEffect, useState } from "react";

interface NumberListInputProps {
    length?: number;
    values_?: string[];
    onChange?: (value: string[]) => void;
    onClear?: () => void;
    onClick?: (index: number, value?: string) => void;
    style?: React.CSSProperties;
    onActive?: (change_index: number, activated_list: boolean[]) => void;
}

function getSingleNumberInputComponent(
    length: number,
    props: Omit<Omit<Omit<SingleNumberInputProps, "index">, "id">, "value">,
    values?: string[],
    activated_list?: boolean[]
) {
    const components = [];
    for (let i = 0; i < length; i++) {
        components.push(
            <SingleNumberInput
                value={values?.[i]}
                key={i}
                id={"input-" + i}
                index={i}
                activated={activated_list?.[i]}
                {...props}
            />
        );
    }
    return components;
}

const Main: React.FC<NumberListInputProps> = ({
    values_,
    onChange,
    onClear,
    onClick,
    onActive,
    style,
}) => {
    const [values, setValues] = useState<string[]>(values_ || []);
    const [activated_list, setActivatedList] = useState<boolean[]>(
        values_?.map(() => true) || []
    );
    useEffect(() => {
        if (values_ === undefined) return;
        setValues(values_);
        // onChange?.(values_);
    }, [onChange, values_]);

    const handleActive = useCallback(
        (index: number) => {
            const new_list = [...activated_list];
            new_list[index] = !new_list[index];
            setActivatedList(new_list);
            onActive?.(index, new_list);
        },
        [activated_list, onActive]
    );

    const [length, setLength] = useState<number>(2);

    const handlePressEnter = (_: string, index: number) => {
        const target = document.getElementById(
            "input-" + (index + 1)
        )! as HTMLInputElement;
        target.focus();
        target.select();
    };
    const handleChange = useCallback(
        (value: string, index: number) => {
            const newValues = [...values];
            newValues[index] = value;
            setValues(newValues);
            onChange?.(newValues);
        },
        [values, onChange]
    );

    const onBackspace = (index: number) => {
        if (values.length > 0) {
            const newValues = [...values];
            newValues.splice(index, 1);
            setValues(newValues);
            onChange?.(newValues);
            document.getElementById("input-" + index)?.focus();
        }
    };
    useEffect(() => {
        const newLength = values.length + 1;
        if (length !== newLength) setLength(newLength);
    }, [values, length]);

    return (
        <Flex gap={10} align="center" wrap style={style}>
            {getSingleNumberInputComponent(
                length,
                {
                    onPressEnter: handlePressEnter,
                    onChange: handleChange,
                    onClick,
                    onBackspace,
                    onActive: handleActive,
                },
                values,
                activated_list
            )}
            {values.length > 0 && (
                <Button
                    type="default"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                        setValues([]);
                        setLength(2);
                        onClear?.();
                    }}
                />
            )}
        </Flex>
    );
};

export default Main;
