import "../global.css";
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QueryCache, MutationCache } from '@tanstack/query-core';
import { Platform } from 'react-native';
import { ToastProvider, useToast } from '../context/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { getErrorMessage } from '../utils/errorMessages';

function AppContent() {
  const { showToast } = useToast();

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
      onError: (error: Error) => {
        showToast(getErrorMessage(error), 'error');
      },
    }),
  }));

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

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}
