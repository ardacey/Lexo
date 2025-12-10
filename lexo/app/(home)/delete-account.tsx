import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDeleteUserAccount } from '../../hooks/useApi';

export default function DeleteAccountPage() {
  const { signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const deleteAccountMutation = useDeleteUserAccount();

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Hesabı Sil',
      'Bu işlem geri alınamaz. Hesabınız ve tüm verileriniz kalıcı olarak silinecektir. Devam etmek istiyor musunuz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccountMutation.mutateAsync();
              showToast('Hesabınız başarıyla silindi', 'success');
              await signOut();
              router.replace('/(auth)/sign-in');
            } catch (error) {
              console.error('Delete account error:', error);
              showToast('Hesap silinirken hata oluştu', 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <LinearGradient
        colors={['#f0f9ff', '#e0f2fe', '#fef3c7', '#fce7f3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View className="flex-1 p-6">
          <View className="flex-row items-center mb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="p-2 mr-4"
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-800">Hesabı Sil</Text>
          </View>

          <ScrollView className="flex-1">
            <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
              <View className="flex-row items-center mb-4">
                <Ionicons name="warning" size={24} color="#ef4444" />
                <Text className="text-xl font-semibold text-red-600 ml-2">
                  Dikkat: Bu işlem geri alınamaz
                </Text>
              </View>

              <Text className="text-gray-700 mb-4 leading-6">
                Hesabınızı sildiğinizde aşağıdaki veriler kalıcı olarak silinecektir:
              </Text>

              <View className="mb-4">
                <Text className="text-gray-600 mb-2">• Kullanıcı bilgileriniz (kullanıcı adı, email)</Text>
                <Text className="text-gray-600 mb-2">• Oyun istatistikleriniz</Text>
                <Text className="text-gray-600 mb-2">• Oyun geçmişi ve skorlar</Text>
                <Text className="text-gray-600 mb-2">• Çok oyunculu maçlarınız</Text>
                <Text className="text-gray-600 mb-2">• Leaderboard'daki kayıtlarınız</Text>
              </View>

              <Text className="text-gray-700 mb-4">
                Bu veriler silindikten sonra geri getirilemez.
              </Text>

              <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <Text className="text-yellow-800 font-medium mb-2">
                  Alternatif: Veri Silme
                </Text>
                <Text className="text-yellow-700 text-sm">
                  Hesabınızı tamamen silmek yerine, sadece oyun verilerinizi silmek isterseniz
                  lütfen destek ekibimizle iletişime geçin.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              className={`bg-red-600 py-4 rounded-lg items-center mb-4 ${
                deleteAccountMutation.isPending ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-white font-semibold text-lg">
                {deleteAccountMutation.isPending ? 'Hesap Siliniyor...' : 'Hesabı Sil'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-gray-200 py-4 rounded-lg items-center"
            >
              <Text className="text-gray-700 font-semibold text-lg">
                İptal Et
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}