import "../global.css";
import { Stack, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { ToastProvider, useToast } from '../context/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { getErrorMessage } from '../utils/errorMessages';
import * as Linking from 'expo-linking';
import { supabase } from '../utils/supabase';

function AppContent() {
  const { showToast } = useToast();
  const router = useRouter();

  // Handle deep links for Supabase auth
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      // Parse the URL to extract tokens
      const parsedUrl = Linking.parse(url);
      
      // Check if this is an auth callback
      if (parsedUrl.queryParams) {
        const { access_token, refresh_token, token, type, error, error_description } = parsedUrl.queryParams as {
          access_token?: string;
          refresh_token?: string;
          token?: string;
          type?: string;
          error?: string;
          error_description?: string;
        };

        // Handle error
        if (error) {
          const errorMsg = error_description?.replace(/\+/g, ' ') || 'Doğrulama hatası';
          showToast(errorMsg, 'error');
          return;
        }

        // Handle token-based verification (from email link)
        if (access_token && refresh_token) {
          try {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) {
              showToast(sessionError.message, 'error');
            } else {
              showToast('E-posta doğrulandı!', 'success');
              router.replace('/(home)');
            }
          } catch (err) {
            showToast('Doğrulama sırasında bir hata oluştu', 'error');
          }
        }
      }
    };

    // Handle the initial URL (app opened via deep link)
    const getInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };

    getInitialURL();

    // Listen for incoming links while app is open
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
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
