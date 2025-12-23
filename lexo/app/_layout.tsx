import "../global.css";
import { Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { Alert, Linking, Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { ToastProvider, useToast } from '../context/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { getErrorMessage } from '../utils/errorMessages';
import { getAppVersionInfo } from '../utils/api';

const getCurrentVersion = () => {
  return (
    Constants.expoConfig?.version ||
    (Constants as any).manifest?.version ||
    '0.0.0'
  );
};

const parseVersion = (value: string) => {
  return value.split('.').map(part => Number.parseInt(part, 10) || 0);
};

const isVersionLess = (current: string, minimum: string) => {
  const currentParts = parseVersion(current);
  const minimumParts = parseVersion(minimum);
  const maxLength = Math.max(currentParts.length, minimumParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const currentValue = currentParts[i] ?? 0;
    const minimumValue = minimumParts[i] ?? 0;
    if (currentValue < minimumValue) return true;
    if (currentValue > minimumValue) return false;
  }
  return false;
};

const getStoreUrl = (remoteUrl?: string) => {
  if (remoteUrl) return remoteUrl;
  if (Platform.OS === 'android') {
    const packageName =
      Constants.expoConfig?.android?.package ||
      (Constants as any).manifest?.android?.package;
    if (packageName) {
      return `https://play.google.com/store/apps/details?id=${packageName}`;
    }
  }
  return null;
};

function AppContent() {
  const { showToast } = useToast();
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  const [updateChecked, setUpdateChecked] = useState(false);
  const updateAlertShownRef = useRef(false);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 5 dakika boyunca veriler taze kabul edilir
        staleTime: 1000 * 60 * 5,
        // 10 dakika boyunca cache'te tutulur
        gcTime: 1000 * 60 * 10,
        // Hata durumunda 1 kez tekrar dene
        retry: 1,
        // Pencere focus olduğunda otomatik refetch yapma
        refetchOnWindowFocus: false,
        // Network yeniden bağlandığında otomatik refetch
        refetchOnReconnect: true,
        // Mount olduğunda eski veriler için refetch
        refetchOnMount: true,
      },
      mutations: {
        // Mutation'lar için hata durumunda retry yapma
        retry: 0,
      },
    },
    queryCache: new QueryCache({
      onError: (error: Error) => {
        showToast(getErrorMessage(error), 'error');
      },
    }),
    mutationCache: new MutationCache({
      onError: (error: Error, _variables, _context, mutation) => {
        // skipGlobalErrorHandler meta flag'i varsa toast gösterme
        if (mutation.meta?.skipGlobalErrorHandler) {
          return;
        }
        showToast(getErrorMessage(error), 'error');
      },
    }),
  }));

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setUpdateChecked(true);
      return;
    }

    let cancelled = false;
    const checkUpdate = async () => {
      const info = await getAppVersionInfo();
      if (cancelled || !info) {
        setUpdateChecked(true);
        return;
      }

      const currentVersion = getCurrentVersion();
      const needsUpdate = info.force_update && isVersionLess(currentVersion, info.min_version);
      if (needsUpdate) {
        const storeUrl = getStoreUrl(info.update_url);
        setUpdateUrl(storeUrl);
        setUpdateRequired(true);
      }
      setUpdateChecked(true);
    };

    checkUpdate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!updateRequired || updateAlertShownRef.current) return;
    updateAlertShownRef.current = true;
    Alert.alert(
      'Güncelleme Gerekli',
      'Devam etmek için uygulamayı güncelleyin.',
      [
        {
          text: 'Güncelle',
          onPress: () => {
            if (updateUrl) {
              Linking.openURL(updateUrl);
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, [updateRequired, updateUrl]);

  if (!updateChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Güncelleme kontrol ediliyor...</Text>
      </View>
    );
  }

  if (updateRequired) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Güncelleme Gerekli</Text>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>
          Bu sürüm artık desteklenmiyor. Devam etmek için güncelleyin.
        </Text>
        {updateUrl ? (
          <Text
            style={{ color: '#2563eb', fontWeight: '600' }}
            onPress={() => {
              Linking.openURL(updateUrl);
            }}
          >
            Play Store'da Güncelle
          </Text>
        ) : (
          <Text style={{ color: '#64748b' }}>Güncelleme bağlantısı bulunamadı.</Text>
        )}
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(home)" />
        </Stack>
      </AuthProvider>
      {/* Development modunda React Query Devtools - sadece web için */}
      {__DEV__ && Platform.OS === 'web' && (
        React.createElement(
          require('@tanstack/react-query-devtools').ReactQueryDevtools,
          { initialIsOpen: false }
        )
      )}
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}
