import { useClerk } from '@clerk/clerk-expo'
import * as Linking from 'expo-linking'
import React from 'react'
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native'

export const SignOutButton = () => {
  const { signOut } = useClerk()
  const handleSignOut = async () => {
    try {
      await signOut()
      Linking.openURL(Linking.createURL('/'))
    } catch {
      // Silent sign out error
    }
  }
  return (
    <TouchableOpacity 
      onPress={handleSignOut}
      activeOpacity={0.8}
      style={styles.button}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🚪</Text>
        </View>
        <Text style={styles.text}>Çıkış Yap</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    backgroundColor: '#fee2e2',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  text: {
    color: '#dc2626',
    fontSize: 18,
    fontWeight: '600',
  },
});