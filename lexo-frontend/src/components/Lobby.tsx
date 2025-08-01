import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRooms, createRoom, joinRoom } from '../api/rooms';
import { useGameStore } from '../store/useGameStore';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Target } from 'lucide-react';

interface LobbyProps {
  onPracticeMode?: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ onPracticeMode }) => {
  const [newRoomName, setNewRoomName] = useState('');
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
    mutationFn: (name: string) => createRoom(name),
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
    if (!newRoomName.trim()) return;

    const promise = createRoomMutation.mutateAsync(newRoomName.trim());

    toast.promise(promise, {
      loading: 'Creating room...',
      success: (data) => {
        handleSuccessfulJoin(data); 
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
    <div className="w-full max-w-2xl space-y-8">
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
                    {room.player_count}/{room.max_players}
                    {room.total_count > room.player_count && (
                      <span className="text-xs text-slate-500 ml-1">
                        (+{room.total_count - room.player_count} viewing)
                      </span>
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
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
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
        </CardHeader>
        <CardContent>
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