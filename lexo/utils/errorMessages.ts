export const getErrorMessage = (error: any): string => {
  if (!error) return 'Bilinmeyen bir hata oluştu.';

  // Clerk Hataları
  if (error.clerkError && error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
    const clerkError = error.errors[0];
    const code = clerkError.code;
    const message = clerkError.message;

    switch (code) {
      case 'form_param_nil':
        if (clerkError.meta?.paramName === 'password') return 'Lütfen şifrenizi girin.';
        if (clerkError.meta?.paramName === 'identifier') return 'Lütfen e-posta adresinizi veya kullanıcı adınızı girin.';
        return 'Lütfen tüm alanları doldurun.';
      case 'form_param_format_invalid':
        if (clerkError.meta?.paramName === 'identifier') return 'Geçersiz e-posta adresi veya kullanıcı adı.';
        if (clerkError.meta?.paramName === 'password') return 'Şifre formatı geçersiz.';
        return 'Girdiğiniz bilgilerden biri geçersiz formatta.';
      case 'form_password_pwned':
        return 'Bu şifre daha önce bir veri ihlalinde görülmüş, lütfen daha güvenli bir şifre seçin.';
      case 'form_password_length_too_short':
        return 'Şifreniz çok kısa. Lütfen daha uzun bir şifre belirleyin.';
      case 'form_identifier_not_found':
        return 'Bu kullanıcı bulunamadı. Lütfen bilgilerinizi kontrol edin.';
      case 'form_password_incorrect':
        return 'Şifre hatalı. Lütfen tekrar deneyin.';
      case 'verification_code_invalid':
        return 'Doğrulama kodu geçersiz. Lütfen tekrar deneyin.';
      case 'verification_code_expired':
        return 'Doğrulama kodunun süresi dolmuş. Lütfen yeni bir kod isteyin.';
      case 'session_exists':
        return 'Zaten giriş yapmış durumdasınız.';
      case 'user_locked':
        return 'Hesabınız kilitlenmiş. Lütfen destek ekibiyle iletişime geçin.';
      default:
        // Eğer özel bir çeviri yoksa ve mesaj varsa onu döndür, yoksa genel hata
        return message || 'Bir kimlik doğrulama hatası oluştu.';
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
