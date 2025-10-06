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
- **Kullanıcı istatistikleri** - Oyun geçmişi, kazanma oranı, sıralamanız
- **Liderlik tablosu** - En iyi oyuncularla yarışın
- **Clerk Authentication** - Güvenli kullanıcı girişi ve yönetimi
- **PostgreSQL veritabanı** - Tüm oyun verilerini kalıcı olarak saklama

## 🛠️ Teknoloji Yığını

### Backend

- **FastAPI** - Yüksek performanslı Python web framework'ü
- **Uvicorn** - ASGI web sunucusu
- **WebSockets** - Gerçek zamanlı çift yönlü iletişim
- **PostgreSQL** - İlişkisel veritabanı
- **SQLAlchemy** - Python SQL toolkit ve ORM
- **Python-dotenv** - Ortam değişkenleri yönetimi

### Frontend

- **React Native** - Expo framework ile cross-platform mobil uygulama
- **TypeScript** - Tip güvenli geliştirme
- **Expo Router** - Dosya tabanlı navigasyon
- **Clerk** - Kullanıcı kimlik doğrulama ve yönetimi
- **NativeWind** - Tailwind CSS ile React Native stillendirme
- **React Native Reanimated** - Performanslı animasyonlar

## 🚀 Başlangıç

### Gereksinimler

- **Node.js** 18+ ve npm
- **Python** 3.9+
- **PostgreSQL** 12+
- **Expo Go** uygulaması (mobil cihazınızda test etmek için)
- **Clerk** hesabı (ücretsiz - https://clerk.com)

### Hızlı Kurulum

Otomatik kurulum için setup script'ini kullanabilirsiniz:

```bash
./setup.sh
```

Bu script:
- ✅ Backend ve frontend bağımlılıklarını yükler
- ✅ Veritabanını yapılandırır
- ✅ Environment variables'ları ayarlar
- ✅ Gerekli tabloları oluşturur

Veya manuel kurulum için aşağıdaki adımları takip edin:

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

4. **PostgreSQL veritabanını kurun**

   **Detaylı kurulum için `lexo-backend/DATABASE_SETUP.md` dosyasına bakın.**

   Hızlı kurulum:

   ```bash
   # PostgreSQL'i yükleyin (macOS)
   brew install postgresql@14
   brew services start postgresql@14

   # Ubuntu/Debian
   # sudo apt install postgresql postgresql-contrib
   # sudo systemctl start postgresql

   # Veritabanını oluşturun
   psql postgres
   CREATE DATABASE lexo_db;
   CREATE USER lexo_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE lexo_db TO lexo_user;
   \q
   ```

5. **Environment variables ayarlayın**

   `.env` dosyası oluşturun:

   ```bash
   touch .env
   ```

   Aşağıdaki içeriği `.env` dosyasına ekleyin:

   ```bash
   DATABASE_URL=postgresql://lexo_user:your_secure_password@localhost:5432/lexo_db
   API_HOST=0.0.0.0
   API_PORT=8000
   LOG_LEVEL=INFO
   ```

6. **Veritabanı tablolarını oluşturun**

   ```bash
   python database.py
   ```

   Bu komut şu tabloları oluşturacak:
   - `users` - Kullanıcı bilgileri
   - `game_history` - Oyun geçmişi
   - `user_stats` - Kullanıcı istatistikleri

7. **Sunucuyu başlatın**

   ```bash
   python main.py
   # veya
   python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   Backend şu adreste çalışacak: `http://localhost:8000`

   API dokümantasyonu: `http://localhost:8000/docs`

### Frontend (Mobile App) Kurulumu

1. **Frontend dizinine gidin**

   ```bash
   cd lexo
   ```

2. **Bağımlılıkları yükleyin**

   ```bash
   npm install
   ```

3. **Clerk Authentication kurulumu**

   - [Clerk Dashboard](https://clerk.com)'a gidin ve bir hesap oluşturun
   - Yeni bir uygulama oluşturun
   - API anahtarlarınızı alın

   `.env` dosyası oluşturun:

   ```bash
   touch .env
   ```

   Aşağıdaki içeriği ekleyin:

   ```env
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   ```

4. **Geliştirme sunucusunu başlatın**

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

5. **Uygulamayı test edin**
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

### Mevcut Endpoints

#### Kullanıcı İşlemleri
- `POST /api/users` - Kullanıcı oluştur/getir
- `GET /api/users/{clerk_id}/stats` - Kullanıcı istatistikleri
- `GET /api/users/{clerk_id}/games` - Kullanıcı oyun geçmişi

#### Oyun İşlemleri
- `POST /api/validate-word` - Kelime doğrulama (tek oyunculu)
- `POST /api/games/save` - Oyun sonucunu kaydet
- `WS /ws/queue` - Çok oyunculu oyun kuyruğu (WebSocket)

#### Liderlik Tablosu
- `GET /api/leaderboard` - Liderlik tablosunu getir

#### Sistem
- `GET /health` - Sunucu sağlık kontrolü
- `GET /stats` - Sunucu istatistikleri

## 📱 Proje Yapısı

```text
Lexo/
├── lexo/                      # React Native (Expo) mobil uygulama
│   ├── app/                  # Expo Router sayfaları
│   │   ├── (auth)/          # Kimlik doğrulama ekranları
│   │   ├── (home)/          # Ana oyun ekranları
│   │   │   ├── index.tsx    # Ana menü
│   │   │   ├── multiplayer.tsx  # Çok oyunculu oyun
│   │   │   └── stats.tsx    # İstatistikler ekranı
│   │   └── _layout.tsx      # Root layout
│   ├── components/           # React bileşenleri
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Yardımcı fonksiyonlar
│   │   ├── api.ts           # API çağrıları
│   │   └── constants.ts     # Sabitler
│   └── constants/            # Sabitler ve tema
└── lexo-backend/             # FastAPI backend sunucusu
    ├── main.py              # Ana uygulama dosyası
    ├── routes.py            # API route'ları
    ├── services.py          # İş mantığı servisleri
    ├── models.py            # WebSocket veri modelleri
    ├── database.py          # SQLAlchemy modelleri
    ├── db_services.py       # Veritabanı CRUD işlemleri
    ├── config.py            # Konfigürasyon
    ├── utils.py             # Yardımcı fonksiyonlar
    ├── requirements.txt     # Python bağımlılıkları
    └── DATABASE_SETUP.md    # Veritabanı kurulum kılavuzu
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
