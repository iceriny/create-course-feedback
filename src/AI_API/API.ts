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
export interface MessageBody {
    model: "Qwen/QwQ-32B";
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

export type ContentType = "content" | "reasoning_content";

interface Option {
    method: "POST";
    headers: {
        Authorization: `Bearer ${string}`;
        "Content-Type": "application/json";
    };
    body: string | null;
}

class API {
    static instance: API;
    private static token: string;
    static messages: MessageBody;
    static option: Option;
    constructor() {
        this.init();
        API.instance = this;
    }
    static getInstance() {
        return API.instance;
    }
    init() {
        API.messages = {
            model: "Qwen/QwQ-32B",
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

    async sendMessage(
        callback?: (content: string | null, type?: ContentType) => void,
        onFinish?: () => void,
        ...message: Message[]
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
                        onFinish?.();
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

        // .then((response) => {
        //     return response.json();
        // })
        // .catch((err) => console.error(err));
    }
}

export default API;
