/**
 * ConfigPageHeader — Einheitlicher Seitenkopf für jeden Superadmin-Reiter.
 */

interface Props {
  title: string;
  description?: string;
}

export function ConfigPageHeader({ title, description }: Props) {
  return (
    <div className="config-page-header">
      <h2 className="config-page-header__title">{title}</h2>
      {description && <p className="config-page-header__desc">{description}</p>}
    </div>
  );
}
