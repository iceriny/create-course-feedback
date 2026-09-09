import IconButton from "./IconButton";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Modal, Typography } from "antd";
import { AudioOutlined } from "@ant-design/icons";
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export default function VoiceInput({
  disabled,
  onInsert,
}: {
  disabled?: boolean;
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [listening, setListening] = useState(false),
    [text, setText] = useState(""),
    [interim, setInterim] = useState(""),
    [error, setError] = useState("");
  const ref = useRef<Recognition | null>(null);
  const dispose = () => {
    const recognition = ref.current;
    ref.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
  };
  useEffect(() => dispose, []);
  useEffect(() => {
    if (disabled) {
      dispose();
      setListening(false);
      setOpen(false);
    }
  }, [disabled]);
  const close = () => {
    dispose();
    setListening(false);
    setOpen(false);
  };
  const start = () => {
    const ctor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!ctor) {
      setError("此浏览器暂不支持语音识别，可使用系统输入法的语音功能。");
      return;
    }
    dispose();
    setError("");
    setInterim("");
    const recognition = new ctor();
    ref.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    const prefix = text;
    recognition.onresult = (event) => {
      let final = "",
        pending = "";
      Array.from(event.results).forEach((result) => {
        if (result.isFinal) final += result[0].transcript;
        else pending += result[0].transcript;
      });
      setText(prefix + final);
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "麦克风未获授权，请在浏览器中允许后重试。"
          : event.error === "no-speech"
            ? "没有听到语音，请重试。"
            : "语音识别未完成，请检查麦克风与网络后重试。",
      );
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("无法启动录音，请稍后重试。");
      setListening(false);
    }
  };
  return (
    <>
      <IconButton
        label="语音填写"
        size="small"
        type="text"
        icon={<AudioOutlined />}
        disabled={disabled}
        onClick={() => {
          setText("");
          setError("");
          setOpen(true);
        }}
      />
      <Modal
        title="语音填写"
        open={open && !disabled}
        onCancel={close}
        okText="填入文本"
        onOk={() => {
          if (text.trim()) onInsert(text.trim());
          close();
        }}
        okButtonProps={{ disabled: listening || !text.trim() }}
      >
        <Typography.Paragraph type="secondary">
          识别普通话，结束后可修改再填入。语音可能由浏览器的在线服务处理。
        </Typography.Paragraph>
        {error && <Alert type="warning" title={error} showIcon />}
        <Button
          onClick={() => (listening ? ref.current?.stop() : start())}
          danger={listening}
        >
          {listening ? "结束录音" : "开始录音"}
        </Button>
        <p role="status">{listening ? `正在听… ${interim}` : "识别结果"}</p>
        <Input.TextArea
          aria-label="语音识别结果"
          value={text}
          disabled={listening}
          onChange={(e) => setText(e.target.value)}
          rows={6}
        />
      </Modal>
    </>
  );
}
