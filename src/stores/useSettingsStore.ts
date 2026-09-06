import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingService, type SettingItem } from '../services/settingService';

interface SettingsState {
  settings: Record<string, string>;
  items: SettingItem[];
  loading: boolean;
  initialized: boolean;
  fetchSettings: (category?: string) => Promise<void>;
  getSetting: (key: string, fallback?: string) => string;
  updateSetting: (key: string, value: string, description?: string, category?: string) => Promise<void>;
}

export const BILL_THANK_YOU_KEY = 'Bill.ThankYouMessage';
export const BILL_THANK_YOU_DEFAULT = 'Thank you for shopping with us!';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: {
        [BILL_THANK_YOU_KEY]: BILL_THANK_YOU_DEFAULT,
      },
      items: [],
      loading: false,
      initialized: false,

      fetchSettings: async (category?: string) => {
        set({ loading: true });
        try {
          const list = await settingService.getSettings(category);
          const map: Record<string, string> = { ...get().settings };
          
          list.forEach(item => {
            if (item.key && item.value !== undefined && item.value !== null) {
              map[item.key] = item.value;
            }
          });

          // Ensure default if missing
          if (!map[BILL_THANK_YOU_KEY]) {
            map[BILL_THANK_YOU_KEY] = BILL_THANK_YOU_DEFAULT;
          }

          set({ settings: map, items: list, loading: false, initialized: true });
        } catch (error) {
          console.error('Failed to load settings from server', error);
          set({ loading: false });
        }
      },

      getSetting: (key: string, fallback: string = ''): string => {
        const val = get().settings[key];
        if (val !== undefined && val !== null && val !== '') {
          return val;
        }
        if (key === BILL_THANK_YOU_KEY) {
          return BILL_THANK_YOU_DEFAULT;
        }
        return fallback;
      },

      updateSetting: async (key: string, value: string, description?: string, category?: string) => {
        // Optimistic update
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        }));

        try {
          const saved = await settingService.saveSetting({ key, value, description, category });
          // Update in items array
          set((state) => {
            const index = state.items.findIndex(i => i.key === key);
            const nextItems = [...state.items];
            if (index >= 0) {
              nextItems[index] = saved;
            } else {
              nextItems.push(saved);
            }
            return {
              items: nextItems,
              settings: {
                ...state.settings,
                [key]: saved.value ?? value,
              },
            };
          });
        } catch (error) {
          console.error(`Failed to save setting ${key}`, error);
          throw error;
        }
      },
    }),
    {
      name: 'retail_app_settings',
    }
  )
);
