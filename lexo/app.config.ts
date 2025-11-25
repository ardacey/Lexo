import type { ConfigContext, ExpoConfig } from '@expo/config';
import appJson from './app.json';

const base = appJson.expo as ExpoConfig;

const ensureInt = (value: string | number | undefined, fallback: number) => {
  if (typeof value === 'number') return value;
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development';
  const version = process.env.APP_VERSION ?? base.version ?? '1.0.0';
  const androidVersionCode = ensureInt(process.env.ANDROID_VERSION_CODE, base.android?.versionCode ?? 1);
  const iosBuildNumber = process.env.IOS_BUILD_NUMBER ?? version;
  const androidBase = base.android ?? {};
  const iosBase = base.ios ?? {};
  const webBase = base.web ?? {};
  const pluginsBase = (base.plugins ?? []) as ExpoConfig['plugins'];

  const extra = {
    ...(base.extra ?? {}),
    environment,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? base.extra?.apiUrl,
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? base.extra?.wsUrl,
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? base.extra?.clerkPublishableKey,
  } as Record<string, unknown>;

  // Only include eas.projectId when it's explicitly set (avoid bundling a placeholder ID)
  const easProjectId = process.env.EAS_PROJECT_ID ?? (base.extra as any)?.eas?.projectId;
  if (easProjectId) {
    extra.eas = { projectId: easProjectId } as unknown;
  }
  

  const updatesUrl = process.env.EXPO_UPDATES_URL ?? base.updates?.url;

  return {
    ...config,
    ...base,
    name: base.name ?? 'Lexo',
    slug: base.slug ?? 'lexo',
    version,
    orientation: (base.orientation as ExpoConfig['orientation']) ?? 'portrait',
    icon: base.icon ?? './assets/images/icon.png',
    scheme: base.scheme ?? 'lexo',
    userInterfaceStyle: (base.userInterfaceStyle as ExpoConfig['userInterfaceStyle']) ?? 'automatic',
    newArchEnabled: true,
    ios: {
      ...iosBase,
      supportsTablet: iosBase.supportsTablet ?? true,
      bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER ?? (iosBase as any)?.bundleIdentifier ?? 'com.ardacey.lexo',
      buildNumber: iosBuildNumber,
    },
    android: {
      ...androidBase,
      package: process.env.ANDROID_PACKAGE ?? androidBase.package ?? 'com.ardacey.lexo',
      versionCode: androidVersionCode,
      permissions: ['INTERNET', 'VIBRATE', 'WAKE_LOCK'],
      allowBackup: false,
    },
    web: webBase as ExpoConfig['web'],
    plugins: [
      ...(pluginsBase ?? []),
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            minSdkVersion: 24,
          },
          ios: {
            deploymentTarget: '15.1',
          },
        },
      ],
  ] as ExpoConfig['plugins'],
    updates: updatesUrl
      ? {
          url: updatesUrl,
          fallbackToCacheTimeout: 0,
        }
      : base.updates,
    runtimeVersion: {
      policy: 'sdkVersion',
    },
    extra,
    experiments: base.experiments ?? {
      typedRoutes: true,
      reactCompiler: true,
    },
  };
};
