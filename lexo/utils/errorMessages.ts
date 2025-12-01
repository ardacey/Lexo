export const getErrorMessage = (error: any): string => {
  if (!error) return 'Bilinmeyen bir hata oluştu.';

  // Supabase Auth Hataları
  if (error.message || error.error_description || error.code) {
    const code = error.code || error.error;
    const message = error.message || error.error_description;

    switch (code) {
      case 'invalid_credentials':
      case 'invalid_grant':
        return 'E-posta veya şifre hatalı.';
      case 'email_not_confirmed':
        return 'Lütfen e-posta adresinizi doğrulayın.';
      case 'user_not_found':
        return 'Bu kullanıcı bulunamadı.';
      case 'user_already_exists':
      case 'email_exists':
        return 'Bu e-posta adresi zaten kayıtlı.';
      case 'weak_password':
        return 'Şifreniz çok zayıf. Lütfen daha güçlü bir şifre seçin.';
      case 'invalid_email':
        return 'Geçersiz e-posta adresi.';
      case 'signup_disabled':
        return 'Kayıt işlemi şu anda devre dışı.';
      case 'over_request_rate_limit':
        return 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.';
      case 'otp_expired':
        return 'Doğrulama kodunun süresi dolmuş. Lütfen yeni bir kod isteyin.';
      case 'otp_disabled':
        return 'OTP doğrulaması devre dışı.';
      case 'session_not_found':
        return 'Oturum bulunamadı. Lütfen tekrar giriş yapın.';
      case 'refresh_token_not_found':
      case 'refresh_token_already_used':
        return 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.';
      default:
        // Eğer özel bir çeviri yoksa ve mesaj varsa onu kontrol et
        if (message) {
          if (message.includes('Invalid login credentials')) {
            return 'E-posta veya şifre hatalı.';
          }
          if (message.includes('Email not confirmed')) {
            return 'Lütfen e-posta adresinizi doğrulayın.';
          }
          if (message.includes('Password should be')) {
            return 'Şifreniz en az 6 karakter olmalıdır.';
          }
          if (message.includes('already registered')) {
            return 'Bu e-posta adresi zaten kayıtlı.';
          }
        }
        break;
    }
  }

  // Axios/Network hataları
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    // Backend'den gelen özel mesaj varsa onu kullan
    if (data && data.detail) {
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        return data.detail[0].msg || 'Geçersiz veri gönderildi.';
      }
    }
    
    if (data && data.message) return data.message;

    switch (status) {
      case 400:
        return 'İstek geçersiz. Lütfen bilgilerinizi kontrol edin.';
      case 401:
        return 'Oturum süreniz dolmuş veya yetkiniz yok. Lütfen tekrar giriş yapın.';
      case 403:
        return 'Bu işlemi yapmaya yetkiniz bulunmuyor.';
      case 404:
        return 'İstenilen kaynak bulunamadı.';
      case 408:
        return 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
      case 429:
        return 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.';
      case 500:
        return 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.';
      case 502:
        return 'Sunucu yanıt vermiyor (Bad Gateway).';
      case 503:
        return 'Servis şu anda kullanılamıyor.';
      default:
        return `Bir hata oluştu (${status}).`;
    }
  } else if (error.request) {
    // İstek yapıldı ama yanıt alınamadı
    return 'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.';
  }

  // Genel JS hataları
  if (error.message) {
    if (error.message.includes('Network Error')) {
      return 'Ağ hatası. İnternet bağlantınızı kontrol edin.';
    }
    if (error.message.includes('timeout')) {
      return 'İstek zaman aşımına uğradı.';
    }
    // Diğer teknik mesajları kullanıcıya göstermek yerine genel mesaj verilebilir
    // ama geliştirme aşamasında görmek isteyebiliriz.
    // return error.message; 
  }

  return 'Beklenmedik bir hata oluştu.';
};
