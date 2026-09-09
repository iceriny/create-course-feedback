import { useState } from "react";
import { AutoComplete, Input } from "antd";
import { useInputAssistantStore } from "../../store/InputAssistantStore";
import { useRosterStore } from "../../store/rosterStore";
import {
  rankSuggestions,
  readObservationHistory,
  type ObservationRecord,
} from "../../domain/observationSuggestions";
import VoiceInput from "../common/VoiceInput";
export default function ObservationInput({
  id,
  field,
  label,
  value,
  disabled,
  compact,
  onChange,
  onNext,
}: {
  id: string;
  field: string;
  label: string;
  value: string;
  disabled: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  onNext: () => void;
}) {
  const [records, setRecords] = useState<ObservationRecord[]>([]);
  const [focused, setFocused] = useState(false);
  const legacy = useInputAssistantStore((s) => s.v1Suggestions);
  const custom = useInputAssistantStore((s) => s.v2CustomOptions);
  const student = useRosterStore
    .getState()
    .studentsList.find((s) => s.id === id)!;
  const activeClass = useRosterStore.getState().activeClass;
  const mine = (r: ObservationRecord) =>
    r.className === activeClass &&
    (r.studentId ? r.studentId === id : r.name === student.name);
  const history = rankSuggestions(
    records.filter((r) => mine(r) && r.field === field).map((r) => r.text),
    value,
  ).slice(0, 12);
  const defaults = useInputAssistantStore.getState().getV2Options();
  const inspiration = rankSuggestions(
    [
      ...records.filter((r) => !mine(r)).map((r) => r.text),
      ...Object.values(legacy).flat(),
      ...(custom[field as keyof typeof custom] || []),
      ...(field === "brief"
        ? Object.values(defaults).flat()
        : defaults[field as keyof typeof defaults] || []),
    ],
    value,
  )
    .filter((t) => !history.includes(t))
    .slice(0, 20);
  const remember = (text: string) => {
    const store = useInputAssistantStore.getState();
    void (
      field === "brief"
        ? store.addV1Suggestion(activeClass, text)
        : store.addV2CustomOption(field as keyof typeof custom, text)
    ).catch(() => {});
  };
  const options = [
    {
      label: "历史记录 · 该学生",
      options: history.map((text) => ({
        value: text,
        label: <span className="suggestion-text">{text}</span>,
      })),
    },
    {
      label: "启发提示 · 其他学生与常用表达",
      options: inspiration.map((text) => ({
        value: text,
        label: <span className="suggestion-text">{text}</span>,
      })),
    },
  ].filter((g) => g.options.length);
  return (
    <div
      className={`observation-field ${field === "brief" ? "brief-field" : ""}`}
    >
      <div className="observation-label">
        <span>{label}</span>
        <VoiceInput
          disabled={disabled}
          onInsert={(text) => {
            const next = [value, text].filter(Boolean).join("，");
            onChange(next);
            remember(next);
          }}
        />
      </div>
      <AutoComplete
        className="observation-autocomplete"
        value={value}
        options={focused ? options : []}
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
          remember(value);
        }}
        onChange={onChange}
        onSelect={remember}
        disabled={disabled}
      >
        <Input.TextArea
          aria-label={label}
          data-observation="true"
          autoSize={{
            minRows: compact ? 1 : field === "brief" ? 6 : 2,
            maxRows: compact ? 4 : 10,
          }}
          placeholder="填写表现，或选择历史与启发提示"
          onKeyDown={(e) => {
            if (!e.nativeEvent.isComposing && e.ctrlKey && e.key === "Enter") {
              e.preventDefault();
              onNext();
            }
          }}
        />
      </AutoComplete>
    </div>
  );
}
