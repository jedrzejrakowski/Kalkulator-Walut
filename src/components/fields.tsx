import { useEffect, useState, type ReactNode } from 'react';
import { formatAmount, parseAmount } from '../domain/money';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  hint?: ReactNode;
}

/** Pole kwotowe przyjmujące zapis polski i angielski; patrz parseAmount. */
export function NumberField({ label, value, onChange, suffix, hint }: NumberFieldProps) {
  const [text, setText] = useState(() => (value === 0 ? '' : formatAmount(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value === 0 ? '' : formatAmount(value));
  }, [value, focused]);

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className={suffix ? 'input-suffix' : undefined}>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          placeholder="0,00"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setText(value === 0 ? '' : formatAmount(value));
          }}
          onChange={(event) => {
            setText(event.target.value);
            onChange(parseAmount(event.target.value));
          }}
        />
        {suffix ? <span>{suffix}</span> : null}
      </span>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

interface DateFieldProps {
  label: string;
  value: string;
  max?: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
}

export function DateField({ label, value, max, onChange, hint }: DateFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="date" value={value} max={max} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
