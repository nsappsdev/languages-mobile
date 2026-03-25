import Constants from 'expo-constants';
import { Platform } from 'react-native';

const fallbackBaseUrl = 'http://localhost:4000/api';
const backendPort = '4000';

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, '');
}

function extractExpoHost() {
  const possibleHostUri =
    Constants.expoConfig?.hostUri ??
    ((Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
      (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
        .manifest2?.extra?.expoGo?.debuggerHost);

  if (!possibleHostUri) {
    return null;
  }

  const host = possibleHostUri.split(':')[0];
  return host || null;
}

function replaceLoopbackHost(baseUrl: string, targetHost: string) {
  return baseUrl.replace(
    /(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i,
    `$1${targetHost}`,
  );
}

function resolveApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const expoHost = extractExpoHost();

  if (configured) {
    const normalizedConfigured = normalizeBaseUrl(configured);
    if (Platform.OS !== 'web' && expoHost) {
      return replaceLoopbackHost(normalizedConfigured, expoHost);
    }
    return normalizedConfigured;
  }

  if (Platform.OS !== 'web' && expoHost) {
    return `http://${expoHost}:${backendPort}/api`;
  }

  return normalizeBaseUrl(fallbackBaseUrl);
}

export const API_BASE_URL = resolveApiBaseUrl();

export function resolveApiAssetUrl(pathOrUrl: string) {
  const value = pathOrUrl.trim();
  if (!value) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const apiOrigin = API_BASE_URL.replace(/\/api$/, '');
  return `${apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
}
