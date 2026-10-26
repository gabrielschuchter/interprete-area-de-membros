"use client";

/** Interruptor com rótulo, usado nas configurações; é um checkbox com papel de switch. */
export const GestaoSwitch = ({
  checked,
  description,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly description?: string;
  readonly label: string;
  readonly onChange: (value: boolean) => void;
}) => (
  <label className="gk-switch-row">
    <span>
      {label}
      {description ? <small>{description}</small> : null}
    </span>
    <input
      aria-checked={checked}
      checked={checked}
      className="gk-switch"
      onChange={(event) => onChange(event.target.checked)}
      role="switch"
      type="checkbox"
    />
  </label>
);
