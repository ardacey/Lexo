import type { LobbyRoom } from "../types";
import { AuthAPI } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

class APIError extends Error {
  status?: number;
  code?: string;
  
  constructor(
    message: string,
    status?: number,
    code?: string
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }
}

function getHeaders(): HeadersInit {
  const token = AuthAPI.getToken();
  return token 
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode = response.status.toString();
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
      errorCode = errorData.code || errorCode;
    } catch {
      // If response body isn't JSON, use default error message
    }
    
    throw new APIError(errorMessage, response.status, errorCode);
  }
  
  return response.json();
}

export async function fetchRooms(): Promise<LobbyRoom[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      headers: getHeaders(),
    });
    return handleResponse<LobbyRoom[]>(response);
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Failed to fetch rooms. Please check your connection.');
  }
}

interface JoinResponse {
  room_id: string;
  player_id: string;
  is_viewer?: boolean;
}

export async function createRoom(name: string): Promise<JoinResponse> {
  if (!name.trim()) {
    throw new APIError('Room name cannot be empty');
  }
  
  if (name.length > 50) {
    throw new APIError('Room name cannot exceed 50 characters');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name: name.trim() }),
    });
    return handleResponse<JoinResponse>(response);
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Failed to create room. Please try again.');
  }
}

export async function joinRoom(roomId: string, asViewer: boolean = false): Promise<JoinResponse> {
  if (!roomId) {
    throw new APIError('Room ID is required');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ as_viewer: asViewer }),
    });
    return handleResponse<JoinResponse>(response);
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Failed to join room. Please try again.');
  }
}

export { APIError };
