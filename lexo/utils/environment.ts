import Constants from 'expo-constants';

type Extra = {
  environment?: 'development' | 'preview' | 'production' | string;
  apiUrl?: string;
  wsUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type Manifest2 = {
  extra?: {
    expoClient?: { extra?: Record<string, unknown> };
    expoGo?: { extra?: Record<string, unknown> };
  };
};

const resolveExtra = (): Record<string, unknown> => {
  if (Constants?.expoConfig?.extra) {
    return Constants.expoConfig.extra;
  }

  const manifest = (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest;
  if (manifest?.extra) {
    return manifest.extra;
  }

  const manifest2 = (Constants as unknown as { manifest2?: Manifest2 }).manifest2;
  if (manifest2?.extra?.expoClient?.extra) {
    return manifest2.extra.expoClient.extra;
  }
  if (manifest2?.extra?.expoGo?.extra) {
    return manifest2.extra.expoGo.extra;
  }

  return {};
};

const extra = resolveExtra() as Extra;

const sanitizeUrl = (value?: string) => value?.replace(/\/$/, '');

const fallbackEnvironment = process.env.EXPO_PUBLIC_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production');
export const ENVIRONMENT = (extra.environment ?? fallbackEnvironment) as 'development' | 'preview' | 'production';
export const IS_PRODUCTION = ENVIRONMENT === 'production';
export const IS_PREVIEW = ENVIRONMENT === 'preview';

const apiFromExtra = sanitizeUrl(extra.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:8000' : undefined));
if (!apiFromExtra) {
  throw new Error('Missing API URL. Set EXPO_PUBLIC_API_URL or extra.apiUrl.');
}

const derivedWsFromApi = apiFromExtra.startsWith('https')
  ? apiFromExtra.replace('https', 'wss')
  : apiFromExtra.replace('http', 'ws');

const wsFromExtra = sanitizeUrl(extra.wsUrl ?? process.env.EXPO_PUBLIC_WS_URL ?? derivedWsFromApi);
if (!wsFromExtra) {
  throw new Error('Missing WebSocket URL. Set EXPO_PUBLIC_WS_URL or extra.wsUrl.');
}

const supabaseUrl = extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('Missing Supabase URL. Set EXPO_PUBLIC_SUPABASE_URL or extra.supabaseUrl.');
}

const supabaseAnonKey = extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
  throw new Error('Missing Supabase anon key. Set EXPO_PUBLIC_SUPABASE_ANON_KEY or extra.supabaseAnonKey.');
}

export const API_BASE_URL = apiFromExtra;
export const WS_BASE_URL = wsFromExtra;
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
