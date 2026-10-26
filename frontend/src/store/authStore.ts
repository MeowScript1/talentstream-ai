import { create } from 'zustand';
import api from '@/services/api';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'employer' | 'candidate';
  company_name?: string | null;
  avatar_url?: string | null;
}

interface ProfileUpdate {
  full_name?: string;
  company_name?: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  /** Restore the user from the saved token after a page reload. */
  hydrate: () => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
  changePassword: (current_password: string, new_password: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  login: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user, isLoading: false });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
  hydrate: async () => {
    if (!get().token) {
      set({ isLoading: false });
      return;
    }
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data, isLoading: false });
    } catch {
      // Expired or invalid token: start from a clean logged-out state
      localStorage.removeItem('token');
      set({ token: null, user: null, isLoading: false });
    }
  },
  updateProfile: async (data: ProfileUpdate) => {
    const response = await api.patch('/users/me', data);
    set((state) => ({ user: state.user ? { ...state.user, ...response.data } : null }));
  },
  changePassword: async (current_password: string, new_password: string) => {
    await api.post('/users/me/password', { current_password, new_password });
  },
}));
