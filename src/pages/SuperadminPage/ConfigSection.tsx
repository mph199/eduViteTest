/**
 * ConfigSection — Flache Formular-Sektion ohne schwere Card-Header.
 */

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function ConfigSection({ title, description, children }: Props) {
  return (
    <section className="config-section">
      <div className="config-section__header">
        <h3 className="config-section__title">{title}</h3>
        {description && <p className="config-section__desc">{description}</p>}
      </div>
      <div className="config-section__body">
        {children}
      </div>
    </section>
  );
}
