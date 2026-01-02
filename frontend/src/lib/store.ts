import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CustomThemeSettings, DEFAULT_CUSTOM_SETTINGS } from './themes';

interface User {
  id: number;
  email: string;
  username: string;
  is_admin: boolean;
  totp_enabled: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null, isAuthenticated: false });
      },
      updateUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

interface UIState {
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  editingApp: number | null;
  setEditingApp: (id: number | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedCategory: null,
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  editingApp: null,
  setEditingApp: (id) => set({ editingApp: id }),
}));

// Kiosk mode store
interface KioskState {
  isKioskMode: boolean;
  kioskAutoRotate: boolean;
  kioskRotationInterval: number; // seconds
  kioskShowClock: boolean;
  kioskTabOrder: string[]; // tab slugs to rotate through
  setKioskMode: (enabled: boolean) => void;
  setKioskAutoRotate: (enabled: boolean) => void;
  setKioskRotationInterval: (seconds: number) => void;
  setKioskShowClock: (show: boolean) => void;
  setKioskTabOrder: (tabs: string[]) => void;
  toggleKioskMode: () => void;
}

export const useKioskStore = create<KioskState>()(
  persist(
    (set) => ({
      isKioskMode: false,
      kioskAutoRotate: true,
      kioskRotationInterval: 30, // 30 seconds default
      kioskShowClock: true,
      kioskTabOrder: [],
      setKioskMode: (enabled) => set({ isKioskMode: enabled }),
      setKioskAutoRotate: (enabled) => set({ kioskAutoRotate: enabled }),
      setKioskRotationInterval: (seconds) => set({ kioskRotationInterval: seconds }),
      setKioskShowClock: (show) => set({ kioskShowClock: show }),
      setKioskTabOrder: (tabs) => set({ kioskTabOrder: tabs }),
      toggleKioskMode: () => set((state) => ({ isKioskMode: !state.isKioskMode })),
    }),
    {
      name: 'kiosk-storage',
    }
  )
);

// Theme store
interface ThemeState {
  activeThemeId: string;
  customSettings: CustomThemeSettings;
  setActiveTheme: (themeId: string) => void;
  updateCustomSettings: (settings: Partial<CustomThemeSettings>) => void;
  resetCustomSettings: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      activeThemeId: 'dark-default',
      customSettings: DEFAULT_CUSTOM_SETTINGS,
      setActiveTheme: (themeId) => set({ activeThemeId: themeId }),
      updateCustomSettings: (settings) =>
        set((state) => ({
          customSettings: { ...state.customSettings, ...settings },
        })),
      resetCustomSettings: () => set({ customSettings: DEFAULT_CUSTOM_SETTINGS }),
    }),
    {
      name: 'theme-storage',
    }
  )
);
