export interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export class AuthAPI {
  private static getAuthHeaders(): HeadersInit {
    const token = sessionStorage.getItem('access_token');
    return token 
      ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  static async register(data: RegisterData): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
  }

  static async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const authData = await response.json();
    sessionStorage.setItem('access_token', authData.access_token);
    return authData;
  }

  static async getCurrentUser(): Promise<User | null> {
    const token = sessionStorage.getItem('access_token');
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('access_token');
          return null;
        }
        throw new Error('Failed to get user data');
      }

      return response.json();
    } catch {
      sessionStorage.removeItem('access_token');
      return null;
    }
  }

  static logout(): void {
    sessionStorage.removeItem('access_token');
  }

  static getToken(): string | null {
    return sessionStorage.getItem('access_token');
  }

  static isAuthenticated(): boolean {
    return !!sessionStorage.getItem('access_token');
  }
}
