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
            max_tokens: 1024,
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
    }
    static setToken(token: string) {
        API.token = token;
    }

    static setMessageBody() {
        API.option.headers.Authorization = `Bearer ${API.token}`;
        API.option.body = JSON.stringify(API.messages);
    }

    async sendMessage(
        callback?: (content: string) => void,
        ...message: Message[]
    ) {
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
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 解码二进制数据为文本
            const chunkText = decoder.decode(value, { stream: true });

            // 处理逻辑（如拼接 JSON 或实时显示）
            const last = chunkText;
            if (last.startsWith("data: ")) {
                const data = last.slice(6);
                if (data === "[DONE]") {
                    break;
                }
                try {
                    const jsonData = JSON.parse(data);
                    const content = jsonData.choices[0].delta.content;
                    if (content) {
                        callback?.(content);
                    }
                } finally {
                    callback?.("");
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
