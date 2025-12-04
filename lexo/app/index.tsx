import { useRouter, useRootNavigationState } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import React, { useEffect, useRef } from 'react';

export default function Index() {
  const { isSignedIn, isLoading } = useAuth();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Wait for both auth loading to complete and navigation to be ready
    if (!isLoading && rootNavigationState?.key && !hasNavigated.current) {
      hasNavigated.current = true;
      // Small delay to ensure navigation is fully ready
      const timer = setTimeout(() => {
        try {
          if (isSignedIn) {
            router.replace('/(home)');
          } else {
            router.replace('/(auth)/sign-in');
          }
        } catch (error) {
          // Navigation not ready yet, reset flag to try again
          hasNavigated.current = false;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isSignedIn, rootNavigationState?.key]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
      <ActivityIndicator size="large" color="#667eea" />
    </View>
  );
}
