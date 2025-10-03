# Lexo

Gerçek zamanlı çok oyunculu kelime oyunu. FastAPI ve React Native (Expo) ile geliştirildi. Arkadaşlarınızla klasik 1v1 maçlarında yarışın!

## 🎮 Oyun Modu

### Klasik Mod
- **1v1 çok oyunculu**: Tek bir rakiple karşı karşıya
- **60 saniyelik turlar**: Hızlı tempolu kelime savaşları
- **16 harf**: Adil rekabet için paylaşılan harf havuzu
- **Gerçek zamanlı puanlama**: Rakibinizin kelimelerini anlık görün

## ✨ Özellikler

- **Gerçek zamanlı çok oyunculu** oyun modu ile WebSocket bağlantıları
- **Türkçe kelime doğrulama** kapsamlı sözlük ile
- **Harf tabanlı puanlama sistemi** dengeli harf sıklığı ile
- **Responsive tasarım** tüm cihazlar için optimize edilmiş

## 🛠️ Teknoloji Yığını

### Backend
- **FastAPI** - Yüksek performanslı Python web framework'ü
- **Uvicorn** - ASGI web sunucusu
- **WebSockets** - Gerçek zamanlı çift yönlü iletişim
- **Python-dotenv** - Ortam değişkenleri yönetimi

### Frontend
- **React Native** - Expo framework ile cross-platform mobil uygulama
- **TypeScript** - Tip güvenli geliştirme
- **Expo Router** - Dosya tabanlı navigasyon
- **NativeWind** - Tailwind CSS ile React Native stillendirme
- **React Native Reanimated** - Performanslı animasyonlar

## 🚀 Başlangıç

### Gereksinimler

- **Node.js** 18+ ve npm
- **Python** 3.9+
- **Expo Go** uygulaması (mobil cihazınızda test etmek için)

### Backend Kurulumu

1. **Backend dizinine gidin**
   ```bash
   cd lexo-backend
   ```

2. **Sanal ortam oluşturun**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Windows'ta: venv\Scripts\activate
   ```

3. **Bağımlılıkları yükleyin**
   ```bash
   pip install -r requirements.txt
   ```

4. **Sunucuyu başlatın**
   ```bash
   python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   Backend şu adreste çalışacak: `http://localhost:8000`

### Frontend (Mobile App) Kurulumu

1. **Frontend dizinine gidin**
   ```bash
   cd lexo
   ```

2. **Bağımlılıkları yükleyin**
   ```bash
   npm install
   ```

3. **Geliştirme sunucusunu başlatın**

   **Sadece mobil uygulama:**
   ```bash
   npm start
   ```

   **Mobil uygulama + Backend birlikte:**
   ```bash
   npm run dev
   ```

   **iOS Simulator:**
   ```bash
   npm run dev:ios
   ```

4. **Uygulamayı test edin**
   - Mobil cihazınızda **Expo Go** uygulamasını açın
   - QR kodu tarayın
   - Veya iOS Simulator / Android Emulator kullanın

## 🎯 Nasıl Oynanır

### Klasik Mod

1. **Odaya katıl** veya yeni bir oda oluştur
2. **Rakip bekle** - birinin odaya katılmasını bekle
3. **Kelime oluştur** - paylaşılan harf havuzunu kullanarak
4. **Puan kazan** - harf değerlerine göre
5. **Kazan** - süre bittiğinde en yüksek puana sahip ol

### Puanlama Sistemi

- Her harfin sıklığına göre bir puan değeri var
- Uzun kelimeler = daha yüksek puanlar
- Yaygın harfler = daha az puan
- Nadir harfler = daha fazla puan

## 🔧 Geliştirme

### Backend Komutları

```bash
# Sunucuyu başlat (geliştirme)
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Kodu düzenle
# Backend dosyaları lexo-backend/ dizininde
```

### Frontend Komutları

```bash
# Expo sunucusunu başlat
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android

# Hem backend hem frontend'i birlikte başlat
npm run dev

# iOS ile birlikte backend
npm run dev:ios

# Kodu kontrol et
npm run lint
```

## 📝 API Dokümantasyonu

Backend çalışırken şu adresleri ziyaret edebilirsiniz:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 📱 Proje Yapısı

```text
Lexo/
├── lexo/                   # React Native (Expo) mobil uygulama
│   ├── app/               # Expo Router sayfaları
│   ├── components/        # React bileşenleri
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Yardımcı fonksiyonlar
│   └── constants/         # Sabitler ve tema
└── lexo-backend/          # FastAPI backend sunucusu
    ├── main.py           # Ana uygulama dosyası
    ├── routes.py         # API route'ları
    ├── services.py       # İş mantığı servisleri
    ├── models.py         # Veri modelleri
    └── utils.py          # Yardımcı fonksiyonlar
```

## 🤝 Katkıda Bulunma

1. **Repository'yi fork edin**
2. **Feature branch oluşturun**: `git checkout -b feature/harika-ozellik`
3. **Değişikliklerinizi commit edin**: `git commit -m 'Harika özellik eklendi'`
4. **Branch'inizi push edin**: `git push origin feature/harika-ozellik`
5. **Pull Request açın**

## 📄 Lisans

Bu proje MIT Lisansı altında lisanslanmıştır - detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🏆 Teşekkürler

- Türkçe kelime listesi [factoreminv/turkish-words](https://github.com/factoreminv/turkish-words) kaynağından alınmıştır
- Harf sıklığı analizi Türkçe dil istatistiklerine dayanmaktadır

Destek veya sorularınız için GitHub'da issue açabilir veya [ac.ardaceylan@gmail.com](mailto:ac.ardaceylan@gmail.com) adresinden iletişime geçebilirsiniz.
