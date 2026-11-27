import { Button, Tooltip } from "antd";
import { AudioOutlined } from "@ant-design/icons";
import type useVoiceInput from "./useVoiceInput";

const statusText = {
  idle: "",
  starting: "正在启动语音输入",
  listening: "正在听",
  finishing: "正在整理识别结果",
};

export default function VoiceInput({
  voice,
  getInput,
  hint,
}: {
  voice: ReturnType<typeof useVoiceInput>;
  getInput: () => HTMLTextAreaElement | null | undefined;
  hint?: boolean;
}) {
  const label = voice.active ? "结束语音输入" : "长按语音输入";
  return (
    <>
      <Tooltip
        title={hint ? "长按麦克风说话，松开结束" : label}
        open={hint || undefined}
        trigger={["hover", "focus"]}
      >
        <Button
          className="icon-action voice-input"
          aria-label={label}
          size="small"
          type="text"
          data-voice-phase={voice.phase}
          icon={
            voice.active ? (
              <svg
                className="voice-wave"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <rect x="3" y="6" width="2" height="8" rx="1" />
                <rect x="9" y="3" width="2" height="14" rx="1" />
                <rect x="15" y="6" width="2" height="8" rx="1" />
              </svg>
            ) : (
              <AudioOutlined />
            )
          }
          onPointerDown={(event) => {
            const input = getInput();
            if (input) voice.beginPress(event.nativeEvent, input, true);
          }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            const input = getInput();
            if (input && !event.repeat) voice.toggle(input);
          }}
          onClick={(event) => {
            const input = getInput();
            // A synthesized click also supports assistive technology activation.
            if (input && (event.detail === 0 || voice.active))
              voice.toggle(input);
          }}
        />
      </Tooltip>
      <span
        className={voice.error ? "voice-message" : "voice-announcement"}
        role="status"
      >
        {voice.error || statusText[voice.phase]}
      </span>
    </>
  );
}
