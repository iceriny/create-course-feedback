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
  signal?: AbortSignal;
}

export interface AIClient {
  getModel: () => ModelType;
  getProvider: () => ProviderType;
  isTokenReady: () => boolean;
  sendMessages: (input: AIClientSendInput) => void | Promise<void>;
}

export class ProviderAIClient implements AIClient {
  private readonly config = API.snapshot();
  getModel() {
    return this.config.model;
  }
  getProvider() {
    return this.config.provider;
  }
  isTokenReady() {
    return Boolean(this.config.token);
  }
  async sendMessages({
    messages,
    onContent,
    onError,
    onFinish,
    signal,
  }: AIClientSendInput) {
    try {
      await API.request(this.config, messages, onContent, signal);
      onFinish();
    } catch (error) {
      onError(error instanceof Error ? error : new Error("生成失败，请重试。"));
    }
  }
}
