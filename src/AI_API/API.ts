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
export type ModelType = "Qwen/QwQ-32B";
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

class API {
    static instance: API;
    private static token: string;
    static messages: MessageBody;
    static option: Option;
    static model_list: string[] = [];
    private static model: ModelType = "Qwen/QwQ-32B";

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
        API.getModelList();
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

        const response = await fetch(
            "https://api.siliconflow.cn/v1/chat/completions",
            API.option
        );
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

    static async getModelList() {
        const options = {
            method: "GET",
            headers: { Authorization: `Bearer ${API.token}` },
        };

        fetch("https://api.siliconflow.cn/v1/models?type=text", options)
            .then((response) => response.json())
            .then((response: ModelListResponse) => {
                const data = response.data;
                API.model_list = data.map((item) => item.id);
            })
            .catch((err) => console.error(err));
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
