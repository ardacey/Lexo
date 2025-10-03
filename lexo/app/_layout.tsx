import "../global.css";
import { Stack } from 'expo-router';
import React from 'react';
import { NavigationContainer } from "@react-navigation/native";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="game" />
      <Stack.Screen name="multiplayer" />
    </Stack>
  );
}
