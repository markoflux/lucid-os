import Constants from 'expo-constants';

const normalizeBase = (url: string) => url.replace(/\/+$/, '');

export const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return normalizeBase(process.env.EXPO_PUBLIC_API_URL);
  }

  const host =
    // @ts-expect-error expoConfig is available at runtime
    Constants.expoConfig?.hostUri ??
    // Fallback for classic manifests
    // @ts-expect-error manifest is available at runtime
    Constants.manifest?.hostUri ??
    // Newer manifest shape when using Expo Go
    Constants.manifest2?.extra?.expoGo?.manifest?.hostUri;

  if (host) {
    return host.startsWith('http') ? normalizeBase(host) : `http://${normalizeBase(host)}`;
  }

  return 'http://localhost:8081';
};

export const buildApiUrl = (path: string) => {
  const base = getApiBaseUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};
