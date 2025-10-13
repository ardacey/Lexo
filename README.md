# 🎮 Lexo - Gerçek Zamanlı Kelime Oyunu

<div align="center">

[![Backend Tests](https://img.shields.io/badge/backend_tests-141%20passing-brightgreen)]()
[![Frontend Tests](https://img.shields.io/badge/frontend_tests-74%20passing-brightgreen)]()
[![Backend Coverage](https://img.shields.io/badge/coverage-56%25-yellow)]()
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Gerçek zamanlı çok oyunculu kelime oyunu. FastAPI ve React Native (Expo) ile geliştirildi.

[Özellikler](#-özellikler) • [Kurulum](#-kurulum) • [API Docs](#-api-dokümantasyonu) • [Test](#-test)

</div>

---

## 📋 İçindekiler

- [Oyun Modu](#-oyun-modu)
- [Özellikler](#-özellikler)
- [Teknoloji Yığını](#-teknoloji-yığını)
- [Mimari](#-mimari)
- [Kurulum](#-kurulum)
- [Geliştirme](#-geliştirme)
- [Test](#-test)
- [API Dokümantasyonu](#-api-dokümantasyonu)
- [Lisans](#-lisans)

---

## 🎮 Oyun Modu

### 🎯 Klasik Mod (1v1 Multiplayer)

- **60 saniyelik turlar**: Hızlı tempolu kelime savaşları
- **16 paylaşılan harf**: Adil rekabet için ortak harf havuzu
- **Gerçek zamanlı puanlama**: Rakibinizin kelimelerini anlık görün
- **Emoji tepkiler**: Oyun sırasında rakibinize emoji gönderin
- **Otomatik eşleştirme**: Oyuncu kuyruğunda hızlı eşleşme

### 📊 Puanlama Sistemi

Kelimeler **harf sıklığına** göre puanlanır:
- **Nadir harfler** (Ğ, Ü, Ş): 3 puan
- **Orta harfler** (K, M, B): 2 puan  
- **Sık harfler** (A, E, İ): 1 puan

**Bonus:** 5+ harf kelimeler +5 puan extra

---

## ✨ Özellikler

### 🎮 Oyun Özellikleri
- ✅ **Gerçek zamanlı multiplayer** - WebSocket tabanlı instant gameplay
- ✅ **Türkçe kelime doğrulama** - 50,000+ kelimelik sözlük
- ✅ **Dengeli puanlama** - Harf sıklığı tabanlı adil sistem
- ✅ **Emoji tepkiler** - Oyun sırasında rakibinize tepki gönderin
- ✅ **Otomatik eşleştirme** - Kuyruk sistemi ile hızlı maç bulma

### 👤 Kullanıcı Özellikleri
- ✅ **Kullanıcı profilleri** - Clerk ile güvenli kimlik doğrulama
- ✅ **Detaylı istatistikler** - Kazanma oranı, ortalama puan, en iyi seri
- ✅ **Oyun geçmişi** - Tüm maçlarınızı görüntüleyin
- ✅ **Liderlik tablosu** - Tüm oyuncular arasında sıralama

### 🔧 Teknik Özellikler
- ✅ **Kapsamlı test coverage** - 141 backend + 74 frontend test
- ✅ **Type-safe development** - TypeScript & Python type hints
- ✅ **Modern architecture** - Clean code & SOLID principles
- ✅ **Real-time updates** - WebSocket ile anlık senkronizasyon

---

## 🛠️ Teknoloji Yığını

### Backend
| Teknoloji | Versiyon | Açıklama |
|-----------|----------|----------|
| **FastAPI** | 0.115.5 | Modern Python web framework |
| **Uvicorn** | 0.32.1 | ASGI server |
| **WebSockets** | 14.1 | Real-time communication |
| **SQLAlchemy** | 2.0.36 | SQL toolkit & ORM |
| **PostgreSQL** | 12+ | Relational database |
| **pytest** | 8.2.1 | Testing framework (141 tests) |
| **Redis** | 7.0+ | Caching & sessions (optional) |

### Frontend
| Teknoloji | Versiyon | Açıklama |
|-----------|----------|----------|
| **React Native** | 0.76.5 | Cross-platform mobile |
| **Expo** | ~52.0.11 | RN development platform |
| **TypeScript** | 5.3.3 | Type-safe JavaScript |
| **Expo Router** | ~4.0.9 | File-based navigation |
| **Clerk** | 2.3.6 | Authentication |
| **TanStack Query** | 5.64.1 | Data fetching & caching |
| **Jest** | 29.7.0 | Testing framework (74 tests) |
| **NativeWind** | ^2.0.11 | Tailwind CSS for RN |

---

## 🏗️ Mimari

### Sistem Mimarisi

```
┌─────────────┐      WebSocket       ┌──────────────┐      SQL      ┌──────────────┐
│             │ ◄─────────────────► │              │ ◄────────────► │              │
│   Mobile    │                      │   FastAPI    │                │ PostgreSQL   │
│     App     │      REST API        │   Backend    │                │   Database   │
│  (Expo RN)  │ ◄─────────────────► │              │                │              │
└─────────────┘                      └──────────────┘                └──────────────┘
       │                                    │                               
       │                                    │                               
       │                             ┌──────▼──────┐                        
       │                             │    Redis    │                        
       └────────► Clerk Auth         │   Cache     │                        
                                     └─────────────┘                        
```

### Backend Architecture

```
lexo-backend/
├── app/
│   ├── api/v1/endpoints/     # REST API endpoints
│   │   ├── games.py          # Game CRUD operations
│   │   ├── stats.py          # User statistics
│   │   ├── users.py          # User management
│   │   └── words.py          # Word validation
│   ├── core/                 # Core functionality
│   │   ├── config.py         # Configuration management
│   │   ├── cache.py          # Redis caching
│   │   └── logging.py        # Structured logging
│   ├── models/               # Data models
│   │   ├── database.py       # SQLAlchemy models
│   │   ├── domain.py         # Domain models
│   │   └── schemas.py        # Pydantic schemas
│   ├── repositories/         # Data access layer
│   │   ├── game_repository.py
│   │   ├── stats_repository.py
│   │   └── user_repository.py
│   ├── services/             # Business logic
│   │   ├── game_service.py
│   │   ├── matchmaking_service.py
│   │   └── word_service.py
│   ├── websocket/            # WebSocket handlers
│   │   └── game_handler.py
│   └── main.py               # Application entry
└── tests/                    # 141 passing tests (56% coverage)
```

### Frontend Architecture

```
lexo/
├── app/                      # Expo Router pages
│   ├── (auth)/               # Authentication screens
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (home)/               # Main app screens
│   │   ├── index.tsx         # Home screen
│   │   ├── multiplayer.tsx   # Game screen
│   │   └── stats.tsx         # Statistics screen
│   └── _layout.tsx           # Root layout
├── components/               # Reusable components
│   ├── GameComponents.tsx    # Game UI components
│   ├── EmojiPicker.tsx       # Emoji selection
│   └── EmojiNotification.tsx # Emoji display
├── hooks/                    # Custom React hooks
│   ├── useApi.ts             # API integration
│   ├── useGameState.ts       # Game state management
│   └── useWebSocket.ts       # WebSocket connection
├── utils/                    # Utilities & helpers
│   ├── gameLogic.ts          # Game rules & scoring
│   ├── api.ts                # API client
│   └── constants.ts          # App constants
└── __tests__/                # 74 passing tests
```

---

## 🚀 Kurulum

### Önkoşullar

- **Node.js** 18+ ve npm
- **Python** 3.10+
- **PostgreSQL** 12+
- **Redis** (optional, for caching)

### Backend Setup

```bash
cd lexo-backend

# Virtual environment oluştur
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# Environment dosyasını oluştur
cp .env.example .env
# .env dosyasını düzenle (DATABASE_URL, CLERK_SECRET_KEY, vb.)

# PostgreSQL veritabanı oluştur
createdb lexo_db

# Veritabanı tablolarını oluştur
python3 -c "from app.models.database import Base; from app.database.session import engine; Base.metadata.create_all(bind=engine)"

# Sunucuyu başlat
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

✅ Backend çalışıyor: `http://localhost:8000`  
📚 API Docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd lexo

# Bağımlılıkları yükle
npm install

# Environment dosyasını oluştur
cp .env.example .env
# .env dosyasını düzenle (API_URL, WS_URL, CLERK_PUBLISHABLE_KEY)

# Expo development server'ı başlat
npm start
```

📱 Expo üzerinden iOS/Android emulator veya fiziksel cihazda çalıştırabilirsiniz.

---

## 💻 Geliştirme

### Development Workflow

```bash
# Feature branch oluştur
git checkout -b feature/amazing-feature

# Backend testlerini çalıştır
cd lexo-backend && pytest

# Frontend testlerini çalıştır
cd lexo && npm test

# Linting
npm run lint

# Commit yap
git commit -m "feat: add amazing feature"

# Push et
git push origin feature/amazing-feature
```

### Environment Variables

**Backend (.env):**
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/lexo_db

# Authentication
CLERK_SECRET_KEY=sk_test_...

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Server
UVICORN_HOST=0.0.0.0
UVICORN_PORT=8000
ENVIRONMENT=development
```

**Frontend (.env):**
```env
# API Endpoints
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_WS_URL=ws://localhost:8000

# Authentication
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Code Style

- **Backend**: Black formatter, isort, flake8
- **Frontend**: ESLint, Prettier
- **Commit messages**: Conventional Commits (feat, fix, docs, test, refactor)

---

## 🧪 Test

### Backend Tests

```bash
cd lexo-backend

# Tüm testleri çalıştır
pytest

# Coverage raporu ile
pytest --cov=app --cov-report=html

# Verbose output
pytest -v

# Belirli bir test dosyası
pytest tests/repositories/test_stats_repository.py -v

# Coverage raporunu görüntüle
open htmlcov/index.html  # macOS
```

**Test İstatistikleri:**
- ✅ **141 test passing**
- ✅ **56% code coverage**
- ✅ **stats_repository**: 96% coverage (17 tests)
- ✅ **user_repository**: 97% coverage (14 tests)
- ✅ **matchmaking_service**: 97% coverage (18 tests)

### Frontend Tests

```bash
cd lexo

# Tüm testleri çalıştır
npm test

# Watch mode (otomatik re-run)
npm test -- --watch

# Coverage raporu ile
npm test -- --coverage

# Belirli bir test dosyası
npm test -- hooks/__tests__/useApi.test.tsx
```

**Test İstatistikleri:**
- ✅ **74 test passing**
- ✅ **Components**: 22 tests
- ✅ **Hooks (useApi)**: 17 tests
- ✅ **Hooks (useGameState)**: 11 tests
- ✅ **Utils (gameLogic)**: 24 tests

---

## 📚 API Dokümantasyonu

### Interactive API Docs

Backend çalışırken aşağıdaki adreslerde API dokümantasyonuna erişebilirsiniz:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Ana Endpoint'ler

#### Authentication

```http
POST /api/v1/users/
# Clerk token ile kullanıcı oluştur/getir
# Body: { "clerk_id": "user_xxx", "username": "player1" }

GET /api/v1/users/{clerk_id}
# Kullanıcı detaylarını getir
```

#### Game

```http
WS /ws/{token}
# WebSocket bağlantısı (token = Clerk JWT)

POST /api/v1/games/
# Oyun sonucunu kaydet
# Body: { "player1_id": "...", "player2_id": "...", "winner_id": "...", ... }

GET /api/v1/games/?clerk_id={clerk_id}&skip=0&limit=10
# Kullanıcının oyun geçmişi

GET /api/v1/games/{game_id}
# Belirli bir oyunun detayları
```

#### Stats

```http
GET /api/v1/stats/{clerk_id}
# Kullanıcı istatistikleri
# Response: { "games_played", "games_won", "win_rate", "average_score", ... }

GET /api/v1/leaderboard/?skip=0&limit=10
# Liderlik tablosu (en yüksek skorlara göre sıralı)
```

#### Words

```http
POST /api/v1/words/validate
# Kelime doğrula
# Body: { "word": "KELIME" }
# Response: { "valid": true, "points": 12 }

GET /api/v1/words/random-letters?count=16
# Rastgele harf dizisi oluştur
# Response: { "letters": ["A", "E", "K", ...] }
```

### WebSocket Events

#### Client → Server

```javascript
// Kuyrukta bekle
{
  "type": "join_queue",
  "username": "player1"
}

// Kelime gönder
{
  "type": "word_submit",
  "word": "KELIME"
}

// Emoji gönder
{
  "type": "emoji",
  "emoji": "👍"
}

// Oyundan ayrıl
{
  "type": "leave"
}
```

#### Server → Client

```javascript
// Kuyruk durumu
{
  "type": "queue_status",
  "position": 1,
  "total": 3
}

// Eşleşme bulundu
{
  "type": "match_found",
  "opponent": {
    "clerk_id": "user_xxx",
    "username": "player2"
  }
}

// Oyun başladı
{
  "type": "game_start",
  "letter_pool": ["A", "E", "K", ...],
  "game_duration": 60
}

// Kelime sonucu
{
  "type": "word_result",
  "valid": true,
  "word": "KELIME",
  "points": 12,
  "player_score": 45
}

// Rakip kelime gönderdi
{
  "type": "opponent_word",
  "word": "MERHABA",
  "points": 18,
  "opponent_score": 38
}

// Rakipten emoji
{
  "type": "opponent_emoji",
  "emoji": "🔥"
}

// Oyun bitti
{
  "type": "game_end",
  "winner": "player1",
  "final_scores": {
    "player1": 67,
    "player2": 54
  }
}
```

---

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Aşağıdaki adımları takip ederek projeye katkıda bulunabilirsiniz:

1. **Fork** edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. **Pull Request** açın

### Katkı Kuralları

- ✅ Testler yazın (coverage düşürmeyin)
- ✅ Kod stil kurallarına uyun (ESLint, Black)
- ✅ Commit mesajlarında [Conventional Commits](https://www.conventionalcommits.org/) kullanın
- ✅ Değişikliklerinizi dokümante edin

---

## 📄 Lisans

Bu proje **MIT** lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 👨‍💻 Geliştirici

**Arda Ceylan**
- GitHub: [@ardacey](https://github.com/ardacey)

---

## 📊 Proje İstatistikleri

- 🧪 **Backend**: 141 tests passing (56% coverage)
- 🧪 **Frontend**: 74 tests passing
- 📝 **Lines of Code**: ~15,000+
- 🏗️ **Architecture**: Clean Architecture, Repository Pattern
- 🔒 **Security**: JWT Authentication, SQL Injection Protection
- ⚡ **Performance**: WebSocket for real-time, Redis caching
- 📅 **Started**: Ekim 2024
- 📅 **Last Updated**: Ekim 2025

---

## 🗺️ Roadmap

### ✅ Tamamlanan
- [x] Klasik 1v1 multiplayer mod
- [x] Türkçe kelime doğrulama
- [x] Kullanıcı istatistikleri
- [x] Liderlik tablosu
- [x] Emoji tepkiler
- [x] Kapsamlı test coverage (56% backend, 74 frontend)
- [x] Comprehensive documentation

### 🚧 Devam Eden
- [ ] Monitoring & logging sistemi
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Docker deployment

### 📝 Planlanan
- [ ] Arkadaş sistemi
- [ ] Özel oda oluşturma
- [ ] Farklı oyun modları (blitz, marathon)
- [ ] Başarım sistemi
- [ ] Push notifications
- [ ] In-app chat

---

<div align="center">

**⭐ Projeyi beğendiyseniz star vermeyi unutmayın! ⭐**

Made with ❤️ by [Arda Ceylan](https://github.com/ardacey)

</div>
