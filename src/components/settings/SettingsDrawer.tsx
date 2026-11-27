import { useId, useRef, useState } from "react";
import { useStore } from "zustand";
import dayjs from "dayjs";
import {
  Alert,
  Button,
  ConfigProvider,
  Drawer,
  Flex,
  Input,
  Modal,
  Typography,
} from "antd";
import Select from "../common/Select";
import type { JointContent } from "antd/es/message/interface";
import type { PromptItem, PromptType } from "../../types";
import {
  motionPreferenceStore,
  setMotionPreference,
  type MotionPreference,
} from "../../motion/preference";
import useOverlay from "../../motion/useOverlay";
import AiServiceSettings from "./AiServiceSettings";
import { PROMPTS } from "../../constants";
import { downloadJson } from "../../utils/storage";
import {
  createBackup,
  parseBackup,
  restoreBackup,
  type Backup,
} from "../../services/persistence/backup";
import { createLessonBackup } from "../../services/persistence/lessonRepository";
import {
  flushLessonDraft,
  getCurrentLessonDraft,
  pauseLessonDraftSaving,
} from "../../store/rosterStore";
import {
  cancelGeneration,
  type AiSetupField,
} from "../../services/ai/workspaceGeneration";
interface Props {
  open: boolean;
  onClose: () => void;
  afterClose: () => void;
  model: string;
  setModel: (model: string) => void;
  focusField?: AiSetupField;
  onConnected: () => void;
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
    onClose,
    afterClose,
    model,
    setModel,
    focusField,
    onConnected,
    promptItems,
    setPromptItems,
    promptKey,
    setPromptKey,
    savePromptItems,
    sendMessage,
  } = props;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const backupFileInput = useRef<HTMLInputElement>(null);
  const backupDialog = useOverlay<Backup>();
  const backup = backupDialog.overlay?.content;
  const aiFieldId = useId();
  const motionFieldId = useId();
  const motionMode = useStore(motionPreferenceStore, (state) => state.mode);
  const focusSetupField = () => {
    if (!focusField) return;
    document.getElementById(`${aiFieldId}-${focusField}`)?.focus();
  };
  const prompt = promptItems[promptKey];
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (error) {
      setNotice((error as Error).message || "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer
      title="设置"
      open={open}
      styles={{ header: { borderBlockEndColor: "transparent" } }}
      onClose={() => !busy && !backupDialog.overlay && onClose()}
      afterOpenChange={(visible) => {
        if (visible) focusSetupField();
        else afterClose();
      }}
      size={460}
    >
      <ConfigProvider variant="filled">
        <div className="settings-sections">
          <section className="settings-fields" aria-label="界面动效">
            <label htmlFor={motionFieldId}>
              界面动效
              <Select<MotionPreference>
                id={motionFieldId}
                aria-label="界面动效"
                value={motionMode}
                onChange={setMotionPreference}
                options={[
                  { value: "system", label: "跟随系统" },
                  { value: "reduce", label: "减少动效" },
                  { value: "full", label: "完整动效" },
                ]}
              />
            </label>
          </section>
          <AiServiceSettings
            id={aiFieldId}
            open={open}
            model={model}
            setModel={setModel}
            onConnected={onConnected}
          />
          <section className="settings-fields" aria-label="反馈提示词">
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
            <Flex gap={8} wrap>
              <Button
                type="text"
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
                type="text"
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
            <details className="settings-prompt-editor">
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
                color="primary"
                variant="filled"
                disabled={promptKey in PROMPTS}
                onClick={() => {
                  savePromptItems();
                  sendMessage("提示词已保存。");
                }}
              >
                保存提示词
              </Button>
            </details>
          </section>
          <section className="settings-fields" aria-label="备份与恢复">
            <h3>备份与恢复</h3>
            <Typography.Text type="secondary">
              包含课程、名单、反馈草稿、模板和常用短语，不包含密钥。
            </Typography.Text>
            {notice && <Alert showIcon title={notice} type="warning" />}
            <Flex gap={8} wrap>
              <Button
                color="default"
                variant="filled"
                loading={busy}
                onClick={() =>
                  run(async () => {
                    const draft = getCurrentLessonDraft();
                    try {
                      downloadJson(
                        await createBackup(draft),
                        `课程反馈备份_${dayjs().format("YYYY-MM-DD")}.json`,
                      );
                    } catch (error) {
                      if (!draft) throw error;
                      downloadJson(
                        createLessonBackup(draft),
                        "课程反馈当前草稿.json",
                      );
                      setNotice("已下载当前草稿。完整备份读取失败。");
                    }
                  })
                }
              >
                下载备份
              </Button>
              <Button
                color="default"
                variant="filled"
                onClick={() => backupFileInput.current?.click()}
              >
                选择备份文件
              </Button>
            </Flex>
            <input
              ref={backupFileInput}
              type="file"
              hidden
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () =>
                    backupDialog.show(parseBackup(await file.text())),
                  );
                e.target.value = "";
              }}
            />
          </section>
        </div>
      </ConfigProvider>
      <Modal
        title="恢复备份"
        open={backupDialog.overlay?.open}
        onCancel={() => !busy && backupDialog.close()}
        afterClose={backupDialog.afterClose}
        confirmLoading={busy}
        onOk={() =>
          backup &&
          run(async () => {
            cancelGeneration();
            if (!flushLessonDraft())
              throw new Error("当前草稿保存失败，暂未恢复备份。");
            const resumeSaving = pauseLessonDraftSaving();
            try {
              await restoreBackup(backup);
              window.location.reload();
            } catch (error) {
              resumeSaving();
              throw error;
            }
          })
        }
      >
        <p>
          将恢复 {Object.keys(backup?.local || {}).length}{" "}
          项设置与课程记录，以及 {Object.keys(backup?.indexed || {}).length}{" "}
          项常用短语数据。
        </p>
        <p>同名记录将被覆盖，其他记录保留。恢复完成后页面会重新加载。</p>
        {notice && <Alert showIcon title={notice} type="warning" />}
      </Modal>
    </Drawer>
  );
}
