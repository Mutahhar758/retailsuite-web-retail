import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OrganizationLicense {
  licenseKey: string;
  tenantIdentifier: string;
  name: string;
}

interface AppState {
  theme: 'light' | 'dark';
  layout: 'vertical' | 'horizontal';
  licenses: OrganizationLicense[];
  currentTenantIdentifier: string | null;
  setTheme: (theme: 'light' | 'dark') => void;
  setLayout: (layout: 'vertical' | 'horizontal') => void;
  addLicense: (license: OrganizationLicense) => void;
  setCurrentTenant: (tenantId: string) => void;
  removeLicense: (licenseKey: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      layout: 'vertical',
      licenses: [],
      currentTenantIdentifier: null,
      
      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      addLicense: (license) => set((state) => {
        const exists = state.licenses.some(l => l.licenseKey === license.licenseKey);
        if (exists) return state;
        
        return { 
          licenses: [...state.licenses, license],
          // If this is the first license, set it as current automatically
          currentTenantIdentifier: state.licenses.length === 0 ? license.tenantIdentifier : state.currentTenantIdentifier
        };
      }),
      setCurrentTenant: (tenantId) => set({ currentTenantIdentifier: tenantId }),
      removeLicense: (licenseKey) => set((state) => ({
        licenses: state.licenses.filter(l => l.licenseKey !== licenseKey),
        currentTenantIdentifier: state.currentTenantIdentifier && state.licenses.find(l => l.licenseKey === licenseKey)?.tenantIdentifier === state.currentTenantIdentifier 
          ? (state.licenses.find(l => l.licenseKey !== licenseKey)?.tenantIdentifier || null) 
          : state.currentTenantIdentifier
      })),
    }),
    {
      name: 'retail-app-storage',
    }
  )
);
