// Setting row with a switch on the right. The whole row toggles it on touch.
export default function SettingSwitch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pd-setting k-setting" onClick={() => !disabled && onChange(!checked)}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <button
        type="button"
        className="pd-switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      />
    </div>
  );
}
