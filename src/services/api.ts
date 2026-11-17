import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppStore } from '../stores/useAppStore';
import { getActiveBaseUrl, isCurrentTenantOnPremises, normalizeBaseUrl, probeLocalServer } from './connectionManager';

const api = axios.create({
  baseURL: 'https://localhost:5001/',
  timeout: 30000,
});

// Flag to prevent multiple refresh token calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    const { currentTenantIdentifier, cloudServerUrl } = useAppStore.getState();

    // Cloud-only license verification always goes to the Cloud server
    const isLicenseVerify = config.url?.includes('/license/verify');
    const resolvedBase = isLicenseVerify
      ? normalizeBaseUrl(cloudServerUrl)
      : getActiveBaseUrl();
    config.baseURL = `${resolvedBase}/`;

    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (currentTenantIdentifier && config.headers && !config.headers['X-Tenant-ID']) {
      config.headers['X-Tenant-ID'] = currentTenantIdentifier;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _failoverRetried?: boolean;
    };

    // In Auto mode, transparently fail over between Local POS and Cloud Relay on network errors
    if (
      !error.response &&
      originalRequest &&
      !originalRequest._failoverRetried &&
      !originalRequest.url?.includes('/license/verify') &&
      isCurrentTenantOnPremises()
    ) {
      const { connectionMode, activeTarget, localServerUrl, setActiveTarget } = useAppStore.getState();
      if (connectionMode === 'auto') {
        originalRequest._failoverRetried = true;
        if (activeTarget === 'cloud') {
          const localReachable = await probeLocalServer(localServerUrl);
          if (localReachable) {
            setActiveTarget('local');
            return api(originalRequest);
          }
        } else {
          setActiveTarget('cloud');
          return api(originalRequest);
        }
      }
    }

    if (error.response?.status === 401) {
      // Skip interceptor redirect/suppression for login and refresh requests
      const isAuthRequest = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh');
      if (isAuthRequest) {
        return Promise.reject(error);
      }

      const { refreshToken, logout, setTokens } = useAuthStore.getState();

      // If it's already a retry or we don't have a refresh token, log out immediately and suppress the error
      if (originalRequest._retry || !refreshToken) {
        logout();
        return new Promise(() => {});
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch(() => {
            // When refresh fails and the queue is rejected, return pending promise to suppress error toast
            return new Promise(() => {});
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${getActiveBaseUrl()}/api/auth/refresh`, {
          refreshToken,
        });

        // Adapt to actual API response structure for tokens
        const body = response.data?.body || response.data;
        const newAccessToken = body?.token || body?.accessToken;
        const newRefreshToken = body?.refreshToken;

        setTokens(newAccessToken, newRefreshToken);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        logout();
        return new Promise(() => {});
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
