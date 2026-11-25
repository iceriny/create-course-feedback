import { useCallback, useLayoutEffect, useRef, useState } from "react";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
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

type Session = { recognition: Recognition; stopping: boolean };
type Phase = "idle" | "starting" | "listening" | "finishing";
const holdDelay = 420;
const dragDistance = 8;

function detach({ recognition }: Session) {
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
}

const errorMessages: Record<string, string> = {
  "not-allowed": "请允许浏览器使用麦克风。",
  "service-not-allowed": "此浏览器的语音服务暂不可用。",
  "audio-capture": "未找到可用的麦克风。",
  "no-speech": "没有听到语音，请重试。",
};

export default function useVoiceInput(
  enabled: boolean,
  onChange: (value: string) => void,
) {
  const session = useRef<Session>(null);
  const press = useRef<AbortController>(null);
  const commit = useRef(onChange);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    commit.current = onChange;
  }, [onChange]);

  const clearPress = useCallback(() => {
    press.current?.abort();
    press.current = null;
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setPreview(undefined);
  }, []);

  const dispose = useCallback(() => {
    clearPress();
    const current = session.current;
    session.current = null;
    if (current) {
      detach(current);
      current.recognition.abort();
    }
  }, [clearPress]);

  const cancel = useCallback(() => {
    dispose();
    reset();
    setError("");
  }, [dispose, reset]);

  useLayoutEffect(() => {
    if (!enabled) cancel();
    return dispose;
  }, [cancel, dispose, enabled]);

  const stop = () => {
    const current = session.current;
    if (!current || current.stopping) return;
    current.stopping = true;
    setPhase("finishing");
    try {
      current.recognition.stop();
    } catch {
      dispose();
      reset();
    }
  };

  const start = (input: HTMLTextAreaElement) => {
    if (!enabled || session.current || !input.isConnected) return false;
    const speech = window as SpeechWindow;
    const Recognition =
      speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
    if (!Recognition) {
      setError("此浏览器暂不支持语音识别，可使用输入法的语音功能。");
      return false;
    }

    const recognition = new Recognition();
    const current = { recognition, stopping: false };
    const before = input.value.slice(0, input.selectionStart);
    const after = input.value.slice(input.selectionEnd);
    let finalText = "";
    session.current = current;
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;

    const finish = (message = "") => {
      if (session.current !== current) return;
      session.current = null;
      detach(current);
      reset();
      setError(message);
      if (finalText && document.activeElement === input) {
        const caret = before.length + finalText.length;
        requestAnimationFrame(() => {
          if (
            !session.current &&
            document.activeElement === input &&
            input.value === before + finalText + after
          ) {
            input.setSelectionRange(caret, caret);
          }
        });
      }
    };

    recognition.onstart = () => {
      if (session.current === current && !current.stopping)
        setPhase("listening");
    };
    recognition.onresult = ({ results }) => {
      if (session.current !== current || !input.isConnected) return;
      let final = "";
      let interim = "";
      for (const result of Array.from(results)) {
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final && final !== finalText) {
        finalText = final;
        commit.current(before + finalText + after);
      }
      setPreview(interim ? before + finalText + interim + after : undefined);
    };
    recognition.onerror = ({ error: reason }) =>
      finish(
        reason === "aborted"
          ? ""
          : (errorMessages[reason] ?? "语音识别未完成，请重试。"),
      );
    recognition.onend = () => finish();

    try {
      setError("");
      setPhase("starting");
      recognition.start();
      return true;
    } catch {
      finish("无法启动语音识别，请重试。");
      return false;
    }
  };

  const beginPress = (
    event: PointerEvent,
    input: HTMLTextAreaElement,
    fromButton = false,
  ) => {
    if (!enabled || session.current || !event.isPrimary || event.button !== 0)
      return;
    if (
      !fromButton &&
      (input !== document.activeElement ||
        input.selectionStart !== input.selectionEnd)
    )
      return;
    if (fromButton) event.preventDefault();

    clearPress();
    const controller = new AbortController();
    press.current = controller;
    const { pointerId, clientX, clientY } = event;
    const target =
      fromButton && event.target instanceof Element
        ? (event.target.closest("button") ?? input)
        : input;
    let started = false;
    const finish = () => {
      clearPress();
      if (started) stop();
    };
    const timer = window.setTimeout(() => {
      if (
        fromButton ||
        (input === document.activeElement &&
          input.selectionStart === input.selectionEnd)
      ) {
        started = start(input);
        if (started) {
          try {
            target.setPointerCapture(pointerId);
          } catch {
            // The browser can end the pointer while opening a permission prompt.
          }
        }
      }
    }, holdDelay);
    controller.signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        if (target.hasPointerCapture(pointerId))
          target.releasePointerCapture(pointerId);
      },
      { once: true },
    );
    const options = { signal: controller.signal, capture: true };
    window.addEventListener(
      "pointermove",
      (move) => {
        if (
          move.pointerId === pointerId &&
          Math.hypot(move.clientX - clientX, move.clientY - clientY) >
            dragDistance
        )
          finish();
      },
      options,
    );
    for (const type of ["pointerup", "pointercancel"] as const) {
      window.addEventListener(
        type,
        (end) => {
          if (end.pointerId === pointerId) finish();
        },
        options,
      );
    }
  };

  return {
    phase,
    active: phase !== "idle",
    preview,
    error,
    beginPress,
    cancel,
    toggle(input: HTMLTextAreaElement) {
      if (session.current) stop();
      else start(input);
    },
  };
}
