import API, {
  type ContentType,
  type Message,
  type ModelType,
  type ProviderType,
} from "../../AI_API/API";

export interface AIClientStreamHandlers {
  onContent: (content: string, type: ContentType) => void;
  onError: (error: Error) => void;
  onFinish: () => void;
}

export interface AIClientSendInput extends AIClientStreamHandlers {
  messages: Message[];
}

export interface AIClient {
  getModel: () => ModelType;
  getProvider: () => ProviderType;
  isTokenReady: () => boolean;
  sendMessages: (input: AIClientSendInput) => void | Promise<void>;
}

export class ProviderAIClient implements AIClient {
  constructor(private readonly api: Pick<API, "sendMessage"> = new API()) {}

  getModel() {
    return API.getModel();
  }

  getProvider() {
    return API.getProvider();
  }

  isTokenReady() {
    return API.tokenReady();
  }

  sendMessages({ messages, onContent, onError, onFinish }: AIClientSendInput) {
    void this.api.sendMessage(
      (content, type) => {
        if (content === null) {
          onError(new Error("生成失败，请稍后重试。"));
          return;
        }

        if (type) {
          onContent(content, type);
        }
      },
      onFinish,
      ...messages,
    );
  }
}
