import { useState, useRef, useEffect, useMemo } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  BookOpen, Book, GraduationCap, Pencil, PenTool, Calculator,
  FlaskConical, Atom, Microscope, Dna, Globe, Map, Languages,
  Music, Palette, Drama, Dumbbell, Code, Cpu, Binary, Ruler, Pi, Sigma,
  Star, Heart, Zap, Flame, Sun, Moon, Cloud, Leaf, TreePine, Flower2,
  Mountain, Trophy, Award, Target, Lightbulb, Puzzle, Shapes, Rocket,
  Calendar, Clock, Folder, FileText, ClipboardList, ListChecks,
  LayoutGrid, Tag, Bookmark, Archive, Inbox, Search, Settings,
  Mail, MessageSquare, MessageCircle, Megaphone, Bell, Phone, Video, Share2,
  User, Users, School, Building, Home, HandHelping, Accessibility,
  CheckCircle, CircleAlert, Info, Shield, Lock, Unlock, Eye, EyeOff,
  ThumbsUp, ThumbsDown,
  Image, Camera, Film, Headphones, Monitor, Smartphone, Printer, Wifi,
  Download, Upload, Link, ExternalLink,
} from 'lucide-react';
import { ICON_REGISTRY, ICON_CATEGORIES, ICON_MAP } from '../icon-registry';
import './IconPicker.css';

/* ── Static icon map (tree-shakeable – only curated icons) ────────── */

const ICON_COMPONENTS: Record<string, React.ComponentType<LucideProps>> = {
  'book-open': BookOpen, 'book': Book, 'graduation-cap': GraduationCap,
  'pencil': Pencil, 'pen-tool': PenTool, 'calculator': Calculator,
  'flask-conical': FlaskConical, 'atom': Atom, 'microscope': Microscope,
  'dna': Dna, 'globe': Globe, 'map': Map, 'languages': Languages,
  'music': Music, 'palette': Palette, 'drama': Drama, 'dumbbell': Dumbbell,
  'code': Code, 'cpu': Cpu, 'binary': Binary, 'ruler': Ruler, 'pi': Pi, 'sigma': Sigma,
  'star': Star, 'heart': Heart, 'zap': Zap, 'flame': Flame,
  'sun': Sun, 'moon': Moon, 'cloud': Cloud, 'leaf': Leaf,
  'tree-pine': TreePine, 'flower-2': Flower2, 'mountain': Mountain,
  'trophy': Trophy, 'award': Award, 'target': Target, 'lightbulb': Lightbulb,
  'puzzle': Puzzle, 'shapes': Shapes, 'rocket': Rocket,
  'calendar': Calendar, 'clock': Clock, 'folder': Folder, 'file-text': FileText,
  'clipboard-list': ClipboardList, 'list-checks': ListChecks,
  'layout-grid': LayoutGrid, 'tag': Tag, 'bookmark': Bookmark,
  'archive': Archive, 'inbox': Inbox, 'search': Search, 'settings': Settings,
  'mail': Mail, 'message-square': MessageSquare, 'message-circle': MessageCircle,
  'megaphone': Megaphone, 'bell': Bell, 'phone': Phone, 'video': Video, 'share-2': Share2,
  'user': User, 'users': Users, 'school': School, 'building': Building,
  'home': Home, 'hand-helping': HandHelping, 'accessibility': Accessibility,
  'check-circle': CheckCircle, 'circle-alert': CircleAlert, 'info': Info,
  'shield': Shield, 'lock': Lock, 'unlock': Unlock, 'eye': Eye, 'eye-off': EyeOff,
  'thumbs-up': ThumbsUp, 'thumbs-down': ThumbsDown,
  'image': Image, 'camera': Camera, 'film': Film, 'headphones': Headphones,
  'monitor': Monitor, 'smartphone': Smartphone, 'printer': Printer, 'wifi': Wifi,
  'download': Download, 'upload': Upload, 'link': Link, 'external-link': ExternalLink,
};

/* ── DynamicIcon: render a lucide icon by kebab-case name ─────────── */

interface DynamicIconProps extends LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComp = ICON_COMPONENTS[name];
  if (!IconComp) return null;
  return <IconComp {...props} />;
}

/* ── IconPicker Component ─────────────────────────────────────────── */

interface IconPickerProps {
  value?: string | null;
  onChange?: (iconName: string | null) => void;
  disabled?: boolean;
}

export function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
      setActiveCategory(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ICON_REGISTRY.filter((entry) => {
      if (activeCategory && entry.category !== activeCategory) return false;
      if (!q) return true;
      return entry.name.includes(q) || entry.label.toLowerCase().includes(q);
    });
  }, [search, activeCategory]);

  const handleSelect = (name: string) => {
    onChange?.(name);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(null);
  };

  const selectedEntry = value ? ICON_MAP.get(value) : null;

  return (
    <div className="icon-picker" ref={containerRef}>
      <button
        type="button"
        className={`icon-picker__trigger${value ? ' icon-picker__trigger--has-value' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        {value ? (
          <>
            <DynamicIcon name={value} size={18} />
            <span className="icon-picker__trigger-label">
              {selectedEntry?.label || value}
            </span>
            <button
              type="button"
              className="icon-picker__clear"
              onClick={handleClear}
              aria-label="Icon entfernen"
            >
              &times;
            </button>
          </>
        ) : (
          <span className="icon-picker__trigger-placeholder">Icon wählen...</span>
        )}
      </button>

      {open && (
        <div className="icon-picker__dropdown">
          <div className="icon-picker__search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="icon-picker__search"
              placeholder="Icon suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="icon-picker__categories">
            <button
              type="button"
              className={`icon-picker__cat-btn${!activeCategory ? ' icon-picker__cat-btn--active' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              Alle
            </button>
            {ICON_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`icon-picker__cat-btn${activeCategory === cat ? ' icon-picker__cat-btn--active' : ''}`}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="icon-picker__empty">Kein Icon gefunden</div>
          ) : (
            <div className="icon-picker__grid">
              {filtered.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={`icon-picker__icon-btn${value === entry.name ? ' icon-picker__icon-btn--selected' : ''}`}
                  title={entry.label}
                  onClick={() => handleSelect(entry.name)}
                >
                  <DynamicIcon name={entry.name} size={20} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
