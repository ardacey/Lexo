import "../global.css";
import { Stack } from 'expo-router';
import React from 'react';
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(home)" />
    </Stack>
    </ClerkProvider>
  );
}
