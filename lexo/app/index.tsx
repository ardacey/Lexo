import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import React, { useEffect } from 'react';

export default function Index() {
  const { isSignedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      // Small delay to ensure navigation is ready
      const timer = setTimeout(() => {
        if (isSignedIn) {
          router.replace('/(home)');
        } else {
          router.replace('/(auth)/sign-in');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isSignedIn, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
      <ActivityIndicator size="large" color="#667eea" />
    </View>
  );
}
