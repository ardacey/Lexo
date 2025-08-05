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
  refresh_token: string;
  token_type: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export class AuthAPI {
  static migrateTokenStorage(): void {
    const oldToken = localStorage.getItem('token');
    if (oldToken && !localStorage.getItem('access_token')) {
      localStorage.removeItem('token');
    }
  }

  private static getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
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
    localStorage.setItem('access_token', authData.access_token);
    localStorage.setItem('refresh_token', authData.refresh_token);
    return authData;
  }

  static async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('access_token');
    if (!token) return null;

    try {
      let response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: this.getAuthHeaders(),
      });

      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          this.logout();
          return null;
        }

        response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: this.getAuthHeaders(),
        });
      }

      if (!response.ok) {
        this.logout();
        return null;
      }

      return response.json();
    } catch {
      this.logout();
      return null;
    }
  }

  static async refreshAccessToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        this.logout();
        return false;
      }

      const data: AccessTokenResponse = await response.json();
      localStorage.setItem('access_token', data.access_token);
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  static async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refresh_token');

    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        // Ignore errors during logout
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  static async logoutAllDevices(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout-all`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
    } catch {
      // Ignore errors
    } finally {
      this.logout();
    }
  }

  static getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  static isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  }
}
