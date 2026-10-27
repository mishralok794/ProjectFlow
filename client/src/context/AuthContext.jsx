import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setToken, getUser, setUser } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setCurrentUser] = useState(getUser());
  const [token, setAuthToken] = useState(getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyAuth() {
      if (token) {
        try {
          const profile = await api.getMe();
          setCurrentUser(profile);
          setUser(profile);
        } catch (err) {
          console.warn('Session expired or invalid token:', err.message);
          logout();
        }
      }
      setLoading(false);
    }
    verifyAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    setAuthToken(res.token);
    setToken(res.token);
    setCurrentUser(res.user);
    setUser(res.user);
    return res.user;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    setAuthToken(res.token);
    setToken(res.token);
    setCurrentUser(res.user);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setCurrentUser(null);
    setUser(null);
  };

  const updateProfile = (profile) => {
    setCurrentUser(profile);
    setUser(profile);
  };

  // Fast quick switcher for demo / grading
  const quickSwitchUser = async (email, password) => {
    return await login(email, password);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, quickSwitchUser, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
