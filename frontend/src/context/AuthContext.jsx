import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService.js';
import { attendanceService } from '../services/attendanceService.js';

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
  const [todayAttendanceRecord, setTodayAttendanceRecord] = useState(null);

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
      setTodayAttendanceRecord(null);
    };
    window.addEventListener('hrms:auth:expired', handleExpired);
    return () => window.removeEventListener('hrms:auth:expired', handleExpired);
  }, [token]);

  const refreshWorkdayStatus = useCallback(async () => {
    if (!token) {
      setTodayAttendanceRecord(null);
      return;
    }
    try {
      const res = await attendanceService.getMyTodayRecord();
      if (res && res.record !== undefined) {
        setTodayAttendanceRecord(res.record);
      } else if (res && res.todayRecord !== undefined) {
        setTodayAttendanceRecord(res.todayRecord);
      }
    } catch {
      // Non-blocking
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      refreshWorkdayStatus();
    } else {
      setTodayAttendanceRecord(null);
    }

    const handleAttendanceUpdated = (e) => {
      if (e?.detail) {
        setTodayAttendanceRecord(e.detail);
      } else {
        refreshWorkdayStatus();
      }
    };
    window.addEventListener('hrms:attendance:updated', handleAttendanceUpdated);
    return () => window.removeEventListener('hrms:attendance:updated', handleAttendanceUpdated);
  }, [token, refreshWorkdayStatus]);

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
      setTodayAttendanceRecord(null);
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    const userRoleStr = (user.roleName || user.role?.name || user.role || '').toLowerCase().trim();
    if (['admin', 'superadmin', 'orgadmin'].includes(userRoleStr)) return true;
    const permissions = (Array.isArray(permission) ? permission : [permission]).map((p) =>
      (typeof p === 'string' ? p : '').toLowerCase().trim()
    );
    const userPerms = Array.isArray(user.permissions)
      ? user.permissions.map((p) => (typeof p === 'string' ? p : '').toLowerCase().trim())
      : [];
    return permissions.some((p) => userPerms.includes(p));
  };

  const hasRole = (role) => {
    if (!user) return false;
    const userRoleStr = (user.roleName || user.role?.name || user.role || '').toLowerCase().trim();
    if (['admin', 'superadmin', 'orgadmin'].includes(userRoleStr)) return true;
    const targetRoles = (Array.isArray(role) ? role : [role]).map((r) =>
      (typeof r === 'string' ? r : '').toLowerCase().trim()
    );
    return targetRoles.includes(userRoleStr);
  };

  const canManageTraining = () => {
    if (!user) return false;
    const userRoleStr = (user.roleName || user.role?.name || user.role || '').toLowerCase().trim();
    if (['admin', 'superadmin', 'orgadmin'].includes(userRoleStr)) return true;

    // Any role with L&D or Training in title
    if (
      userRoleStr.includes('ld') ||
      userRoleStr.includes('l&d') ||
      userRoleStr.includes('learning') ||
      userRoleStr.includes('training') ||
      userRoleStr.includes('trainer')
    ) {
      return true;
    }

    // Personnel in Learning & Development department
    const deptStr = (
      user.departmentName ||
      user.department?.name ||
      user.department ||
      user.departmentCode ||
      user.deptId ||
      ''
    ).toLowerCase().trim();

    return (
      deptStr === 'learning & development' ||
      deptStr === 'learning and development' ||
      deptStr.includes('learning') ||
      deptStr.includes('l&d') ||
      deptStr === 'ld' ||
      deptStr === 'dept-ld'
    );
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updatedFields };
      try {
        localStorage.setItem('hrms_user', JSON.stringify(updated));
      } catch (err) {
        console.warn('Unable to persist updated user to localStorage (quota or storage error):', err);
      }
      return updated;
    });
  };

  const userRoleStr = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isAdmin = ['admin', 'superadmin', 'orgadmin'].includes(userRoleStr);

  const hasCheckedInToday = Boolean(todayAttendanceRecord?.checkIn);
  const hasCheckedOutToday = Boolean(todayAttendanceRecord?.checkOut);

  // When HR, Employee, or Manager logs out for the day (or has not logged in):
  // isLoggedOutForDay: true if employee has punched out today
  // isWorkdayActive: true if Admin OR actively checked in and not checked out
  // canOperate: true if Admin OR actively checked in and not checked out
  const isLoggedOutForDay = !isAdmin && hasCheckedOutToday;
  const isWorkdayActive = isAdmin || (hasCheckedInToday && !hasCheckedOutToday);
  const canOperate = isWorkdayActive;

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
        canManageTraining,
        updateUser,
        todayAttendanceRecord,
        isLoggedOutForDay,
        isWorkdayActive,
        canOperate,
        refreshWorkdayStatus,
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
