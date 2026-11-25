export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}
export interface MessageTool {
  type: "function";
  function: {
    description: string;
    name: string;
    parameters: object;
    strict: boolean;
  };
}
export type ModelType = string;

// 添加供应商类型定义
export type ProviderType =
  | "siliconflow"
  | "openai"
  | "deepseek"
  | "gemini"
  | "custom";

// 供应商配置接口
export interface ProviderConfig {
  name: string;
  apiUrl: string;
  modelListUrl: string;
  defaultModel: ModelType;
}

// 预定义供应商配置
export const PROVIDERS: Record<ProviderType, ProviderConfig> = {
  siliconflow: {
    name: "硅基流动",
    apiUrl: "https://api.siliconflow.cn/v1/chat/completions",
    modelListUrl: "https://api.siliconflow.cn/v1/models?type=text",
    defaultModel: "Qwen/Qwen3-32B",
  },
  openai: {
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    modelListUrl: "https://api.openai.com/v1/models",
    defaultModel: "gpt-3.5-turbo",
  },
  deepseek: {
    name: "DeepSeek",
    apiUrl: "https://api.deepseek.com/chat/completions",
    modelListUrl: "https://api.deepseek.com/models",
    defaultModel: "deepseek-chat",
  },
  gemini: {
    name: "Gemini",
    apiUrl:
      "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
    modelListUrl: "https://generativelanguage.googleapis.com/v1/models",
    defaultModel: "gemini-pro",
  },
  custom: {
    name: "自定义",
    apiUrl: "",
    modelListUrl: "",
    defaultModel: "Qwen/Qwen3-32B",
  },
};

export type ContentType = "content" | "reasoning_content";
export class RequestError extends Error {
  constructor(
    message: string,
    public retryable = false,
    public retryAfterMs = 0,
    public status?: number,
  ) {
    super(message);
  }
}
export interface RequestConfig {
  provider: ProviderType;
  config: ProviderConfig;
  token: string;
  model: string;
}

const providerModelKey = (provider: ProviderType) => `ai-model:${provider}`;

const readProviderModel = (provider: ProviderType): string | undefined => {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(providerModelKey(provider)) || "null",
    );
    return typeof value === "string" && value.trim() ? value : undefined;
  } catch {
    return undefined;
  }
};

export async function readEventStream(
  response: Response,
  onData: (value: string) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) throw new RequestError("没有收到反馈，请重新生成。", true);
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  const line = (value: string) => {
    if (!value) {
      if (data.length) {
        onData(data.join("\n"));
        data = [];
      }
    } else if (value.startsWith("data:"))
      data.push(value.slice(5).replace(/^ /, ""));
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, end).replace(/\r$/, ""));
        buffer = buffer.slice(end + 1);
      }
      if (done) {
        if (buffer) line(buffer);
        line("");
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

class API {
  private static token = "";
  private static provider: ProviderType = "siliconflow";
  private static model = "Qwen/Qwen3-32B";
  private static customProviderConfig: ProviderConfig = { ...PROVIDERS.custom };
  static model_list: string[] = [];
  static modelListAvailable = false;
  static allowCustomModel = false;
  static hydrate() {
    try {
      const saved = localStorage.getItem("api_provider") as ProviderType;
      if (Object.prototype.hasOwnProperty.call(PROVIDERS, saved))
        API.provider = saved;
      const custom = localStorage.getItem("custom_provider_config");
      if (custom)
        API.customProviderConfig = {
          ...PROVIDERS.custom,
          ...JSON.parse(custom),
        };
      API.model =
        readProviderModel(API.provider) ||
        API.getCurrentProviderConfig().defaultModel;
      API.token =
        localStorage.getItem(`api_key:${API.provider}`) ||
        localStorage.getItem("api_key") ||
        "";
      if (localStorage.getItem("api_key")) {
        localStorage.setItem(`api_key:${API.provider}`, API.token);
        localStorage.removeItem("api_key");
      }
    } catch {
      API.token = "";
    }
  }
  static snapshot(): RequestConfig {
    return {
      provider: API.provider,
      config: { ...API.getCurrentProviderConfig() },
      token: API.token,
      model: API.model,
    };
  }
  static getProviderSnapshot(provider: ProviderType): RequestConfig {
    if (provider === API.provider) return API.snapshot();
    const config =
      provider === "custom" ? API.customProviderConfig : PROVIDERS[provider];
    return {
      provider,
      config: { ...config },
      token: localStorage.getItem(`api_key:${provider}`) || "",
      model: readProviderModel(provider) || config.defaultModel,
    };
  }
  static saveConfiguration(
    { provider, config, token, model }: RequestConfig,
    models: string[],
  ) {
    const changes = new Map<string, string>();
    if (provider !== API.provider && API.model) {
      changes.set(providerModelKey(API.provider), JSON.stringify(API.model));
    }
    if (provider === "custom") {
      changes.set("custom_provider_config", JSON.stringify(config));
    }
    changes.set(`api_key:${provider}`, token);
    changes.set(providerModelKey(provider), JSON.stringify(model));
    changes.set("ai-model", JSON.stringify(model));
    changes.set("api_provider", provider);

    const previous = new Map(
      Array.from(changes.keys(), (key) => [key, localStorage.getItem(key)]),
    );
    const written: string[] = [];
    try {
      for (const [key, value] of changes) {
        localStorage.setItem(key, value);
        written.push(key);
      }
    } catch (error) {
      for (const key of written.reverse()) {
        const oldValue = previous.get(key);
        if (oldValue == null) localStorage.removeItem(key);
        else localStorage.setItem(key, oldValue);
      }
      throw error;
    }

    if (provider === "custom") API.customProviderConfig = { ...config };
    API.provider = provider;
    API.token = token;
    API.model = model;
    API.model_list = models;
    API.modelListAvailable = models.length > 0;
  }
  static setToken(token: string) {
    API.token = token.trim();
  }
  static saveToken(token: string) {
    API.setToken(token);
    localStorage.setItem(`api_key:${API.provider}`, API.token);
  }
  static tokenReady() {
    return Boolean(API.token);
  }
  static getMackToken() {
    return API.token ? "已保存密钥" : "请输入密钥";
  }
  static getProvider() {
    return API.provider;
  }
  static setProvider(provider: ProviderType) {
    API.provider = provider;
    API.token = localStorage.getItem(`api_key:${provider}`) || "";
    API.model =
      readProviderModel(provider) ||
      API.getCurrentProviderConfig().defaultModel;
    API.model_list = [];
    API.modelListAvailable = false;
    localStorage.setItem("api_provider", provider);
  }
  static getCurrentProviderConfig() {
    return API.provider === "custom"
      ? API.customProviderConfig
      : PROVIDERS[API.provider];
  }
  static getCustomProviderConfig() {
    return API.customProviderConfig;
  }
  static setCustomProviderConfig(config: Partial<ProviderConfig>) {
    API.customProviderConfig = { ...API.customProviderConfig, ...config };
    localStorage.setItem(
      "custom_provider_config",
      JSON.stringify(API.customProviderConfig),
    );
  }
  static getProviders() {
    return Object.entries(PROVIDERS).map(([value, config]) => ({
      value,
      label: config.name,
    }));
  }
  static setModel(model: string) {
    API.model = model;
  }
  static setCustomModel(model: string) {
    API.setModel(model);
  }
  static getModel() {
    return API.model;
  }
  static isCustomModelAllowed() {
    return !API.modelListAvailable || API.model_list.length === 0;
  }
  static async fetchModelList(snapshot: RequestConfig, signal?: AbortSignal) {
    if (!snapshot.token || !snapshot.config.modelListUrl)
      throw new RequestError("请先填写密钥和服务地址。");
    const timeout = AbortSignal.timeout(15000);
    const response = await fetch(snapshot.config.modelListUrl, {
      headers:
        snapshot.provider === "gemini"
          ? { "x-goog-api-key": snapshot.token }
          : { Authorization: `Bearer ${snapshot.token}` },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok)
      throw new RequestError(
        `连接失败（${response.status}），请检查密钥与服务地址。`,
        false,
        0,
        response.status,
      );
    const body = await response.json();
    const gemini = snapshot.provider === "gemini";
    const entries = gemini ? body?.models : body?.data;
    if (!Array.isArray(entries)) return [];
    const names = entries
      .map((entry) => (gemini ? entry?.name : entry?.id))
      .filter((name): name is string => typeof name === "string")
      .map((name) => (gemini ? name.replace(/^models\//, "") : name).trim())
      .filter(Boolean);
    return [...new Set(names)];
  }
  static async getModelList() {
    const snapshot = API.snapshot();
    const models = await API.fetchModelList(snapshot);
    if (snapshot.provider === API.provider) {
      API.model_list = models;
      API.modelListAvailable = models.length > 0;
    }
    return models;
  }
  static async testConnection(snapshot: RequestConfig, signal?: AbortSignal) {
    const receivedText = new AbortController();
    const timeout = AbortSignal.timeout(15000);
    const signals = [receivedText.signal, timeout];
    if (signal) signals.push(signal);
    try {
      await API.request(
        snapshot,
        [
          { role: "system", content: "请简短回复。" },
          { role: "user", content: "请回复 OK。" },
        ],
        (content, type) => {
          if (type === "content" && content.trim()) receivedText.abort();
        },
        AbortSignal.any(signals),
      );
    } catch (error) {
      if (receivedText.signal.aborted) return;
      if (timeout.aborted && !signal?.aborted) {
        throw new RequestError("测试连接超时，请检查服务后重试。");
      }
      throw error;
    }
  }
  async sendMessage(
    callback?: (content: string | null, type?: ContentType) => void,
    onFinish?: () => void,
    ...messages: Message[]
  ) {
    try {
      await API.request(API.snapshot(), messages, (content, type) =>
        callback?.(content, type),
      );
      onFinish?.();
    } catch {
      callback?.(null);
    }
  }
  static async request(
    snapshot: RequestConfig,
    messages: Message[],
    onContent: (content: string, type: ContentType) => void,
    signal?: AbortSignal,
  ) {
    const { provider, config, token, model } = snapshot;
    if (!token) throw new RequestError("请先在设置中保存密钥。");
    const combinedSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(120000)])
      : AbortSignal.timeout(120000);
    const gemini = provider === "gemini";
    const url = gemini
      ? `${config.apiUrl.split("/models/")[0]}/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`
      : config.apiUrl;
    const body = gemini
      ? {
          systemInstruction: {
            parts: messages
              .filter((m) => m.role === "system")
              .map((m) => ({ text: m.content })),
          },
          contents: messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
        }
      : { model, messages, stream: true, temperature: 0.7 };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(gemini
            ? { "x-goog-api-key": token }
            : { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
        signal: combinedSignal,
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? /^\d+$/.test(retryAfter)
            ? Number(retryAfter) * 1000
            : Math.max(0, Date.parse(retryAfter) - Date.now())
          : 0;
        throw new RequestError(
          response.status === 401 || response.status === 403
            ? "密钥不可用，请在设置中检查。"
            : `服务暂时不可用（${response.status}）。`,
          retryable,
          Number.isFinite(delay) ? delay : 0,
          response.status,
        );
      }
      if (gemini) {
        const result = await response.json();
        const content = result.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text || "")
          .join("");
        if (!content)
          throw new RequestError("没有收到反馈，请重新生成。", true);
        onContent(content, "content");
        return;
      }
      let content = "",
        reasoning = "";
      await readEventStream(response, (data) => {
        if (data.trim() === "[DONE]") return;
        const parsed = JSON.parse(data);
        if (parsed.error)
          throw new RequestError("服务返回错误，请检查模型设置。", false);
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          onContent(content, "content");
        }
        if (delta?.reasoning_content) {
          reasoning += delta.reasoning_content;
          onContent(reasoning, "reasoning_content");
        }
      });
      if (!content.trim())
        throw new RequestError("没有收到反馈，请重新生成。", true);
    } catch (error) {
      if (signal?.aborted) throw new RequestError("已取消生成。");
      if (error instanceof RequestError) throw error;
      throw new RequestError(
        combinedSignal.aborted
          ? "生成超时，请稍后重试。"
          : "连接中断，请稍后重试。",
        true,
      );
    }
  }
}
API.hydrate();
export default API;
