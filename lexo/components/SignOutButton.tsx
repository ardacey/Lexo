import { useAuth } from '../context/AuthContext'
import { useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View, StyleSheet, Alert } from 'react-native'

export const SignOutButton = () => {
  const { signOut } = useAuth()
  const router = useRouter()
  
  const handleSignOut = async () => {
    try {
      await signOut()
      router.replace('/(auth)/sign-in')
    } catch (error) {
      Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu: ' + (error as Error).message)
    }
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabı Sil',
          style: 'destructive',
          onPress: () => router.push({ pathname: '/delete-account' })
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        onPress={handleSignOut}
        activeOpacity={0.8}
        style={[styles.button, styles.signOutButton]}
      >
        <View style={styles.content}>
          <Text style={styles.icon}>🚪</Text>
          <Text style={styles.text}>Çıkış Yap</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={handleDeleteAccount}
        activeOpacity={0.8}
        style={[styles.button, styles.deleteButton]}
      >
        <View style={styles.content}>
          <Text style={styles.icon}>🗑️</Text>
          <Text style={styles.text}>Hesabı Sil</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    flex: 1,
  },
  signOutButton: {
    borderColor: '#fecaca',
  },
  deleteButton: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  content: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutContent: {
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