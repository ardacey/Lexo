import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import React from 'react'

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoading } = useAuth()

  // Show nothing while loading
  if (isLoading) {
    return null
  }

  if (isSignedIn) {
    return <Redirect href={'/'} />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}