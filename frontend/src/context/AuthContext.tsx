import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { SafeUser } from '../types/auth';
import { api } from '../services/api';

export interface AuthContextType {
  user: SafeUser | null;
  loading: boolean;
  error: string | null;
  loginStudent: (studentId: string, password: string) => Promise<SafeUser>;
  loginAdmin: (username: string, password: string) => Promise<SafeUser>;
  registerStudent: (fullName: string, batchNumber: string) => Promise<SafeUser>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore session on load via GET /api/auth/me
    const initAuth = async () => {
      try {
        const res = await api.getMe();
        if (res.status === 'success' && res.data?.user) {
          setUser(res.data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const loginStudent = async (studentId: string, password: string): Promise<SafeUser> => {
    setError(null);
    try {
      const res = await api.studentLogin(studentId, password);
      if (res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error(res.message || 'Login failed');
    } catch (err: any) {
      const msg = err.message || 'Unable to connect to competition server';
      setError(msg);
      throw new Error(msg);
    }
  };

  const loginAdmin = async (username: string, password: string): Promise<SafeUser> => {
    setError(null);
    try {
      const res = await api.adminLogin(username, password);
      if (res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error(res.message || 'Login failed');
    } catch (err: any) {
      const msg = err.message || 'Unable to connect to competition server';
      setError(msg);
      throw new Error(msg);
    }
  };

  const registerStudent = async (fullName: string, batchNumber: string): Promise<SafeUser> => {
    setError(null);
    try {
      const res = await api.registerStudent(fullName, batchNumber);
      if (res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error(res.message || 'Registration failed');
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setUser(null);
      setError(null);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginStudent,
        loginAdmin,
        registerStudent,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
