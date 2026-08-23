import React from 'react';
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MemberDetailPage } from './pages/MemberDetailPage';
import { VisitLoggerPage } from './pages/VisitLoggerPage';
import { AttendanceImportPage } from './pages/AttendanceImportPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/members/:id"
            element={
              <RequireAuth>
                <MemberDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/members/:id/visit"
            element={
              <RequireAuth>
                <VisitLoggerPage />
              </RequireAuth>
            }
          />
          <Route
            path="/attendance/import"
            element={
              <RequireAuth>
                <AttendanceImportPage />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
