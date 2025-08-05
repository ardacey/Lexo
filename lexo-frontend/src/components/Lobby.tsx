import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRooms, createRoom, joinRoom } from '../api/rooms';
import { useGameStore } from '../store/useGameStore';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { validateRoomName } from '../utils/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Target, Users, Swords } from 'lucide-react';
import StatsOverview from './StatsOverview';

interface LobbyProps {
  onPracticeMode?: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ onPracticeMode }) => {
  const [newRoomName, setNewRoomName] = useState('');
  const [gameMode, setGameMode] = useState<'classic' | 'battle_royale'>('classic');
  const { user } = useAuth();
  const connect = useGameStore(state => state.connect);
  const queryClient = useQueryClient();

  const { 
    data: rooms, 
    isLoading, 
    isError, 
    error 
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
    refetchInterval: 5000,
  });

  const handleSuccessfulJoin = (data: { room_id: string; player_id: string; }) => {
      connect(data.room_id, data.player_id, user?.username || 'Unknown');
  };

  const createRoomMutation = useMutation({
    mutationFn: (data: { name: string; mode: 'classic' | 'battle_royale' }) => createRoom(data.name, data.mode),
    onSuccess: (data) => {
      toast.success(`Room "${newRoomName}" created! Joining...`);
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      handleSuccessfulJoin(data);
    },
    onError: (err: Error) => {
      toast.error("Failed to create room", { description: err.message });
    }
  });

  const joinRoomMutation = useMutation({
    mutationFn: ({ roomId, asViewer }: { roomId: string; asViewer: boolean }) => 
      joinRoom(roomId, asViewer),
    onSuccess: (data) => {
      const action = data.is_viewer ? "Viewing" : "Joining";
      toast.info(`${action} room...`);
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      handleSuccessfulJoin(data);
    },
    onError: (err: Error) => {
      toast.error("Failed to join room", { description: err.message });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });

  const handleCreateRoom = () => {
    const validation = validateRoomName(newRoomName);
    if (!validation.valid) {
      toast.error(validation.message || 'Invalid room name');
      return;
    }

    const promise = createRoomMutation.mutateAsync({ name: newRoomName.trim(), mode: gameMode });

    toast.promise(promise, {
      loading: 'Creating room...',
      success: (data) => {
        handleSuccessfulJoin(data); 
        setNewRoomName('');
        return `Room "${newRoomName}" created!`;
      },
      error: (err) => `Failed: ${err.message}`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
        <p className="mt-4 text-slate-500">Loading available rooms...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-500 bg-red-100 p-4 rounded-md">
        <strong>Error:</strong> {error.message}
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-cyan-600">Game Lobby</h1>
        <p className="text-slate-500">Welcome, {user?.username}!</p>
        {onPracticeMode && (
          <div className="mt-4">
            <Button 
              onClick={onPracticeMode}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              Practice Mode
            </Button>
          </div>
        )}
      </div>

      <StatsOverview />

      <Card className="bg-white/70 border-slate-200 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Available Rooms</CardTitle>
          <CardDescription>Join an existing room or create a new one below.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 hover:bg-slate-50">
                <TableHead>Room Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Players</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms && rooms.length > 0 ? rooms.map((room) => (
                <TableRow key={room.id} className="border-slate-200">
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      room.game_mode === 'battle_royale'
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {room.game_mode === 'battle_royale' ? 'Battle Royale' : 'Classic'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {room.player_count}/{room.max_players}
                    {room.total_count > room.player_count && (
                      <span className="text-xs text-slate-500 ml-1">
                        (+{room.total_count - room.player_count} viewing)
                      </span>
                    )}
                    {room.game_mode === 'battle_royale' && room.min_players && (
                      <div className="text-xs text-slate-500">
                        Min: {room.min_players}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      room.status === 'waiting' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : room.status === 'countdown'
                        ? 'bg-blue-100 text-blue-800'
                        : room.status === 'in_progress'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {room.status === 'in_progress' ? 'in game' : room.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {room.is_joinable ? (
                      <Button 
                        onClick={() => joinRoomMutation.mutate({ roomId: room.id, asViewer: false })} 
                        size="sm" 
                        disabled={joinRoomMutation.isPending || createRoomMutation.isPending}
                      >
                        {joinRoomMutation.isPending && joinRoomMutation.variables?.roomId === room.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Join
                      </Button>
                    ) : room.is_viewable && room.status !== 'countdown' ? (
                      <Button 
                        onClick={() => joinRoomMutation.mutate({ roomId: room.id, asViewer: true })} 
                        size="sm" 
                        variant="outline"
                        disabled={joinRoomMutation.isPending || createRoomMutation.isPending}
                      >
                        {joinRoomMutation.isPending && joinRoomMutation.variables?.roomId === room.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        View
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Full</span>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    No available rooms. Why not create one?
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-white/70 border-slate-200">
        <CardHeader>
          <CardTitle>Create a New Room</CardTitle>
          <CardDescription>Choose your game mode</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div
              onClick={() => setGameMode('classic')}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                gameMode === 'classic'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Classic</h3>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                1v1 • 60 seconds • 16 letters
              </p>
            </div>
            
            <div
              onClick={() => setGameMode('battle_royale')}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                gameMode === 'battle_royale'
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold">Battle Royale</h3>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                3-50 players • 5 minutes • 50 letters
              </p>
            </div>
          </div>
          
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="My Awesome Game"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
              disabled={createRoomMutation.isPending || joinRoomMutation.isPending}
            />
            <Button 
              onClick={handleCreateRoom} 
              variant="secondary" 
              disabled={createRoomMutation.isPending || joinRoomMutation.isPending}
            >
              {createRoomMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Join
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Lobby;