import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const UserProfile: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-4 p-3 bg-white rounded-lg shadow-md border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-700">{user.username}</span>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors font-medium border border-red-200"
        >
          Logout
        </button>
      </div>
    );
  }

  return null;
};
