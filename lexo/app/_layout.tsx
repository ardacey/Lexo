import "../global.css";
import { Stack } from 'expo-router';
import React from 'react';
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';

// QueryClient yapılandırması - optimizasyonlarla
const queryClient = new QueryClient({
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
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider tokenCache={tokenCache}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(home)" />
        </Stack>
      </ClerkProvider>
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
