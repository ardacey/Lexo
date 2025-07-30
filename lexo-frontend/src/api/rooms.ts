import type { LobbyRoom } from "../types";

const API_BASE_URL = "http://localhost:8000/api";

export async function fetchRooms(): Promise<LobbyRoom[]> {
  const response = await fetch(`${API_BASE_URL}/rooms`);
  if (!response.ok) {
    throw new Error('Failed to fetch game rooms. The server might be down.');
  }
  return response.json();
}

export async function createRoom(name: string): Promise<LobbyRoom> {
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to create the room.' }));
    throw new Error(errorData.detail);
  }
  return response.json();
}