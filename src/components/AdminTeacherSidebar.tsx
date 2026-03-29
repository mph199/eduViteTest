/**
 * AdminTeacherSidebar — Permanente Sidebar für den Admin/Teacher/Superadmin-Bereich.
 *
 * Sichtbar ab >1024px. Auf Mobile übernimmt der Hamburger-Drawer.
 * Nutzt dieselbe Nav-Logik wie der Drawer (useAdminNavGroups).
 */

import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { Blocks, Palette, Image, Mail, FileText, Shield, Key } from 'lucide-react';
import type { ComponentType } from 'react';
import { useAdminNavGroups } from '../hooks/useAdminNavGroups';
import type { NavGroup, SuperadminNavItem } from '../types';
import './AdminTeacherSidebar.css';

/** Map iconName string → lucide component */
const SUPERADMIN_ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
  Blocks,
  Palette,
  Image,
  Mail,
  FileText,
  Shield,
  Key,
};

function isSuperadminNavItem(item: Record<string, unknown>): item is SuperadminNavItem {
  return typeof (item as SuperadminNavItem).tabId === 'string';
}

export function AdminTeacherSidebar() {
  const { filteredGroups, isActive } = useAdminNavGroups();
  const navigate = useNavigate();

  const handleClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  return (
    <aside className="ats" aria-label="Navigation">
      <nav className="ats__nav">
        {filteredGroups.map((group: NavGroup, gi: number) => (
          <div
            key={group.label || group.items[0]?.path || gi}
            className="ats__section"
            {...(group.accentRgb ? { 'data-accent': true, style: { '--section-accent-rgb': group.accentRgb } as React.CSSProperties } : {})}
          >
            {group.label && (
              <div className="ats__sectionLabel">{group.label}</div>
            )}
            {group.items.map((item) => {
              const active = isActive(item.path);
              const isSuperadmin = isSuperadminNavItem(item);
              const Icon = isSuperadmin
                ? SUPERADMIN_ICON_MAP[(item as SuperadminNavItem).iconName]
                : null;

              return (
                <button
                  key={item.path}
                  type="button"
                  className={active ? 'ats__item ats__item--active' : 'ats__item'}
                  onClick={() => handleClick(item.path)}
                  aria-current={active ? 'page' : undefined}
                >
                  {Icon && <Icon size={16} aria-hidden="true" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
