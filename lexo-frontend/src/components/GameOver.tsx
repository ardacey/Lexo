import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Crown, Zap } from 'lucide-react';

interface Props {
  onReturnToLobby: () => void;
}

const GameOver: React.FC<Props> = ({ onReturnToLobby }) => {
  const finalScores = useGameStore(state => state.finalScores);
  const winnerData = useGameStore(state => state.winnerData);
  const isTie = useGameStore(state => state.isTie);
  const gameOverReason = useGameStore(state => state.gameOverReason);

  const renderTitle = () => {
    if (isTie) {
      return (
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-8 w-8 text-yellow-500" />
          <CardTitle className="text-3xl">It's a Tie!</CardTitle>
        </div>
      );
    }
    if (winnerData) {
      const winnerNames = winnerData.usernames.join(' & ');
      return (
        <div className="flex items-center justify-center gap-2">
          <Crown className="h-8 w-8 text-amber-500" />
          <CardTitle className="text-3xl">Winner: {winnerNames}</CardTitle>
        </div>
      );
    }
    return <CardTitle className="text-3xl">Game Over</CardTitle>;
  };

  return (
    <Card className="w-full max-w-md bg-white border-slate-200 text-center">
      <CardHeader>
        {renderTitle()}
        {gameOverReason ? (
          <CardDescription className="text-green-600 pt-2 font-semibold">{gameOverReason}</CardDescription>
        ) : (
          winnerData && <CardDescription>with a score of {winnerData.score} points</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <h3 className="font-semibold text-slate-800">Final Scores</h3>
        <Table>
          <TableHeader>
            <TableRow className="border-b-slate-200 hover:bg-slate-50">
              <TableHead className="text-left">Player</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {finalScores && finalScores.map((player) => (
              <TableRow key={player.username} className="border-b-0">
                <TableCell className="font-medium text-left">{player.username}</TableCell>
                <TableCell className="text-right font-mono">{player.score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button onClick={onReturnToLobby} className="w-full mt-4" size="lg">
          Return to Lobby
        </Button>
      </CardContent>
    </Card>
  );
};

export default GameOver;