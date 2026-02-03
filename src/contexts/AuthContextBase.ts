import { createContext } from 'react';

export type ActiveView = 'admin' | 'teacher';

export interface User {
  username: string;
  fullName?: string;
  role: 'admin' | 'teacher';
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
