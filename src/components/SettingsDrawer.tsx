import { CloseOutlined, SaveOutlined } from "@ant-design/icons";
import { Drawer, Flex, Input, Select, Tooltip, Typography, theme } from "antd";
import type { JointContent } from "antd/es/message/interface";
import { memo } from "react";
import { v4 as uuid_v4 } from "uuid";
import type { ModelType } from "../AI_API";
import { API } from "../AI_API";
import { PROMPTS } from "./constants";
import { PromptItem, PromptType } from "./types";
import { savePromptToLocalStorage } from "./utils";

const { useToken } = theme;

// 设置抽屉组件属性接口
interface SettingsDrawerProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    model: ModelType;
    setModel: (model: ModelType) => void;
    promptItems: Record<string, PromptItem>;
    setPromptItems: (items: Record<string, PromptItem>) => void;
    promptKey: PromptType;
    setPromptKey: (key: PromptType) => void;
    sendMessage: (
        content: JointContent,
        duration?: number | VoidFunction,
        onClose?: VoidFunction
    ) => void;
}

/**
 * 设置抽屉组件
 */
const SettingsDrawer = memo(
    ({
        open,
        setOpen,
        model,
        setModel,
        promptItems,
        setPromptItems,
        promptKey,
        setPromptKey,
        sendMessage,
    }: SettingsDrawerProps) => {
        const { token } = useToken();

        return (
            <Drawer
                title="设置"
                onClose={() => {
                    setOpen(false);
                }}
                open={open}
            >
                <Flex vertical gap={20}>
                    {/* 选择AI模型 */}
                    <Flex gap={5} align="center" justify="space-between">
                        <Typography.Text>模型:</Typography.Text>
                        <Select
                            style={{ width: "85%" }}
                            value={model}
                            options={API.model_list.map(
                                (modelName: string) => ({
                                    value: modelName,
                                    label: modelName,
                                })
                            )}
                            onSelect={(value: ModelType) => {
                                setModel(value);
                                API.setModel(value);
                            }}
                        />
                    </Flex>
                    {/* API Key输入框 */}
                    <Input
                        addonBefore="请输入API Key"
                        placeholder={
                            API.tokenReady() ? API.getMackToken() : "请输入"
                        }
                        onChange={(event) => {
                            const api_key = event.target.value.trim();
                            API.setToken(api_key);
                            localStorage.setItem("api_key", api_key);
                            sendMessage(
                                "API Key设置成功, 请刷新页面加载可用模型."
                            );
                        }}
                    />
                    {/* 提示词自定义输入框 */}
                    <Flex vertical gap={5} justify="space-between">
                        <Flex align="center" justify="space-between">
                            <Typography.Text>提示词:</Typography.Text>
                            <Tooltip title="选择模板">
                                <Select
                                    style={{ width: "30%" }}
                                    defaultValue={
                                        "programming" as PromptType | "custom"
                                    }
                                    options={[
                                        ...Object.entries(promptItems).map(
                                            (prompt) => ({
                                                value: prompt[0],
                                                label: prompt[1].name,
                                            })
                                        ),
                                        {
                                            value: "custom",
                                            label: "自定义",
                                        },
                                    ]}
                                    onSelect={(value) => {
                                        if (value === "custom") {
                                            const uid: string = uuid_v4();
                                            setPromptItems({
                                                ...promptItems,
                                                [uid]: {
                                                    name: "请输入提示词名称",
                                                    prompt: promptItems[
                                                        promptKey
                                                    ].prompt,
                                                },
                                            });
                                            setPromptKey(uid as PromptType);
                                        } else {
                                            setPromptKey(value as PromptType);
                                        }
                                    }}
                                />
                            </Tooltip>
                        </Flex>
                        {/* 自定义提示词名称 */}
                        <Input
                            addonBefore="名称"
                            addonAfter={
                                <Flex gap={20}>
                                    <CloseOutlined
                                        style={{
                                            fontSize: token.controlHeightXS,
                                            color:
                                                promptKey in PROMPTS
                                                    ? undefined
                                                    : token.colorError,
                                        }}
                                        onClick={() => {
                                            const _t = { ...promptItems };
                                            delete _t[promptKey];
                                            setPromptKey(
                                                Object.keys(
                                                    promptItems
                                                )[0] as PromptType
                                            );
                                            setPromptItems(_t);

                                            savePromptToLocalStorage(_t);
                                        }}
                                    />
                                    <SaveOutlined
                                        style={{
                                            fontSize: token.controlHeightXS,
                                            color:
                                                promptKey in PROMPTS
                                                    ? undefined
                                                    : token.colorPrimary,
                                        }}
                                        onClick={() => {
                                            savePromptToLocalStorage(
                                                promptItems
                                            );
                                        }}
                                    />
                                </Flex>
                            }
                            value={promptItems[promptKey].name}
                            disabled={promptKey in PROMPTS}
                            onChange={(event) => {
                                const value = event.target.value;
                                const old_items = {
                                    ...promptItems,
                                    [promptKey]: {
                                        ...promptItems[promptKey],
                                        name: value,
                                    },
                                };
                                setPromptItems(old_items);
                            }}
                        />
                        {/* 提示词内容 */}
                        <Input.TextArea
                            disabled={promptKey in PROMPTS}
                            value={promptItems[promptKey].prompt}
                            autoSize={{ minRows: 10, maxRows: 15 }}
                            title="提示语"
                            onChange={(event) => {
                                const value = event.target.value;
                                const old_items = {
                                    ...promptItems,
                                    [promptKey]: {
                                        ...promptItems[promptKey],
                                        prompt: value,
                                    },
                                };
                                setPromptItems(old_items);
                            }}
                        />
                    </Flex>
                </Flex>
            </Drawer>
        );
    }
);

export default SettingsDrawer;
