import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';

interface ScoreboardProps {
  username: string | null;
}

const Scoreboard: React.FC<ScoreboardProps> = React.memo(({ username }) => {
  const scores = useGameStore(state => state.scores);
  const timeLeft = useGameStore(state => state.timeLeft);
  const isViewer = useGameStore(state => state.isViewer);
  const gameMode = useGameStore(state => state.gameMode);
  const eliminationInfo = useGameStore(state => state.eliminationInfo);

  const ownScore = useMemo(() => 
    scores.find(s => s.username === username)?.score ?? 0, 
    [scores, username]
  );
  
  const opponent = useMemo(() => 
    scores.find(s => s.username !== username),
    [scores, username]
  );

  const scoreAnimation = useMemo(() => ({
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: { duration: 0.2 }
  }), []);

  if (gameMode === 'battle_royale') {
    return (
      <div className="flex flex-wrap justify-center gap-4 w-full max-w-4xl text-center p-4 bg-white/80 rounded-lg border border-slate-200 shadow-sm">
        <div className="min-w-[120px]">
          <div className="text-sm text-slate-500 mb-1">Time Left</div>
          <div className={`text-3xl font-bold h-10 flex items-center justify-center transition-colors duration-300 ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
              {timeLeft}s
          </div>
        </div>
        
        {eliminationInfo && eliminationInfo.next_elimination_time > 0 && (
          <div className="min-w-[160px]">
            <div className="text-sm text-slate-500 mb-1">
              Next Elimination
              {eliminationInfo.players_per_elimination && eliminationInfo.players_per_elimination > 1 && (
                <span className="text-orange-600 font-medium"> ({eliminationInfo.players_per_elimination}x)</span>
              )}
            </div>
            <div className={`text-2xl font-bold h-10 flex items-center justify-center transition-colors duration-300 ${eliminationInfo.next_elimination_time <= 5 ? 'text-red-600 animate-pulse' : 'text-orange-600'}`}>
                {eliminationInfo.next_elimination_time}s
            </div>
            {eliminationInfo.next_elimination_players && eliminationInfo.next_elimination_players.length > 0 ? (
              <div className="text-xs text-slate-600 mt-1">
                {eliminationInfo.next_elimination_players.length > 1 ? (
                  <>
                    <span className="font-medium">{eliminationInfo.next_elimination_players.length} players</span> at risk:<br/>
                    <span className="text-red-600">{eliminationInfo.next_elimination_players.join(', ')}</span>
                  </>
                ) : (
                  <>
                    <span className="text-red-600">{eliminationInfo.next_elimination_players[0]}</span> at risk
                  </>
                )}
              </div>
            ) : eliminationInfo.next_elimination_player && (
              <div className="text-xs text-slate-600 mt-1">
                <span className="text-red-600">{eliminationInfo.next_elimination_player}</span> at risk
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isViewer && scores.length >= 2) {
    return (
      <div className="flex justify-around w-full text-center p-4 bg-white/50 rounded-lg border border-slate-200">
        <div>
          <div className="text-sm text-slate-500">{scores[0].username}</div>
          <div className="text-3xl font-bold text-cyan-600 relative h-10 flex items-center justify-center">
              <AnimatePresence mode="popLayout">
                  <motion.span
                      key={scores[0].score}
                      initial={scoreAnimation.initial}
                      animate={scoreAnimation.animate}
                      exit={scoreAnimation.exit}
                      transition={scoreAnimation.transition}
                      className="absolute"
                  >
                      {scores[0].score}
                  </motion.span>
              </AnimatePresence>
          </div>
        </div>

        <div>
          <div className="text-sm text-slate-500">Time Left</div>
          <div className={`text-3xl font-bold h-10 flex items-center justify-center transition-colors duration-300 ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
              {timeLeft}s
          </div>
        </div>

        <div>
          <div className="text-sm text-slate-500">{scores[1].username}</div>
           <div className="text-3xl font-bold text-purple-600 relative h-10 flex items-center justify-center">
                <AnimatePresence mode="popLayout">
                    <motion.span
                        key={scores[1].score}
                        initial={scoreAnimation.initial}
                        animate={scoreAnimation.animate}
                        exit={scoreAnimation.exit}
                        transition={scoreAnimation.transition}
                        className="absolute"
                    >
                        {scores[1].score}
                    </motion.span>
                </AnimatePresence>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-around w-full text-center p-4 bg-white/50 rounded-lg border border-slate-200">
      <div>
        <div className="text-sm text-slate-500">Your Score</div>
        <div className="text-3xl font-bold text-cyan-600 relative h-10 flex items-center justify-center">
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={ownScore}
                    initial={scoreAnimation.initial}
                    animate={scoreAnimation.animate}
                    exit={scoreAnimation.exit}
                    transition={scoreAnimation.transition}
                    className="absolute"
                >
                    {ownScore}
                </motion.span>
            </AnimatePresence>
        </div>
      </div>

      <div>
        <div className="text-sm text-slate-500">Time Left</div>
        <div className={`text-3xl font-bold h-10 flex items-center justify-center transition-colors duration-300 ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
            {timeLeft}s
        </div>
      </div>

      {opponent && (
        <div>
          <div className="text-sm text-slate-500">{opponent.username}'s Score</div>
           <div className="text-3xl font-bold relative h-10 flex items-center justify-center">
                <AnimatePresence mode="popLayout">
                    <motion.span
                        key={opponent.score}
                        initial={scoreAnimation.initial}
                        animate={scoreAnimation.animate}
                        exit={scoreAnimation.exit}
                        transition={scoreAnimation.transition}
                        className="absolute"
                    >
                        {opponent.score}
                    </motion.span>
                </AnimatePresence>
            </div>
        </div>
      )}
    </div>
  );
});

export default Scoreboard;