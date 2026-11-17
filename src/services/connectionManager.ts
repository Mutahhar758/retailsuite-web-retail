import { useAppStore, type ConnectionTarget } from '../stores/useAppStore';

export const normalizeBaseUrl = (url: string): string => url.trim().replace(/\/+$/, '');

export const isCurrentTenantOnPremises = (): boolean => {
  const { licenses, currentTenantIdentifier } = useAppStore.getState();
  if (!currentTenantIdentifier) {
    return false;
  }
  const current = licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier);
  return Boolean(current?.isOnPremises);
};

export const getActiveBaseUrl = (): string => {
  const { connectionMode, activeTarget, localServerUrl, cloudServerUrl } = useAppStore.getState();

  if (!isCurrentTenantOnPremises()) {
    return normalizeBaseUrl(cloudServerUrl);
  }

  if (connectionMode === 'local') {
    return normalizeBaseUrl(localServerUrl);
  }
  if (connectionMode === 'cloud') {
    return normalizeBaseUrl(cloudServerUrl);
  }
  return activeTarget === 'local'
    ? normalizeBaseUrl(localServerUrl)
    : normalizeBaseUrl(cloudServerUrl);
};

export const probeLocalServer = async (localUrl?: string, timeoutMs = 1500): Promise<boolean> => {
  const targetUrl = normalizeBaseUrl(localUrl ?? useAppStore.getState().localServerUrl);
  if (!targetUrl) {
    return false;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${targetUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
};

export const resolveConnectionTarget = async (): Promise<ConnectionTarget> => {
  const { connectionMode, localServerUrl, setActiveTarget } = useAppStore.getState();

  if (!isCurrentTenantOnPremises()) {
    setActiveTarget('cloud');
    return 'cloud';
  }

  if (connectionMode === 'local') {
    setActiveTarget('local');
    return 'local';
  }
  if (connectionMode === 'cloud') {
    setActiveTarget('cloud');
    return 'cloud';
  }

  const localReachable = await probeLocalServer(localServerUrl);
  const resolved: ConnectionTarget = localReachable ? 'local' : 'cloud';
  setActiveTarget(resolved);
  return resolved;
};
