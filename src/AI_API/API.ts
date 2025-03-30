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
        defaultModel: "Qwen/QwQ-32B",
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
        apiUrl: "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
        modelListUrl: "https://generativelanguage.googleapis.com/v1/models",
        defaultModel: "gemini-pro",
    },
    custom: {
        name: "自定义",
        apiUrl: "",
        modelListUrl: "",
        defaultModel: "Qwen/QwQ-32B",
    },
};

export interface MessageBody {
    model: ModelType;
    messages: Message[];
    stream: boolean;
    max_tokens: number;
    stop: string | null;
    temperature: number;
    top_p: number;
    top_k: number;
    frequency_penalty: number;
    n: number;
    response_format?: { type: string };
    tools?: MessageTool[];
}

export interface ModelListResponse {
    object: "list";
    data: {
        id: string;
        object: "model";
        created: 0;
        owned_by: "";
    }[];
}

export type ContentType = "content" | "reasoning_content";

interface Option {
    method: "POST";
    headers: {
        Authorization: `Bearer ${string}`;
        "Content-Type": "application/json";
    };
    body: string | null;
}

// 节流控制相关接口
interface QueueItem {
    message: Message[];
    callback?: (content: string | null, type?: ContentType) => void;
    onFinish?: () => void;
}

// Gemini模型响应类型
interface GeminiModelResponse {
    models: {
        name: string;
        version: string;
        displayName?: string;
        description?: string;
    }[];
}

class API {
    static instance: API;
    private static token: string;
    static messages: MessageBody;
    static option: Option;
    static model_list: string[] = [];
    private static model: ModelType = "Qwen/QwQ-32B";
    // 标记模型列表是否可用
    static modelListAvailable: boolean = true;
    // 允许自定义模型
    static allowCustomModel: boolean = false;

    // 新增：当前供应商
    private static provider: ProviderType = "siliconflow";
    private static customProviderConfig: ProviderConfig = {
        name: "自定义",
        apiUrl: "",
        modelListUrl: "",
        defaultModel: "Qwen/QwQ-32B",
    };

    // 节流控制相关属性
    private static readonly MAX_REQUESTS_PER_SECOND = 3;
    private static readonly MAX_REQUESTS_PER_MINUTE = 10;
    private requestQueue: QueueItem[] = [];
    private activeRequests: number = 0; // 当前活跃请求数
    private processing: boolean = false;
    private requestsThisSecond: number = 0;
    private requestsThisMinute: number = 0;
    private lastSecond: number = 0;
    private lastMinute: number = 0;

    // 节流状态监听器
    private throttleListeners: ((
        isThrottled: boolean,
        message: string
    ) => void)[] = [];

    constructor() {
        this.init();
        API.instance = this;
    }
    static getInstance() {
        return API.instance;
    }
    init() {
        // 从本地存储加载供应商设置
        const savedProvider = localStorage.getItem("api_provider");
        if (savedProvider) {
            API.provider = savedProvider as ProviderType;
        }

        // 加载自定义供应商配置
        const customConfig = localStorage.getItem("custom_provider_config");
        if (customConfig) {
            API.customProviderConfig = JSON.parse(customConfig);
        }

        API.messages = {
            model: API.model,
            messages: [],
            stream: true,
            max_tokens: 16384,
            stop: null,
            temperature: 0.7,
            top_p: 1,
            top_k: 50,
            frequency_penalty: 0.5,
            n: 1,
        };
        API.option = {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API.token}`,
                "Content-Type": "application/json",
            },
            body: null,
        };
        const api_key = localStorage.getItem("api_key");
        if (api_key) {
            API.setToken(api_key);
        }

        // 加载模型列表
        API.getModelList();

        // 加载自定义模型
        const customModel = localStorage.getItem("custom_model");
        if (customModel && API.provider === "custom") {
            API.model = customModel;
            API.messages.model = customModel;
        }
    }
    static setToken(token: string) {
        API.token = token;
    }

    static tokenReady() {
        return (
            API.token !== undefined && API.token !== "" && API.token !== null
        );
    }

    static getMackToken() {
        return `已存在令牌:${API.token.slice(0, 4)} ***……*** ${API.token.slice(
            -6
        )}`;
    }

    static setMessageBody() {
        API.option.headers.Authorization = `Bearer ${API.token}`;
        API.option.body = JSON.stringify(API.messages);
    }

    // 获取当前供应商配置
    static getCurrentProviderConfig(): ProviderConfig {
        return API.provider === "custom"
            ? API.customProviderConfig
            : PROVIDERS[API.provider];
    }

    // 设置供应商
    static setProvider(provider: ProviderType) {
        API.provider = provider;
        localStorage.setItem("api_provider", provider);
        // 切换供应商时更新模型
        API.model = API.getCurrentProviderConfig().defaultModel;
        API.messages.model = API.model;
        // 重新获取模型列表
        API.getModelList();
    }

    // 获取当前供应商
    static getProvider(): ProviderType {
        return API.provider;
    }

    // 设置自定义供应商配置
    static setCustomProviderConfig(config: Partial<ProviderConfig>) {
        API.customProviderConfig = { ...API.customProviderConfig, ...config };
        localStorage.setItem(
            "custom_provider_config",
            JSON.stringify(API.customProviderConfig)
        );
        // 如果当前是自定义供应商，更新模型列表
        if (API.provider === "custom") {
            API.getModelList();
        }
    }

    // 获取自定义供应商配置
    static getCustomProviderConfig(): ProviderConfig {
        return API.customProviderConfig;
    }

    // 获取所有支持的供应商
    static getProviders(): { value: ProviderType; label: string }[] {
        return Object.entries(PROVIDERS).map(([key, config]) => ({
            value: key as ProviderType,
            label: config.name,
        }));
    }

    // 设置自定义模型名称
    static setCustomModel(modelName: string) {
        if (modelName && modelName.trim() !== "") {
            API.model = modelName.trim();
            API.messages.model = API.model;
            localStorage.setItem("custom_model", API.model);
        }
    }

    // 获取是否允许自定义模型
    static isCustomModelAllowed(): boolean {
        return (
            API.allowCustomModel ||
            !API.modelListAvailable ||
            API.model_list.length === 0
        );
    }

    // 添加节流状态监听器
    addThrottleListener(
        listener: (isThrottled: boolean, message: string) => void
    ) {
        this.throttleListeners.push(listener);
        return () => {
            this.throttleListeners = this.throttleListeners.filter(
                (l) => l !== listener
            );
        };
    }

    // 通知所有监听器节流状态
    private notifyThrottleListeners(isThrottled: boolean, message: string) {
        this.throttleListeners.forEach((listener) =>
            listener(isThrottled, message)
        );
    }

    // 获取节流状态信息
    getThrottleStatus() {
        const now = Math.floor(Date.now() / 1000);
        const minuteNow = Math.floor(now / 60);

        // 如果进入新的秒/分钟，重置计数器
        if (now !== this.lastSecond) {
            this.lastSecond = now;
            this.requestsThisSecond = 0;
        }

        if (minuteNow !== this.lastMinute) {
            this.lastMinute = minuteNow;
            this.requestsThisMinute = 0;
        }

        // 检查是否超过限制
        const secondLimited =
            this.requestsThisSecond >= API.MAX_REQUESTS_PER_SECOND;
        const minuteLimited =
            this.requestsThisMinute >= API.MAX_REQUESTS_PER_MINUTE;

        return {
            isThrottled: secondLimited || minuteLimited,
            // 只显示分钟级别的限制消息
            shouldNotify: minuteLimited,
            message: minuteLimited
                ? "每分钟请求数超过限制，请等待(由于API提供商的限制，每分钟最多只能发送10次请求)"
                : "",
            requestsThisSecond: this.requestsThisSecond,
            requestsThisMinute: this.requestsThisMinute,
            // 返回当前可用的并发请求数（每秒最多3个）
            availableConcurrent: Math.min(
                API.MAX_REQUESTS_PER_SECOND - this.requestsThisSecond,
                API.MAX_REQUESTS_PER_MINUTE - this.requestsThisMinute
            ),
        };
    }

    // 处理请求队列
    private async processQueue() {
        if (this.processing || this.requestQueue.length === 0) {
            return;
        }

        this.processing = true;

        try {
            const throttleStatus = this.getThrottleStatus();

            if (throttleStatus.isThrottled) {
                // 只在每分钟超过限制时通知UI显示节流提醒
                if (throttleStatus.shouldNotify) {
                    this.notifyThrottleListeners(true, throttleStatus.message);
                }

                // 等待合适的时间后重试
                const waitTime =
                    throttleStatus.requestsThisSecond >=
                    API.MAX_REQUESTS_PER_SECOND
                        ? 1000
                        : 5000;
                setTimeout(() => {
                    this.processing = false;
                    this.processQueue();
                }, waitTime);
                return;
            }

            // 通知UI取消节流提醒
            this.notifyThrottleListeners(false, "");

            // 确定可以同时处理的请求数量
            const availableConcurrent = throttleStatus.availableConcurrent;

            // 没有可用的并发请求数，等待后重试
            if (availableConcurrent <= 0) {
                setTimeout(() => {
                    this.processing = false;
                    this.processQueue();
                }, 1000);
                return;
            }

            // 确定本次要处理的请求数量
            const requestsToProcess = Math.min(
                availableConcurrent,
                this.requestQueue.length
            );

            // 更新计数器
            this.requestsThisSecond += requestsToProcess;
            this.requestsThisMinute += requestsToProcess;

            // 并发处理多个请求
            const processingPromises = [];

            for (let i = 0; i < requestsToProcess; i++) {
                const item = this.requestQueue.shift();
                if (item) {
                    this.activeRequests++;
                    const promise = this._sendMessage(
                        item.message,
                        item.callback,
                        item.onFinish
                    ).finally(() => {
                        this.activeRequests--;

                        // 如果队列中还有请求，且当前没有正在处理的请求，继续处理
                        if (this.requestQueue.length > 0 && !this.processing) {
                            this.processQueue();
                        }
                    });

                    processingPromises.push(promise);
                }
            }

            // 当所有请求处理完成或者队列为空时，设置processing为false
            this.processing = false;

            // 如果队列中还有请求，且有可用的并发数，继续处理
            if (this.requestQueue.length > 0) {
                setTimeout(() => this.processQueue(), 50);
            }
        } catch (error) {
            console.error("Error processing queue:", error);
            this.processing = false;

            // 出错后稍等一会再继续处理
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    async sendMessage(
        callback?: (content: string | null, type?: ContentType) => void,
        onFinish?: () => void,
        ...message: Message[]
    ) {
        // 将请求添加到队列
        this.requestQueue.push({
            message,
            callback,
            onFinish,
        });

        // 处理队列
        this.processQueue();
    }

    // 实际发送请求的内部方法
    private async _sendMessage(
        message: Message[],
        callback?: (content: string | null, type?: ContentType) => void,
        onFinish?: () => void
    ) {
        console.log("sendMessage", message);
        API.messages.messages = API.messages.messages.concat(message);
        API.setMessageBody();

        const providerConfig = API.getCurrentProviderConfig();

        // 获取当前提供商类型
        const currentProvider = API.getProvider();

        // Gemini使用不同的API格式
        if (currentProvider === "gemini") {
            return this._sendGeminiMessage(message, callback, onFinish);
        }

        const response = await fetch(providerConfig.apiUrl, API.option);
        const reader = response.body?.getReader();
        if (!reader) {
            console.error("Failed to get reader");
            return;
        }
        const decoder = new TextDecoder("utf-8");
        let content = "";
        let reasoning_content = "";
        console.log("Started streaming response");
        let null_count = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done || null_count > 5) {
                onFinish?.();
                break;
            }

            // 解码二进制数据为文本
            const chunkText = decoder.decode(value, { stream: true });

            // 处理逻辑（如拼接 JSON 或实时显示）
            const last = chunkText.split("\n");
            for (const chunk of last) {
                if (chunk.startsWith("data: ")) {
                    const data = chunk.slice(6);
                    if (data === "[DONE]") {
                        break;
                    }
                    try {
                        const jsonData = JSON.parse(data);
                        const this_reasoning_content =
                            jsonData.choices[0].delta.reasoning_content?.trim();
                        if (this_reasoning_content) {
                            reasoning_content += this_reasoning_content;
                            callback?.(reasoning_content, "reasoning_content");
                        }
                        const this_content =
                            jsonData.choices[0].delta.content?.trim();
                        if (this_content) {
                            content += this_content;
                            callback?.(content, "content");
                        }

                        if (
                            this_reasoning_content === null &&
                            this_content === null
                        ) {
                            null_count++;
                        }
                    } catch (error) {
                        console.error("Failed to parse JSON:", last);
                        console.error(error);
                        callback?.(null);
                    }
                }
            }
        }
    }

    // Gemini API请求处理方法
    private async _sendGeminiMessage(
        message: Message[],
        callback?: (content: string | null, type?: ContentType) => void,
        onFinish?: () => void
    ) {
        // 构建Gemini API格式的请求
        const geminiMessages = message.map((msg) => {
            // 将OpenAI格式转换为Gemini格式
            const role = msg.role === "assistant" ? "model" : msg.role;
            return {
                role,
                parts: [{ text: msg.content }],
            };
        });

        // 构建Gemini请求主体
        const geminiRequestBody = {
            contents: geminiMessages,
            generationConfig: {
                temperature: API.messages.temperature,
                topP: API.messages.top_p,
                topK: API.messages.top_k,
                maxOutputTokens: API.messages.max_tokens,
            },
        };

        // 设置Gemini API请求选项
        const geminiOption = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Gemini使用不同的认证方式，将API key作为URL参数
            },
            body: JSON.stringify(geminiRequestBody),
        };

        const providerConfig = API.getCurrentProviderConfig();

        // 添加API key作为URL参数
        const apiUrl = `${providerConfig.apiUrl}?key=${API.token}`;

        try {
            const response = await fetch(apiUrl, geminiOption);
            const data = await response.json();

            if (data.error) {
                console.error("Gemini API error:", data.error);
                callback?.(null);
                onFinish?.();
                return;
            }

            // 提取Gemini响应内容
            let content = "";
            if (data.candidates && data.candidates.length > 0) {
                content = data.candidates[0].content.parts[0].text;
                callback?.(content, "content");
            }

            onFinish?.();
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            callback?.(null);
            onFinish?.();
        }
    }

    static async getModelList() {
        // 重置模型列表可用性状态
        API.modelListAvailable = true;

        const options = {
            method: "GET",
            headers: { Authorization: `Bearer ${API.token}` },
        };

        const providerConfig = API.getCurrentProviderConfig();
        if (!providerConfig.modelListUrl) {
            console.warn("No model list URL provided for the current provider");
            API.modelListAvailable = false;
            return;
        }

        // 获取当前提供商类型
        const currentProvider = API.getProvider();

        // Gemini使用不同的认证方式和响应格式
        if (currentProvider === "gemini") {
            const apiUrl = `${providerConfig.modelListUrl}?key=${API.token}`;

            fetch(apiUrl)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            `HTTP error! status: ${response.status}`
                        );
                    }
                    return response.json();
                })
                .then((response: GeminiModelResponse) => {
                    // Gemini模型列表格式与OpenAI不同
                    if (response.models && response.models.length > 0) {
                        API.model_list = response.models.map(
                            (item) => item.name
                        );
                    } else {
                        // 如果没有获取到模型列表，至少设置默认模型
                        API.model_list = ["gemini-pro", "gemini-pro-vision"];
                        API.modelListAvailable = false;
                    }
                })
                .catch((err) => {
                    console.error(err);
                    // 设置默认模型列表
                    API.model_list = ["gemini-pro", "gemini-pro-vision"];
                    API.modelListAvailable = false;
                });
            return;
        }

        fetch(providerConfig.modelListUrl, options)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then((response: ModelListResponse) => {
                const data = response.data;
                if (data && data.length > 0) {
                    API.model_list = data.map((item) => item.id);
                } else {
                    API.modelListAvailable = false;
                    throw new Error("No models found in response");
                }
            })
            .catch((err) => {
                console.error(err);
                API.modelListAvailable = false;
                // 根据不同提供商设置默认模型列表
                switch (currentProvider) {
                    case "openai":
                        API.model_list = [
                            "gpt-3.5-turbo",
                            "gpt-4",
                            "gpt-4-turbo",
                        ];
                        break;
                    case "deepseek":
                        API.model_list = ["deepseek-chat", "deepseek-reasoner"];
                        break;
                    case "siliconflow":
                        API.model_list = ["Qwen/QwQ-32B"];
                        break;
                    case "custom":
                        // 对于自定义供应商，启用自定义模型输入
                        API.allowCustomModel = true;
                        API.model_list = [];
                        break;
                    default:
                        API.model_list = [];
                }
            });
    }

    static setModel(model: ModelType) {
        API.model = model;
        API.messages.model = model;
        API.setMessageBody();
    }
    static getModel() {
        return API.model;
    }
}

export default API;
