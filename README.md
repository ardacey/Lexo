<div align="center">

# Lexo

**A real-time Turkish word game for mobile**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo)](https://expo.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)

Race to form Turkish words from a shared letter pool — solo or against a friend in real time.

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Development](#development)
- [Building for Production](#building-for-production)
- [License](#license)

---

## Overview

Lexo gives you a pool of 16 random Turkish letters and a 60-second timer. Tap letters to spell valid words — longer words score more. In multiplayer, both players share the same pool and race simultaneously.

## Features

| | |
|---|---|
| 🎯 **Solo Practice** | Local scoring with no account required |
| ⚡ **Real-time Multiplayer** | WebSocket matchmaking — find an opponent in seconds |
| 📩 **Friend Invites** | Challenge specific friends directly |
| 😄 **Emoji Reactions** | Send reactions during live games |
| 🟢 **Presence System** | See which friends are currently online |
| 🏆 **Leaderboard** | Global rankings and personal game history |
| 🔄 **Force Update** | In-app version checks with server-controlled update gating |

## Architecture

```
Lexo/
├── lexo/            # React Native / Expo (TypeScript)
└── lexo-backend/    # FastAPI (Python)
```

**Frontend** — [Expo](https://expo.dev) with [NativeWind](https://www.nativewind.dev/) (Tailwind for React Native), [TanStack Query](https://tanstack.com/query) for data fetching, and a type-safe HTTP client auto-generated from the backend's OpenAPI spec.

**Backend** — [FastAPI](https://fastapi.tiangolo.com) with SQLAlchemy + PostgreSQL, [Supabase](https://supabase.com) for auth, and native WebSocket support for real-time game and notification channels.

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 16+ (or Docker)
- Expo Go app or a simulator
- A [Supabase](https://supabase.com) project for authentication

### 1. Clone the repo

```bash
git clone https://github.com/your-username/Lexo.git
cd Lexo
```

### 2. Backend

```bash
cd lexo-backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — fill in DATABASE_URL, SUPABASE_URL, SUPABASE_KEY, etc.

# Run database migrations
alembic upgrade head

# Start the dev server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> **Docker alternative:**
> ```bash
> cd lexo-backend && docker-compose up --build
> ```

### 3. Frontend

```bash
cd lexo

npm install

# Configure environment
cp .env.example .env
# Edit .env — fill in API URL, WebSocket URL, Supabase credentials

npm start
```

### 4. Run both together

From the `lexo/` directory:

```bash
npm run dev        # Expo Metro + backend (side by side)
npm run dev:ios    # Expo iOS simulator + backend
```

## Environment Variables

### Backend — `lexo-backend/.env`

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/lexo_db` | PostgreSQL connection string |
| `SUPABASE_URL` | — | Your Supabase project URL |
| `SUPABASE_KEY` | — | Supabase service role key |
| `CORS_ORIGINS` | `http://localhost:8081,http://localhost:19006` | Comma-separated allowed origins |
| `GAME_DURATION` | `60` | Round length in seconds |
| `LETTER_POOL_SIZE` | `16` | Letters dealt per round |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

> ⚠️ Never set `CORS_ORIGINS=*` in production — the server will refuse to start.

### Frontend — `lexo/.env`

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend HTTP base URL |
| `EXPO_PUBLIC_WS_URL` | Backend WebSocket base URL |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

## API Reference

REST endpoints are versioned under `/api/v1`. Two persistent WebSocket channels handle real-time gameplay.

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | API status and live match counts |
| `/stats` | GET | Active rooms, waiting players, online users |
| `/app/version` | GET | Mobile app version gating info |
| `/api/v1/users` | REST | User profiles and username management |
| `/api/v1/games` | REST | Save results and fetch game history |
| `/api/v1/words` | REST | Word validation |
| `/api/v1/leaderboard` | REST | Global leaderboard |
| `/api/v1/friends` | REST | Friend requests and friend list |
| `/api/v1/presence` | REST | Online presence status |
| `/ws/queue` | WebSocket | Matchmaking queue and live game channel |
| `/ws/notify` | WebSocket | Friend invites and notifications |

Full OpenAPI spec: [`lexo-backend/openapi.json`](lexo-backend/openapi.json)  
Interactive docs (when running locally): `http://localhost:8000/docs`

## Development

### Regenerate the API client

After changing backend routes, regenerate the typed frontend client from the OpenAPI spec:

```bash
cd lexo
npx @hey-api/openapi-ts
```

### Tests

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
cd lexo && npm run lint
```

## Building for Production

```bash
# Build Android release via EAS
cd lexo
npm run build:android:release

# Submit to Google Play
npm run submit:android
```

## License

[MIT](LICENSE) © 2025 Arda Ceylan
