/**
 * SuperadminSidebar — Vertikale Navigation für den Konfigurationsbereich.
 */

import { useState } from 'react';
import { Blocks, Palette, Image, Mail, FileText, Shield, Key, Menu, X } from 'lucide-react';

export type TabId = 'modules' | 'branding' | 'backgrounds' | 'email' | 'texts' | 'datenschutz' | 'oauth';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'modules', label: 'Module', icon: Blocks },
  { id: 'branding', label: 'Erscheinungsbild', icon: Palette },
  { id: 'backgrounds', label: 'Hintergrundbilder', icon: Image },
  { id: 'email', label: 'E-Mail-Vorlage', icon: Mail },
  { id: 'texts', label: 'Buchungsseiten-Texte', icon: FileText },
  { id: 'datenschutz', label: 'Datenschutz & DSGVO', icon: Shield },
  { id: 'oauth', label: 'SSO / OAuth', icon: Key },
];

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function SuperadminSidebar({ activeTab, onTabChange }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        className="sa-sidebar__mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Konfigurationsmenü öffnen"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        <span>{NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Konfiguration'}</span>
      </button>

      <nav className={`sa-sidebar${mobileOpen ? ' sa-sidebar--open' : ''}`} aria-label="Konfiguration">
        <div className="sa-sidebar__title">Konfiguration</div>
        <ul className="sa-sidebar__list">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                className={`sa-sidebar__item${activeTab === id ? ' sa-sidebar__item--active' : ''}`}
                onClick={() => { onTabChange(id); setMobileOpen(false); }}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {mobileOpen && <div className="sa-sidebar__backdrop" onClick={() => setMobileOpen(false)} />}
    </>
  );
}
