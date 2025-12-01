import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import React from 'react'
import { View, ActivityIndicator } from 'react-native'

export default function Layout() {
  const { isSignedIn, isLoading } = useAuth()

  // Show loading indicator while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    )
  }

  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    return <Redirect href="/sign-in" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}