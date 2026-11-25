import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AutoComplete,
  Button,
  Flex,
  Input,
  Typography,
} from "antd";
import API, {
  RequestError,
  type ProviderType,
  type RequestConfig,
} from "../../AI_API/API";
import { cancelGeneration } from "../../services/ai/workspaceGeneration";
import Select from "../common/Select";
import { selectTooltipProps, withoutOptionTitles } from "../common/selectTooltips";

type SetupField = "token" | "endpoint" | "model" | "modelsUrl";

interface Props {
  id: string;
  open: boolean;
  model: string;
  setModel: (value: string) => void;
  onConnected: () => void;
}

interface FormValues {
  provider: ProviderType;
  endpoint: string;
  modelsUrl: string;
  token: string;
  model: string;
}

interface Issue {
  field?: SetupField;
  message: string;
}

function readForm(provider: ProviderType, model?: string): FormValues {
  const saved = API.getProviderSnapshot(provider);
  return {
    provider,
    endpoint: saved.config.apiUrl,
    modelsUrl: saved.config.modelListUrl,
    model: model ?? saved.model,
    token: "",
  };
}

function isServiceAddress(value: string) {
  if (!value) return false;
  try {
    const { protocol } = new URL(value, document.baseURI);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function validateForm(snapshot: RequestConfig): Issue | undefined {
  if (!isServiceAddress(snapshot.config.apiUrl)) {
    return {
      field: "endpoint",
      message: "请输入有效的 HTTP 或 HTTPS 生成地址。",
    };
  }
  if (
    snapshot.config.modelListUrl &&
    !isServiceAddress(snapshot.config.modelListUrl)
  ) {
    return {
      field: "modelsUrl",
      message: "请输入有效的 HTTP 或 HTTPS 模型列表地址。",
    };
  }
  if (!snapshot.token) return { field: "token", message: "请输入密钥。" };
  if (!snapshot.model && !snapshot.config.modelListUrl) {
    return { field: "model", message: "请输入模型名称。" };
  }
}

function connectionIssue(error: unknown, provider: ProviderType): Issue {
  const message = error instanceof Error ? error.message : "连接失败，请重试。";
  if (error instanceof RequestError) {
    if (error.status === 401 || error.status === 403) {
      return { field: "token", message: "密钥未通过验证，请检查后重试。" };
    }
    if (
      error.status === 400 ||
      error.status === 422 ||
      (error.status === 404 && provider !== "custom")
    ) {
      return {
        field: "model",
        message: "此模型未通过测试，请核对名称和使用权限。",
      };
    }
    if (error.status === 404 && provider === "custom") {
      return {
        field: "endpoint",
        message: "找不到生成接口，请核对完整路径和模型名称。",
      };
    }
  }
  return { message };
}

export default function AiServiceSettings({
  id,
  open,
  model,
  setModel,
  onConnected,
}: Props) {
  const [form, setForm] = useState(() => readForm(API.getProvider(), model));
  const [models, setModels] = useState(API.model_list);
  const [issue, setIssue] = useState<Issue>();
  const [listUnavailable, setListUnavailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const modelEdited = useRef(false);
  const saved = API.getProviderSnapshot(form.provider);

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!open) pending.current?.abort();
  }, [open]);
  useEffect(() => {
    if (open && !testing && issue?.field) {
      document.getElementById(`${id}-${issue.field}`)?.focus();
    }
  }, [id, issue, open, testing]);

  const update = (patch: Partial<FormValues>) => {
    setForm((current) => ({ ...current, ...patch }));
    setIssue(undefined);
    setConnected(false);
  };

  const changeProvider = (provider: ProviderType) => {
    setForm(readForm(provider));
    modelEdited.current = false;
    setModels(provider === API.getProvider() ? API.model_list : []);
    setListUnavailable(false);
    setIssue(undefined);
    setConnected(false);
  };

  const testAndSave = async () => {
    if (pending.current) return;
    const snapshot: RequestConfig = {
      ...saved,
      config: {
        ...saved.config,
        apiUrl: form.endpoint.trim(),
        modelListUrl: form.modelsUrl.trim(),
      },
      token: form.token.trim() || saved.token,
      model: form.model.trim(),
    };
    const invalid = validateForm(snapshot);
    if (invalid) {
      setIssue(invalid);
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    setTesting(true);
    setIssue(undefined);
    setConnected(false);
    setListUnavailable(false);
    try {
      let available: string[] = [];
      if (snapshot.config.modelListUrl) {
        try {
          available = await API.fetchModelList(snapshot, controller.signal);
        } catch {
          if (controller.signal.aborted) return;
          setListUnavailable(true);
        }
      }
      if (controller.signal.aborted) return;
      setModels(available);

      const useListedModel =
        !modelEdited.current &&
        (!snapshot.model || snapshot.model === snapshot.config.defaultModel) &&
        !available.includes(snapshot.model);
      if (useListedModel && available.length === 1) {
        snapshot.model = available[0];
        setForm((current) => ({ ...current, model: snapshot.model }));
      }
      if (!snapshot.model || (useListedModel && available.length > 1)) {
        if (snapshot.model) {
          setForm((current) => ({ ...current, model: "" }));
        }
        setIssue({
          field: "model",
          message: available.length
            ? "请从列表选择模型，或输入模型名称。"
            : "请输入模型名称。",
        });
        return;
      }

      await API.testConnection(snapshot, controller.signal);
      if (controller.signal.aborted) return;
      const previous = API.snapshot();
      try {
        API.saveConfiguration(snapshot, available);
        setModel(snapshot.model);
      } catch {
        setIssue({ message: "连接成功，保存失败。请检查浏览器存储后重试。" });
        return;
      }
      if (
        previous.provider !== snapshot.provider ||
        previous.token !== snapshot.token ||
        previous.model !== snapshot.model ||
        previous.config.apiUrl !== snapshot.config.apiUrl
      ) {
        cancelGeneration();
      }
      setForm(readForm(snapshot.provider));
      setConnected(true);
    } catch (error) {
      if (!controller.signal.aborted) {
        setIssue(connectionIssue(error, snapshot.provider));
      }
    } finally {
      pending.current = null;
      setTesting(false);
    }
  };

  const fieldProps = (field: SetupField) => ({
    id: `${id}-${field}`,
    disabled: testing,
    status: issue?.field === field ? ("error" as const) : undefined,
    "aria-invalid": issue?.field === field || undefined,
    "aria-describedby":
      issue?.field === field ? `${id}-${field}-issue` : undefined,
  });
  const fieldIssue = (field: SetupField) =>
    issue?.field === field && (
      <Typography.Text id={`${id}-${field}-issue`} role="alert" type="danger">
        {issue.message}
      </Typography.Text>
    );

  return (
    <section className="settings-fields" aria-label="AI 服务配置">
      <label htmlFor={`${id}-provider`}>
        AI 服务
        <Select<ProviderType>
          id={`${id}-provider`}
          aria-label="AI 服务"
          value={form.provider}
          onChange={changeProvider}
          options={API.getProviders()}
          disabled={testing}
        />
      </label>
      {form.provider === "custom" && (
        <>
          <label htmlFor={`${id}-endpoint`}>
            生成地址
            <Input
              {...fieldProps("endpoint")}
              aria-label="生成地址"
              value={form.endpoint}
              onChange={(event) => update({ endpoint: event.target.value })}
              placeholder="https://example.com/v1/chat/completions"
            />
            {fieldIssue("endpoint")}
          </label>
          <label htmlFor={`${id}-modelsUrl`}>
            模型列表地址（可选）
            <Input
              {...fieldProps("modelsUrl")}
              aria-label="模型列表地址"
              value={form.modelsUrl}
              onChange={(event) => {
                setModels([]);
                setListUnavailable(false);
                update({ modelsUrl: event.target.value });
              }}
              placeholder="https://example.com/v1/models"
            />
            {fieldIssue("modelsUrl")}
          </label>
        </>
      )}
      <label htmlFor={`${id}-token`}>
        密钥
        <Input.Password
          {...fieldProps("token")}
          aria-label="密钥"
          value={form.token}
          onChange={(event) => update({ token: event.target.value })}
          placeholder={saved.token ? "已保存密钥，留空继续使用" : "请输入密钥"}
          autoComplete="off"
        />
        {fieldIssue("token")}
      </label>
      <label htmlFor={`${id}-model`}>
        模型
        <AutoComplete<string, { value: string }>
          {...fieldProps("model")}
          aria-label="模型"
          value={form.model}
          onChange={(value) => {
            modelEdited.current = true;
            update({ model: value });
          }}
          {...selectTooltipProps}
          options={withoutOptionTitles(models.map((value) => ({ value })))}
          showSearch={{
            filterOption: (value, option) =>
              models.includes(value) ||
              Boolean(
                option?.value.toLowerCase().includes(value.toLowerCase()),
              ),
          }}
          placeholder="选择或输入模型名称"
        />
        {fieldIssue("model")}
        {listUnavailable && (
          <Typography.Text type="secondary">
            模型列表暂不可用，可直接输入模型名称。
          </Typography.Text>
        )}
      </label>
      {issue && !issue.field && (
        <Alert showIcon title={issue.message} type="error" />
      )}
      {connected && (
        <Alert showIcon title="连接成功，设置已保存。" type="success" />
      )}
      <Flex gap={8} wrap>
        <Button
          type="primary"
          loading={testing}
          onClick={() => void testAndSave()}
        >
          测试并保存
        </Button>
        {connected && <Button type="text" onClick={onConnected}>返回工作区</Button>}
      </Flex>
      <Typography.Text type="secondary">
        生成时，课程信息和当前学生的课堂观察会发送至所选 AI 服务。
      </Typography.Text>
    </section>
  );
}
