import { CloseOutlined, SaveOutlined, UploadOutlined } from "@ant-design/icons";
import {
  Drawer,
  Flex,
  Input,
  Select,
  Tooltip,
  Typography,
  theme,
  Button,
  Divider,
} from "antd";
import type { JointContent } from "antd/es/message/interface";
import { memo, useEffect, useState } from "react";
import { v4 as uuid_v4 } from "uuid";
import type { ModelType, ProviderType } from "../AI_API";
import { API } from "../AI_API";
import { PROMPTS } from "./constants";
import dayjs from "dayjs";
import { PromptItem, PromptType } from "./types";
import { savePromptToLocalStorage, downloadJson } from "../utils";

const { useToken } = theme;
const ExportALLLocalStorage = () => {
  console.log(
    "=== EXPORT ALL LOCALSTORAGE ===\n--- Traversing with Object.keys ---",
  );
  const EXPORT_OBJECT: Record<string, string> = {};
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    try {
      // 尝试获取并打印
      const value = localStorage.getItem(key);
      if (key.startsWith("__tea_cache_") || key === "version" || !value) return;
      console.log(`--- PARSE ---\nKey: ${key},\nValue: ${value}\n------`);
      EXPORT_OBJECT[key] = JSON.parse(value || "");
    } catch (e) {
      // 某些浏览器在特定模式下（如隐私模式）可能会在访问时抛出异常
      console.error(`Could not get item with key: ${key}`, e);
    }
  });
  console.log("\n--- EXPORTED ALL ---");
  // 下载导出对象
  downloadJson(
    EXPORT_OBJECT,
    `备份_${dayjs().format("YYYY-MM-DD-HH-mm")}.json`,
  );
};
const ImportLocalStorage = (file: File) => {
  console.log("=== IMPORT LOCALSTORAGE ===");
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const content = event.target?.result as string;
      const data = JSON.parse(content);
      Object.keys(data).forEach((key) => {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
      console.log("=== IMPORT SUCCESS ===");
    } catch (error) {
      console.error("导入失败:", error);
    }
  };
  reader.readAsText(file);
};

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
    onClose?: VoidFunction,
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
    const [provider, setProvider] = useState<ProviderType>(API.getProvider());
    const [customApiUrl, setCustomApiUrl] = useState<string>(
      API.getCustomProviderConfig().apiUrl,
    );
    const [customModelListUrl, setCustomModelListUrl] = useState<string>(
      API.getCustomProviderConfig().modelListUrl,
    );
    useEffect(() => {
      const promptKey = localStorage.getItem("promptKey") as PromptType | null;
      if (promptKey) {
        setPromptKey(promptKey);
      }
    }, [setPromptKey]);

    // 处理供应商变更
    const handleProviderChange = (value: ProviderType) => {
      setProvider(value);
      API.setProvider(value);

      // 更新供应商特定的消息
      let message = "";
      switch (value) {
        case "siliconflow":
          message = "已切换到硅基流动供应商";
          break;
        case "openai":
          message = "已切换到OpenAI供应商";
          break;
        case "deepseek":
          message = "已切换到DeepSeek供应商";
          break;
        case "gemini":
          message = "已切换到Gemini供应商";
          break;
        case "custom":
          message = "已切换到自定义供应商";
          break;
        default:
          message = "已切换供应商";
      }

      // 加载模型提示
      message += "，正在尝试加载可用模型列表，请稍等...";

      // 发送消息通知用户
      sendMessage(message);

      // 延迟检查模型列表加载状态
      setTimeout(() => {
        if (API.isCustomModelAllowed()) {
          sendMessage(
            "未能获取模型列表或供应商不支持模型列表API，请手动输入模型名称",
          );
        }
      }, 2000);
    };

    // 处理自定义供应商配置变更
    const handleCustomConfigChange = () => {
      API.setCustomProviderConfig({
        apiUrl: customApiUrl,
        modelListUrl: customModelListUrl,
      });
      sendMessage("自定义供应商配置已保存，请刷新页面加载可用模型");
    };

    return (
      <Drawer
        title="设置"
        onClose={() => {
          setOpen(false);
        }}
        open={open}
      >
        <Flex vertical gap={8}>
          {/* 选择模型提供商 */}
          <Flex gap={5} align="center" justify="space-between">
            <Typography.Text>AI提供商:</Typography.Text>
            <Select
              style={{ width: "80%" }}
              value={provider}
              options={API.getProviders()}
              onChange={handleProviderChange}
            />
          </Flex>

          {/* 硅基流动申请链接 */}
          {provider === "siliconflow" && (
            <Flex vertical gap={5}>
              <Typography.Text type="secondary">
                硅基流动是推荐的中文AI服务提供商
              </Typography.Text>
              <Button
                type="link"
                href="https://cloud.siliconflow.cn/i/8jXtDiez"
                target="_blank"
              >
                点击这里注册获取2000万免费Tokens
              </Button>
            </Flex>
          )}

          {/* DeepSeek申请链接 */}
          {provider === "deepseek" && (
            <Flex vertical gap={5}>
              <Typography.Text type="secondary">
                DeepSeek提供高性能的推理和对话模型
              </Typography.Text>
              <Button
                type="link"
                href="https://platform.deepseek.com/api_keys"
                target="_blank"
              >
                点击这里申请DeepSeek API密钥
              </Button>
            </Flex>
          )}

          {/* OpenAI申请链接 */}
          {provider === "openai" && (
            <Flex vertical gap={5}>
              <Typography.Text type="secondary">
                OpenAI提供GPT系列大语言模型
              </Typography.Text>
              <Button
                type="link"
                href="https://platform.openai.com/api-keys"
                target="_blank"
              >
                点击这里申请OpenAI API密钥
              </Button>
            </Flex>
          )}

          {/* Gemini申请链接 */}
          {provider === "gemini" && (
            <Flex vertical gap={5}>
              <Typography.Text type="secondary">
                Gemini是Google开发的先进大语言模型
              </Typography.Text>
              <Button type="link" href="https://ai.google.dev/" target="_blank">
                点击这里申请Gemini API密钥
              </Button>
            </Flex>
          )}

          {/* 自定义供应商设置 */}
          {provider === "custom" && (
            <Flex vertical gap={10}>
              <Typography.Text>自定义供应商设置:</Typography.Text>
              <Typography.Text type="secondary">
                可配置兼容OpenAI格式的API服务，例如本地部署的LLM、私有云等
              </Typography.Text>
              <Input
                addonBefore="API基础URL"
                placeholder="https://your-api-endpoint.com"
                value={customApiUrl.split("/v1/chat/completions")[0]}
                onChange={(e) => {
                  const baseUrl = e.target.value.trim();
                  // 自动补全完整的API URL
                  setCustomApiUrl(`${baseUrl}/v1/chat/completions`);
                  setCustomModelListUrl(`${baseUrl}/v1/models`);
                }}
              />
              <Input
                addonBefore="聊天完成URL"
                placeholder="https://your-api-endpoint.com/v1/chat/completions"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
              />
              <Input
                addonBefore="模型列表URL"
                placeholder="https://your-api-endpoint.com/v1/models"
                value={customModelListUrl}
                onChange={(e) => setCustomModelListUrl(e.target.value)}
              />
              <Button type="primary" onClick={handleCustomConfigChange}>
                保存配置
              </Button>
            </Flex>
          )}

          <Divider />

          {/* 选择AI模型 */}
          <Flex gap={5} align="center" justify="space-between">
            <Typography.Text>模型:</Typography.Text>
            {API.model_list.length > 0 && !API.isCustomModelAllowed() ? (
              <Select
                style={{ width: "85%" }}
                value={model}
                options={API.model_list.map((modelName: string) => ({
                  value: modelName,
                  label: modelName,
                }))}
                onSelect={(value: ModelType) => {
                  setModel(value);
                }}
              />
            ) : (
              <Input
                style={{ width: "85%" }}
                placeholder="请输入模型名称"
                value={model}
                onChange={(e) => {
                  const modelName = e.target.value;
                  setModel(modelName);
                }}
              />
            )}
          </Flex>
          {API.isCustomModelAllowed() && (
            <Typography.Text type="secondary" style={{ fontSize: "12px" }}>
              未检测到可用的模型列表，请手动输入模型名称
            </Typography.Text>
          )}
          {/* API Key输入框 */}
          <Input
            addonBefore="请输入API Key"
            placeholder={API.tokenReady() ? API.getMackToken() : "请输入"}
            onChange={(event) => {
              const api_key = event.target.value.trim();
              API.setToken(api_key);
              localStorage.setItem("api_key", api_key);
              sendMessage("API Key设置成功, 请刷新页面加载可用模型.");
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
                    localStorage.getItem("promptKey") ||
                    ("programming" as PromptType) ||
                    "custom"
                  }
                  options={[
                    ...Object.entries(promptItems).map((prompt) => ({
                      value: prompt[0],
                      label: prompt[1].name,
                    })),
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
                          prompt: promptItems[promptKey].prompt,
                        },
                      });
                      setPromptKey(uid as PromptType);
                    } else {
                      setPromptKey(value as PromptType);
                      localStorage.setItem("promptKey", value);
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
                        promptKey in PROMPTS ? undefined : token.colorError,
                    }}
                    onClick={() => {
                      const _t = { ...promptItems };
                      delete _t[promptKey];
                      setPromptKey(Object.keys(promptItems)[0] as PromptType);
                      setPromptItems(_t);
                      savePromptToLocalStorage(_t);
                    }}
                  />
                  <SaveOutlined
                    style={{
                      fontSize: token.controlHeightXS,
                      color:
                        promptKey in PROMPTS ? undefined : token.colorPrimary,
                    }}
                    onClick={() => {
                      savePromptToLocalStorage(promptItems);
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

          <Divider />

          {/* 备份 */}
          <Flex align="center" justify="space-between">
            <Button
              type="link"
              icon={<UploadOutlined />}
              onClick={() => {
                ExportALLLocalStorage();
              }}
            >
              备份全部信息
            </Button>
            <Button
              type="link"
              icon={<UploadOutlined />}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.click();
                input.addEventListener("change", () => {
                  const uploadedFile: File | null = input.files
                    ? input.files[0]
                    : null;
                  if (uploadedFile) ImportLocalStorage(uploadedFile);
                });

                document.body.removeChild(input);
              }}
            >
              导入全部信息
            </Button>
          </Flex>
        </Flex>
      </Drawer>
    );
  },
);

export default SettingsDrawer;
