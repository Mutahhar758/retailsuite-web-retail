import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettingsStore } from './useSettingsStore';

export type ConnectionMode = 'auto' | 'local' | 'cloud';
export type ConnectionTarget = 'local' | 'cloud';

export interface OrganizationLicense {
  licenseKey: string;
  tenantIdentifier: string;
  name: string;
  isOnPremises?: boolean;
  hasSupplyFeature?: boolean;
  hasSecondaryQty?: boolean;
  hasKotFeature?: boolean;
  hasVariablePackFeature?: boolean;
  hasMobileShopFeature?: boolean;
}

interface AppState {
  theme: 'light' | 'dark';
  layout: 'vertical' | 'horizontal';
  licenses: OrganizationLicense[];
  currentTenantIdentifier: string | null;
  connectionMode: ConnectionMode;
  localServerUrl: string;
  cloudServerUrl: string;
  activeTarget: ConnectionTarget;
  setTheme: (theme: 'light' | 'dark') => void;
  setLayout: (layout: 'vertical' | 'horizontal') => void;
  addLicense: (license: OrganizationLicense) => void;
  setCurrentTenant: (tenantId: string) => void;
  removeLicense: (licenseKey: string) => void;
  updateLicenseFeatures: (tenantId: string, features: Partial<OrganizationLicense>) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setLocalServerUrl: (url: string) => void;
  setCloudServerUrl: (url: string) => void;
  setActiveTarget: (target: ConnectionTarget) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      layout: 'vertical',
      licenses: [],
      currentTenantIdentifier: null,
      connectionMode: 'auto',
      localServerUrl: 'http://localhost:5050',
      cloudServerUrl: 'https://localhost:5001',
      activeTarget: 'cloud',
      
      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      setConnectionMode: (connectionMode) => set({
        connectionMode,
        activeTarget: connectionMode === 'local' ? 'local' : connectionMode === 'cloud' ? 'cloud' : useAppStore.getState().activeTarget,
      }),
      setLocalServerUrl: (localServerUrl) => set({ localServerUrl }),
      setCloudServerUrl: (cloudServerUrl) => set({ cloudServerUrl }),
      setActiveTarget: (activeTarget) => set({ activeTarget }),
      addLicense: (license) => set((state) => {
        const exists = state.licenses.some(l => l.licenseKey === license.licenseKey);
        if (exists) return state;
        
        return { 
          licenses: [...state.licenses, license],
          // If this is the first license, set it as current automatically
          currentTenantIdentifier: state.licenses.length === 0 ? license.tenantIdentifier : state.currentTenantIdentifier
        };
      }),
      updateLicenseFeatures: (tenantId, features) => set((state) => ({
        licenses: state.licenses.map(l => l.tenantIdentifier === tenantId ? { ...l, ...features } : l)
      })),
      setCurrentTenant: (tenantId) => {
        set({ currentTenantIdentifier: tenantId });
        useSettingsStore.getState().resetSettings();
        useSettingsStore.getState().fetchSettings();
      },
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
