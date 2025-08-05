# Lexo

A real-time multiplayer word game built with FastAPI and React. Challenge friends in classic 1v1 matches or compete in exciting Battle Royale tournaments with up to 16 players!

## 🌐 Live Demo

**Play now at: [https://lexo-a4ba.onrender.com/](https://lexo-a4ba.onrender.com/)**

Experience the full game with all features including real-time multiplayer, Battle Royale mode, and Turkish word validation!

## 🎮 Game Modes

### Classic Mode
- **1v1 multiplayer**: Face off against a single opponent
- **60-second rounds**: Fast-paced word battles
- **16 letters**: Shared letter pool for fair competition
- **Real-time scoring**: See your opponent's words as they play

### Battle Royale Mode
- **3-16 players**: Massive multiplayer word battles
- **4-minute matches**: Extended gameplay with elimination rounds
- **Progressive elimination**: Lowest scoring players eliminated every 30 seconds
- **50-letter pool**: Larger pool for extended gameplay
- **Live leaderboard**: Track your ranking in real-time

## ✨ Features

- **Real-time multiplayer** with WebSocket connections
- **Turkish word validation** with comprehensive dictionary
- **Letter-based scoring system** with balanced letter frequency
- **Practice mode** for solo gameplay
- **User authentication** and statistics tracking
- **Game history** and performance analytics
- **Rate limiting** to prevent spam and ensure fair play
- **Spectator mode** to watch ongoing games
- **Responsive design** optimized for all devices

## 🛠️ Tech Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **SQLAlchemy** - Database ORM with PostgreSQL support
- **Alembic** - Database migration management
- **WebSockets** - Real-time bidirectional communication
- **JWT Authentication** - Secure user sessions
- **Rate Limiting** - Prevent abuse and ensure fair play

### Frontend
- **React 19** - Modern React with latest features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Zustand** - Lightweight state management
- **TanStack Query** - Server state management
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **Radix UI** - Accessible component primitives

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.9+
- **PostgreSQL** (or SQLite for development)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd lexo-backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   Create a `.env` file:
   ```env
   DATABASE_URL=postgresql://username:password@localhost/lexo
   SECRET_KEY=your-secret-key-here
   ENVIRONMENT=development
   ```

5. **Initialize database**
   ```bash
   alembic upgrade head
   ```

6. **Start the server**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd lexo-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   VITE_WS_BASE_URL=ws://localhost:8000/api/ws
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Visit `http://localhost:5173`

## 🎯 How to Play

### Classic Mode
1. **Join a room** or create a new one
2. **Wait for an opponent** to join
3. **Form words** using the shared letter pool
4. **Score points** based on letter values
5. **Win** by having the highest score when time runs out

### Battle Royale Mode
1. **Join a Battle Royale room** (3-16 players required)
2. **Wait for countdown** to begin
3. **Form words** to climb the leaderboard
4. **Avoid elimination** by staying off the bottom
5. **Survive** until the end to claim victory

### Scoring System
- Each letter has a point value based on frequency
- Longer words = higher scores
- Common letters = fewer points
- Rare letters = more points

## 📊 Game Statistics

Track your performance with detailed statistics:
- **Games played** and win rate
- **Total score** and average per game
- **Words formed** and favorites
- **Game history** with detailed breakdowns
- **Performance trends** over time

## 🔧 Development

### Backend Commands
```bash
# Run tests
python -m pytest

# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Format code
black .
```

### Frontend Commands
```bash
# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

## 📝 API Documentation

When running the backend, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- Turkish word list sourced from [open linguistic databases](https://github.com/factoreminv/turkish-words)
- Letter frequency analysis based on Turkish language statistics
- UI components built with Radix UI primitives
- Icons provided by Lucide React

For support or questions, please open an issue on GitHub or contact us at [ac.ardaceylan@gmail.com](mailto:ac.ardaceylan@gmail.com).
