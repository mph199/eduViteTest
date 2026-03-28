export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="superadmin__field">
      <span className="superadmin__label">{label}</span>
      <div className="superadmin__color-row">
        <input
          type="color"
          className="superadmin__color-swatch"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="superadmin__color-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
