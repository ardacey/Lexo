import type { LobbyRoom } from "../types";
import { AuthAPI } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

function getHeaders(): HeadersInit {
  const token = AuthAPI.getToken();
  return token 
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export async function fetchRooms(): Promise<LobbyRoom[]> {
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch game rooms.');
  }
  return response.json();
}

interface JoinResponse {
  room_id: string;
  player_id: string;
  is_viewer?: boolean;
}

export async function createRoom(name: string): Promise<JoinResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create room.');
  }
  return response.json();
}

export async function joinRoom(roomId: string, asViewer: boolean = false): Promise<JoinResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ as_viewer: asViewer }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to join room.');
  }
  return response.json();
}