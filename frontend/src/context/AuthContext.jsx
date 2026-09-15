import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('hrms_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('hrms_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session on mount if token exists
    const checkAuth = async () => {
      if (token) {
        try {
          const profile = await authService.getMe();
          setUser(profile);
          localStorage.setItem('hrms_user', JSON.stringify(profile));
        } catch (err) {
          console.warn('Session verification failed, logging out.', err);
          setUser(null);
          setToken(null);
          localStorage.removeItem('hrms_token');
          localStorage.removeItem('hrms_user');
        }
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for custom expired event from api client
    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('hrms:auth:expired', handleExpired);
    return () => window.removeEventListener('hrms:auth:expired', handleExpired);
  }, [token]);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('hrms_token', data.token);
    localStorage.setItem('hrms_user', JSON.stringify(data.user));
    return data;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout API failures
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.roleName === 'Admin' || user.roleName === 'SuperAdmin') return true;
    const permissions = Array.isArray(permission) ? permission : [permission];
    return permissions.some((p) => user.permissions?.includes(p));
  };

  const hasRole = (role) => {
    if (!user) return false;
    if (user.roleName === 'Admin' || user.roleName === 'SuperAdmin') return true;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.roleName);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        logout,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
