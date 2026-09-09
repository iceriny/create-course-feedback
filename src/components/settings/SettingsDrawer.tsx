import { useState } from "react";
import {
  Alert,
  Button,
  Divider,
  Drawer,
  Flex,
  Input,
  Modal,
  Select,
  Typography,
} from "antd";
import type { JointContent } from "antd/es/message/interface";
import API, { type ProviderType } from "../../AI_API/API";
import type { PromptItem, PromptType } from "../../types";
import { PROMPTS } from "../../constants";
import { downloadJson } from "../../utils/storage";
import {
  createBackup,
  parseBackup,
  restoreBackup,
  type Backup,
} from "../../services/persistence/backup";
import { flushLessonDraft } from "../../store/rosterStore";
import { cancelGeneration } from "../../services/ai/workspaceGeneration";
interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  model: string;
  setModel: (model: string) => void;
  promptItems: Record<string, PromptItem>;
  setPromptItems: (items: Record<string, PromptItem>) => void;
  promptKey: PromptType;
  setPromptKey: (key: PromptType) => void;
  savePromptItems: () => void;
  sendMessage: (message: JointContent) => void;
}
export default function SettingsDrawer(props: Props) {
  const {
    open,
    setOpen,
    model,
    setModel,
    promptItems,
    setPromptItems,
    promptKey,
    setPromptKey,
    savePromptItems,
    sendMessage,
  } = props;
  const [provider, setProvider] = useState(API.getProvider());
  const [key, setKey] = useState("");
  const [url, setUrl] = useState(API.getCustomProviderConfig().apiUrl);
  const [modelsUrl, setModelsUrl] = useState(
    API.getCustomProviderConfig().modelListUrl,
  );
  const [models, setModels] = useState(API.model_list);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState<Backup | null>(null);
  const prompt = promptItems[promptKey];
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setNotice((error as Error).message || "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer title="设置" open={open} onClose={() => setOpen(false)} size={460}>
      <div className="settings-fields">
        {notice && <Alert showIcon title={notice} type="info" />}
        <label>
          AI 服务
          <Select
            value={provider}
            onChange={(value: ProviderType) => {
              cancelGeneration();
              API.setProvider(value);
              setProvider(value);
              setModel(API.getModel());
              setKey("");
              setModels([]);
              setNotice("已切换服务，请保存对应的密钥并测试连接。");
            }}
            options={API.getProviders()}
          />
        </label>
        {provider === "custom" && (
          <>
            <label>
              生成地址
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/v1/chat/completions"
              />
            </label>
            <label>
              模型列表地址
              <Input
                value={modelsUrl}
                onChange={(e) => setModelsUrl(e.target.value)}
                placeholder="https://example.com/v1/models"
              />
            </label>
            <Button
              onClick={() => {
                cancelGeneration();
                API.setCustomProviderConfig({
                  apiUrl: url.trim(),
                  modelListUrl: modelsUrl.trim(),
                });
                setNotice("服务地址已保存。");
              }}
            >
              保存服务地址
            </Button>
          </>
        )}
        <label>
          密钥
          <Input.Password
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={API.getMackToken()}
            autoComplete="off"
          />
        </label>
        <Flex gap={8}>
          <Button
            disabled={!key.trim()}
            onClick={() => {
              try {
                cancelGeneration();
                API.saveToken(key);
                setKey("");
                setNotice("密钥已保存到此设备。");
              } catch {
                setNotice("密钥保存失败，请检查浏览器存储。");
              }
            }}
          >
            保存密钥
          </Button>
          <Button
            loading={busy}
            onClick={() =>
              run(async () => {
                setModels(await API.getModelList());
                setNotice("连接成功，可以选择模型。");
              })
            }
          >
            测试连接
          </Button>
        </Flex>
        <label>
          模型
          {models.length ? (
            <Select
              showSearch
              value={model}
              onChange={(value) => {
                cancelGeneration();
                setModel(value);
              }}
              options={models.map((value) => ({ value, label: value }))}
            />
          ) : (
            <Input
              value={model}
              onChange={(e) => {
                cancelGeneration();
                setModel(e.target.value);
              }}
              placeholder="输入模型名称"
            />
          )}
        </label>
        <Typography.Text type="secondary">
          生成时，课程信息和当前学生的课堂观察会发送至所选 AI 服务。
        </Typography.Text>
        <Divider />
        <label>
          反馈提示词
          <Select
            value={promptKey}
            onChange={setPromptKey}
            options={Object.entries(promptItems).map(([value, item]) => ({
              value,
              label: item.name,
            }))}
          />
        </label>
        <Flex gap={8}>
          <Button
            onClick={() => {
              const id = crypto.randomUUID();
              setPromptItems({
                ...promptItems,
                [id]: { name: "我的提示词", prompt: prompt.prompt },
              });
              setPromptKey(id);
            }}
          >
            复制为自定义
          </Button>
          <Button
            disabled={promptKey in PROMPTS}
            danger
            onClick={() => {
              const items = { ...promptItems };
              delete items[promptKey];
              setPromptItems(items);
              savePromptItems();
            }}
          >
            删除自定义
          </Button>
        </Flex>
        <details>
          <summary>编辑提示词</summary>
          <label>
            名称
            <Input
              value={prompt.name}
              disabled={promptKey in PROMPTS}
              onChange={(e) =>
                setPromptItems({
                  ...promptItems,
                  [promptKey]: { ...prompt, name: e.target.value },
                })
              }
            />
          </label>
          <Input.TextArea
            aria-label="提示词内容"
            value={prompt.prompt}
            disabled={promptKey in PROMPTS}
            onChange={(e) =>
              setPromptItems({
                ...promptItems,
                [promptKey]: { ...prompt, prompt: e.target.value },
              })
            }
            rows={10}
          />
          <Button
            disabled={promptKey in PROMPTS}
            onClick={() => {
              savePromptItems();
              sendMessage("提示词已保存。");
            }}
          >
            保存提示词
          </Button>
        </details>
        <Divider />
        <h3>备份与恢复</h3>
        <Typography.Text type="secondary">
          包含课程、名单、反馈草稿、模板和常用短语，不包含密钥。
        </Typography.Text>
        <Button
          loading={busy}
          onClick={() =>
            run(async () => {
              if (!flushLessonDraft())
                throw new Error("草稿保存失败，请先重试保存。");
              downloadJson(
                await createBackup(),
                `课程反馈备份_${new Date().toISOString().slice(0, 10)}.json`,
              );
            })
          }
        >
          下载备份
        </Button>
        <label className="backup-upload">
          选择备份文件
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () => setBackup(parseBackup(await file.text())));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <Modal
        title="恢复备份"
        open={backup !== null}
        onCancel={() => setBackup(null)}
        confirmLoading={busy}
        onOk={() =>
          run(async () => {
            cancelGeneration();
            if (!flushLessonDraft())
              throw new Error("当前草稿保存失败，暂未恢复备份。");
            await restoreBackup(backup!);
            window.location.reload();
          })
        }
      >
        <p>
          将恢复 {Object.keys(backup?.local || {}).length}{" "}
          项设置与课程记录，以及 {Object.keys(backup?.indexed || {}).length}{" "}
          项常用短语数据。
        </p>
        <p>同名记录将被覆盖，其他记录保留。恢复完成后页面会重新加载。</p>
      </Modal>
    </Drawer>
  );
}
