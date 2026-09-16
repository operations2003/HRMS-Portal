import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { DashboardPage } from './pages/dashboard/DashboardPage.jsx';
import { OrganizationListPage } from './pages/organizations/OrganizationListPage.jsx';
import { EmployeeListPage } from './pages/employees/EmployeeListPage.jsx';
import { UserListPage } from './pages/users/UserListPage.jsx';
import { DepartmentsPage } from './pages/departments/DepartmentsPage.jsx';
import { OnboardingDashboardPage } from './pages/onboarding/OnboardingDashboardPage.jsx';
import { OnboardingDetailPage } from './pages/onboarding/OnboardingDetailPage.jsx';
import { ForbiddenPage } from './pages/common/ForbiddenPage.jsx';
import { NotFoundPage } from './pages/common/NotFoundPage.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';
import { LoadingSpinner } from './components/common/LoadingSpinner.jsx';

/**
 * Route guard for authenticated users
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullPage message="Verifying session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * Route guard enforcing specific RBAC permissions
 */
const PermissionRoute = ({ permission, children }) => {
  const { hasPermission, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage message="Verifying permissions..." />;
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
};

export const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Authenticated Application Layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              <Route
                path="dashboard"
                element={
                  <PermissionRoute permission="dashboard:read">
                    <DashboardPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="organizations"
                element={
                  <PermissionRoute permission="org:read">
                    <OrganizationListPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="employees"
                element={
                  <PermissionRoute permission="employee:read">
                    <EmployeeListPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="users"
                element={
                  <PermissionRoute permission="user:write">
                    <UserListPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="onboarding"
                element={
                  <PermissionRoute permission="onboarding:read">
                    <OnboardingDashboardPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="onboarding/:id"
                element={
                  <PermissionRoute permission="onboarding:read">
                    <OnboardingDetailPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="departments"
                element={
                  <PermissionRoute permission="dept:read">
                    <DepartmentsPage />
                  </PermissionRoute>
                }
              />

              <Route path="forbidden" element={<ForbiddenPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
