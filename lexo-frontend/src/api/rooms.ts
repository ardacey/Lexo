import type { LobbyRoom } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export async function fetchRooms(): Promise<LobbyRoom[]> {
  const response = await fetch(`${API_BASE_URL}/rooms`);
  if (!response.ok) {
    throw new Error('Failed to fetch game rooms.');
  }
  return response.json();
}
interface JoinResponse {
  room_id: string;
  player_id: string;
}

export async function createRoom(name: string, username: string): Promise<JoinResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create room.');
  }
  return response.json();
}

export async function joinRoom(roomId: string, username: string): Promise<JoinResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to join room.');
  }
  return response.json();
}