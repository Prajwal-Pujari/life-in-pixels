import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import AdminPage from './pages/AdminPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import ProtectedRoute from './components/ProtectedRoute';

// Import all CSS files for global styling
import './App.css';
import './admin-button-styles.css';
import './attendance-modal-styles.css';
import './attendance-status-colors.css';
import './user-management-styles.css';
import './export-center-styles.css';
import './telegram-button-styles.css';
import './user-approval-styles.css';
import './calendar-page-styles.css';
import './login-page-styles.css';

interface User {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'employee';
  employeeId: string;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <h1 className="login-title">Loading...</h1>
          </div>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/calendar" replace />
          ) : (
            <LoginPage onLogin={handleLogin} />
          )
        }
      />

      <Route
        path="/auth/callback"
        element={<OAuthCallbackPage onLogin={handleLogin} />}
      />

      {/* Protected Routes */}
      <Route
        path="/calendar"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <CalendarPage
              token={token!}
              user={user!}
              onLogout={handleLogout}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            requiredRole="admin"
            userRole={user?.role}
          >
            <AdminPage
              token={token!}
              user={user!}
              onLogout={handleLogout}
            />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/calendar" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;