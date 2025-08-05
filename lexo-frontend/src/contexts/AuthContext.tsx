import React, { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthAPI } from '../api/auth';
import type { User } from '../api/auth';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AuthAPI.migrateTokenStorage();
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      if (AuthAPI.isAuthenticated()) {
        const currentUser = await AuthAPI.getCurrentUser();
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      AuthAPI.logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    await AuthAPI.login({ email, password });
    const currentUser = await AuthAPI.getCurrentUser();
    setUser(currentUser);
  };

  const register = async (email: string, username: string, password: string) => {
    await AuthAPI.register({ email, username, password });
    await login(email, password);
  };

  const logout = async () => {
    await AuthAPI.logout();
    setUser(null);
  };

  const logoutAllDevices = async () => {
    await AuthAPI.logoutAllDevices();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    logoutAllDevices,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
