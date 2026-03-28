/**
 * FormField — Einheitliches Formularfeld mit Label, Hint und Error.
 */

interface Props {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function FormField({ label, hint, error, htmlFor, children }: Props) {
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="form-field__hint">{hint}</p>}
      {error && <p className="form-field__error">{error}</p>}
    </div>
  );
}
