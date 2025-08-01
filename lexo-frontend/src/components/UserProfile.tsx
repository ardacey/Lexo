import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const UserProfile: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-4 p-4 bg-white rounded-lg shadow">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium">{user.username}</span>
        </div>
        <button
          onClick={logout}
          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  // Giriş yapmamış kullanıcılar için hiçbir şey gösterme
  return null;
};
