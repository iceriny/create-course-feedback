import { useMemo, useRef, useState } from "react";
import { AutoComplete, Input } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { useInputAssistantStore } from "../../store/InputAssistantStore";
import { useRosterStore } from "../../store/rosterStore";
import {
  rankSuggestions,
  readObservationHistory,
  type ObservationRecord,
} from "../../domain/observationSuggestions";
import VoiceInput from "../common/VoiceInput";
import useVoiceInput from "../common/useVoiceInput";
import FixedTextEditor from "../common/FixedTextEditor";
import {
  selectTooltipProps,
  withoutOptionTitles,
} from "../common/selectTooltips";
import type { V2QuickOptions } from "../../types";

export default function ObservationInput({
  id,
  field,
  label,
  value,
  active,
  disabled,
  onChange,
  onNext,
}: {
  id: string;
  field: string;
  label: string;
  value: string;
  active: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onNext: () => void;
}) {
  const [records, setRecords] = useState<ObservationRecord[]>([]);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const textarea = useRef<TextAreaRef>(null);
  const canDictate = active && !disabled;
  const voice = useVoiceInput(canDictate, onChange);
  const shownValue = voice.preview ?? value;
  const showOptions = focused && canDictate && !dragging && !voice.active;
  const legacy = useInputAssistantStore((s) =>
    showOptions ? s.v1Suggestions : undefined,
  );
  const custom = useInputAssistantStore((s) =>
    showOptions ? s.v2CustomOptions : undefined,
  );
  const options = useMemo(() => {
    if (!legacy || !custom) return [];
    const { activeClass, studentsList } = useRosterStore.getState();
    const name = studentsList.find((s) => s.id === id)?.name;
    const mine = (record: ObservationRecord) =>
      record.className === activeClass &&
      (record.studentId ? record.studentId === id : record.name === name);
    const history = rankSuggestions(
      records.filter((r) => mine(r) && r.field === field).map((r) => r.text),
      value,
    ).slice(0, 12);
    const defaults = useInputAssistantStore.getState().getV2Options();
    const inspiration = rankSuggestions(
      [
        ...records.filter((r) => !mine(r)).map((r) => r.text),
        ...Object.values(legacy).flat(),
        ...(custom[field as keyof V2QuickOptions] || []),
        ...(field === "brief"
          ? Object.values(defaults).flat()
          : defaults[field as keyof V2QuickOptions] || []),
      ],
      value,
    )
      .filter((text) => !history.includes(text))
      .slice(0, 20);
    return withoutOptionTitles(
      [
        { label: "历史记录 · 该学生", entries: history },
        { label: "启发提示 · 其他学生与常用表达", entries: inspiration },
      ]
        .filter(({ entries }) => entries.length)
        .map(({ label, entries }) => ({
          label,
          options: entries.map((text) => ({
            value: text,
            label: <span className="suggestion-text">{text}</span>,
          })),
        })),
    );
  }, [custom, field, id, legacy, records, value]);

  const remember = (text: string) => {
    const store = useInputAssistantStore.getState();
    void (
      field === "brief"
        ? store.addV1Suggestion(useRosterStore.getState().activeClass, text)
        : store.addV2CustomOption(field as keyof V2QuickOptions, text)
    ).catch(() => {});
  };
  return (
    <div
      className={`observation-field ${field === "brief" ? "brief-field" : ""}`}
      onBlurCapture={(event) => {
        if (
          (event.relatedTarget || document.hasFocus()) &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          voice.cancel();
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && voice.active) {
          event.preventDefault();
          event.stopPropagation();
          voice.cancel();
        }
      }}
    >
      <div className="observation-label">
        <span>{label}</span>
      </div>
      <FixedTextEditor
        label={label}
        value={shownValue}
        onDragChange={setDragging}
      >
        <AutoComplete
          {...selectTooltipProps}
          variant="borderless"
          className="observation-autocomplete"
          value={shownValue}
          options={options}
          open={dragging || !active || voice.active ? false : undefined}
          filterOption={false}
          onFocus={() => {
            const state = useRosterStore.getState();
            setRecords([
              ...readObservationHistory(),
              ...state.studentsList.flatMap((s, i) =>
                Object.entries(state.studentsInfo[i]?.performance || {}).map(
                  ([f, text]) => ({
                    studentId: s.id,
                    name: s.name,
                    className: state.activeClass,
                    field: f,
                    text,
                  }),
                ),
              ),
            ]);
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
            setRecords([]);
            remember(value);
          }}
          onChange={onChange}
          onSelect={remember}
          disabled={disabled}
        >
          <Input.TextArea
            ref={textarea}
            variant="filled"
            aria-label={label}
            data-observation={active || undefined}
            placeholder="填写表现，或选择历史与启发提示"
            readOnly={voice.active}
            onPointerDown={(event) =>
              voice.beginPress(event.nativeEvent, event.currentTarget)
            }
            onContextMenu={(event) => {
              if (voice.active) event.preventDefault();
            }}
            onKeyDown={(e) => {
              if (
                !e.nativeEvent.isComposing &&
                e.ctrlKey &&
                e.key === "Enter"
              ) {
                e.preventDefault();
                onNext();
              }
            }}
          />
        </AutoComplete>
        {canDictate && (
          <VoiceInput
            voice={voice}
            getInput={() => textarea.current?.resizableTextArea?.textArea}
          />
        )}
      </FixedTextEditor>
    </div>
  );
}
