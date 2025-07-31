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