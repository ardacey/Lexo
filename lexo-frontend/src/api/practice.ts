const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export interface PracticeSession {
  session_id: string;
  letter_pool: string[];
  score: number;
  words_found: string[];
  time_remaining: number;
}

export interface PracticeStartRequest {
  duration?: number;
}

export interface WordSubmissionRequest {
  word: string;
}

export interface PracticeResults {
  session_id: string;
  final_score: number;
  words_found: string[];
  total_words: number;
  duration: number;
  words_per_minute: number;
}

export const startPracticeSession = async (duration: number = 300): Promise<PracticeSession> => {
  const token = sessionStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/practice/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ duration }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start practice session');
  }

  return response.json();
};

export const submitPracticeWord = async (sessionId: string, word: string) => {
  const token = sessionStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/practice/${sessionId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ word }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to submit word');
  }

  return response.json();
};

export const getPracticeStatus = async (sessionId: string) => {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/practice/${sessionId}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get practice status');
  }

  return response.json();
};

export const endPracticeSession = async (sessionId: string): Promise<PracticeResults> => {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/practice/${sessionId}/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to end practice session');
  }

  return response.json();
};
