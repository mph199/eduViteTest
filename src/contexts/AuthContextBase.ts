import { createContext } from 'react';
import type { ActiveView, User } from '../types';

export type { ActiveView, User };

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
