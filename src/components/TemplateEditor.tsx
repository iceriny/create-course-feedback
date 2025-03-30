import { Button, Input, Modal, Space, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { TemplateEditorProps } from "./types";

// 定义可用的占位符
const PLACEHOLDERS = {
    课程名称: "{{courseName}}",
    授课时间: "{{courseTime}}",
    课程内容概览: "{{courseContents}}",
    教学目标: "{{courseObjectives}}",
    课堂表现: "{{courseFeedback}}",
    著名: "{{signature}}",
    当前日期: "{{currentDate}}",
};

/**
 * 模板编辑器组件 - 用于编辑自定义反馈模板
 */
const TemplateEditor = ({
    isOpen,
    onClose,
    onSave,
    initialTemplate,
    initialSignature,
    sendMessage,
}: TemplateEditorProps) => {
    // 模板和签名状态
    const [customTemplate, setCustomTemplate] = useState(initialTemplate);
    const [signature, setSignature] = useState(initialSignature);

    // 光标位置
    const [cursorPosition, setCursorPosition] = useState<number>(0);

    // 当初始值变化时更新状态
    useEffect(() => {
        setCustomTemplate(initialTemplate);
        setSignature(initialSignature);
    }, [initialTemplate, initialSignature]);

    // 恢复默认模板
    const handleResetToDefault = useCallback(() => {
        // 定义默认模板
        const DEFAULT_TEMPLATE = `**课程名称:** {{courseName}}

**授课时间:** {{courseTime}}

**课程内容概览:**
{{courseContents}}

**教学目标:**
{{courseObjectives}}

**课堂表现:**
{{courseFeedback}}

{{signature}}
{{currentDate}}`;

        setCustomTemplate(DEFAULT_TEMPLATE);
        setSignature("哆啦人工智能小栈");
    }, []);

    // 在光标位置插入文本的函数
    const insertTextAtCursor = useCallback(
        (text: string) => {
            // 在当前光标位置插入文本
            const before = customTemplate.substring(0, cursorPosition);
            const after = customTemplate.substring(cursorPosition);
            const newValue = before + text + after;
            setCustomTemplate(newValue);

            // 计算新的光标位置
            const newPosition = cursorPosition + text.length;
            setCursorPosition(newPosition);
        },
        [customTemplate, cursorPosition]
    );

    // 处理TextArea光标变化
    const handleTextAreaSelect = (
        e:
            | React.MouseEvent<HTMLTextAreaElement>
            | React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        const target = e.target as HTMLTextAreaElement;
        setCursorPosition(target.selectionStart || 0);
    };

    // 保存模板
    const handleSave = () => {
        onSave(customTemplate, signature);
        sendMessage("反馈模板已保存");
    };

    return (
        <Modal
            title="自定义反馈模板"
            open={isOpen}
            onCancel={onClose}
            onOk={handleSave}
            width={700}
        >
            <Space
                direction="vertical"
                style={{ width: "100%", marginBottom: "16px" }}
            >
                <div style={{ marginBottom: "8px" }}>
                    <span style={{ marginRight: "8px" }}>可插入的占位符: </span>
                    {Object.entries(PLACEHOLDERS).map(([name, placeholder]) => (
                        <Tag
                            key={name}
                            color="blue"
                            style={{ cursor: "pointer", margin: "4px" }}
                            onClick={() => insertTextAtCursor(placeholder)}
                        >
                            {name}
                        </Tag>
                    ))}
                </div>
                <Input.TextArea
                    value={customTemplate}
                    onChange={(e) => setCustomTemplate(e.target.value)}
                    onKeyUp={handleTextAreaSelect}
                    onClick={handleTextAreaSelect}
                    placeholder="输入自定义模板"
                    autoSize={{ minRows: 10, maxRows: 20 }}
                />
                <div style={{ marginTop: "16px" }}>
                    <span style={{ marginRight: "8px" }}>自定义签名:</span>
                    <Input
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="输入自定义签名"
                        style={{ width: "300px" }}
                    />
                    <Tag
                        color="orange"
                        style={{ marginLeft: "8px", cursor: "pointer" }}
                        onClick={() => insertTextAtCursor(PLACEHOLDERS["著名"])}
                    >
                        插入签名占位符
                    </Tag>
                </div>
                <div style={{ marginTop: "16px", textAlign: "right" }}>
                    <Button
                        onClick={handleResetToDefault}
                        style={{ marginRight: "8px" }}
                    >
                        恢复默认模板
                    </Button>
                </div>
            </Space>
        </Modal>
    );
};

export default TemplateEditor;
