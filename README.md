# Lexo

A Turkish word game for mobile — players race to form words from a shared pool of letters. Supports solo practice and real-time multiplayer with matchmaking, friend invites, and emoji reactions.

## What it is

Lexo gives you a pool of 16 random letters and a 60-second timer. You tap letters to spell valid Turkish words; longer words score more. In multiplayer both players see the same pool and race simultaneously — the higher score wins.

**Key features:**
- Solo practice mode with local scoring
- Real-time 1v1 multiplayer via WebSocket matchmaking
- Friend invites — challenge specific friends directly
- Emoji reactions during live games
- Presence system showing which friends are online
- Leaderboard and personal game history
- In-app version check with forced-update support

## Architecture

```
Lexo/
├── lexo/            # React Native / Expo app (TypeScript)
└── lexo-backend/    # FastAPI backend (Python)
```

**Frontend** — Expo (React Native) with NativeWind (Tailwind), TanStack Query for data fetching, and a type-safe API client generated from the OpenAPI spec.

**Backend** — FastAPI with SQLAlchemy + PostgreSQL, Supabase for auth, and native WebSocket support for real-time game and notification channels.

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL (or Docker)
- An Expo-compatible device / simulator
- A [Supabase](https://supabase.com) project for auth

### Backend setup

```bash
cd lexo-backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Fill in DATABASE_URL, SUPABASE_URL, SUPABASE_KEY, etc.

# Run migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or with Docker:

```bash
cd lexo-backend
docker-compose up --build
```

### Frontend setup

```bash
cd lexo

npm install

# Configure environment
cp .env.example .env
# Set EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WS_URL, EXPO_PUBLIC_SUPABASE_URL, etc.

# Start Expo
npm start
```

### Run both together

From the project root:

```bash
cd lexo
npm run dev       # starts backend + Expo Metro together
npm run dev:ios   # starts backend + iOS simulator
```

## Environment variables

### Backend (`.env` in `lexo-backend/`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/lexo_db` | PostgreSQL connection string |
| `SUPABASE_URL` | — | Your Supabase project URL |
| `SUPABASE_KEY` | — | Supabase service role key |
| `CORS_ORIGINS` | `http://localhost:8081,http://localhost:19006` | Allowed origins (never use `*` in production) |
| `GAME_DURATION` | `60` | Round length in seconds |
| `LETTER_POOL_SIZE` | `16` | Letters dealt per round |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

### Frontend (`.env` in `lexo/`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend HTTP base URL |
| `EXPO_PUBLIC_WS_URL` | Backend WebSocket base URL |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

## API overview

The backend exposes a versioned REST API under `/api/v1` and two WebSocket endpoints:

| Endpoint | Description |
|---|---|
| `GET /` | API status and live match counts |
| `GET /stats` | Active rooms, waiting players, online users |
| `GET /app/version` | Mobile app version info |
| `/api/v1/users` | User management |
| `/api/v1/games` | Game history and saving results |
| `/api/v1/words` | Word validation |
| `/api/v1/leaderboard` | Global leaderboard |
| `/api/v1/friends` | Friend requests and friend list |
| `/api/v1/presence` | Online presence status |
| `WS /ws/queue` | Matchmaking and live game channel |
| `WS /ws/notify` | Invite and notification channel |

Full OpenAPI spec: `lexo-backend/openapi.json`

## Development

### Regenerate the API client

After changing backend routes, regenerate the typed frontend client:

```bash
cd lexo
npx @hey-api/openapi-ts
```

### Run tests

```bash
# Frontend
cd lexo
npm test
npm run test:coverage

# Backend
cd lexo-backend
pytest
pytest --cov=app
```

### Lint

```bash
cd lexo
npm run lint
```

## Building for production

```bash
# Android release build via EAS
cd lexo
npm run build:android:release

# Submit to Google Play
npm run submit:android
```

## License

See [LICENSE](LICENSE).
