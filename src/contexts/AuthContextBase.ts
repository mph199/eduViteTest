import { createContext } from 'react';

export type ActiveView = 'admin' | 'teacher' | 'beratungslehrer';

export interface User {
  username: string;
  fullName?: string;
  role: 'admin' | 'teacher' | 'superadmin' | 'ssw';
  modules?: string[];
  teacherId?: number; // Nur für Lehrer
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  activeView: ActiveView | null;
  setActiveView: (view: ActiveView) => void;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
