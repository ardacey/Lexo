// API configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000' 
  : 'https://your-production-api.com';

export const API_ENDPOINTS = {
  validateWord: `${API_BASE_URL}/api/validate-word`,
  health: `${API_BASE_URL}/health`,
  websocket: `ws://localhost:8000/ws/queue`,
};

export interface ValidateWordResponse {
  valid: boolean;
  message: string;
}

export const validateWord = async (word: string): Promise<ValidateWordResponse> => {
  try {
    const response = await fetch(API_ENDPOINTS.validateWord, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Word validation error:', error);
    return {
      valid: false,
      message: 'Sunucuya bağlanılamadı',
    };
  }
};
