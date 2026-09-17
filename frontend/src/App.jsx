import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { DashboardPage } from './pages/dashboard/DashboardPage.jsx';
import { AttendanceDashboardPage } from './pages/attendance/AttendanceDashboardPage.jsx';
import { LeaveManagementPage } from './pages/leaves/LeaveManagementPage.jsx';
import { OrganizationListPage } from './pages/organizations/OrganizationListPage.jsx';
import { EmployeeListPage } from './pages/employees/EmployeeListPage.jsx';
import { UserListPage } from './pages/users/UserListPage.jsx';
import { DepartmentsPage } from './pages/departments/DepartmentsPage.jsx';
import { OnboardingDashboardPage } from './pages/onboarding/OnboardingDashboardPage.jsx';
import { OnboardingDetailPage } from './pages/onboarding/OnboardingDetailPage.jsx';
import { PayrollDashboardPage } from './pages/payroll/PayrollDashboardPage.jsx';
import { PayslipsPage } from './pages/payroll/PayslipsPage.jsx';
import { EmployeeDocumentsPage } from './pages/documents/EmployeeDocumentsPage.jsx';
import { HelpdeskPage } from './pages/helpdesk/HelpdeskPage.jsx';
import { EmployeeRequestsPage } from './pages/requests/EmployeeRequestsPage.jsx';
import { NotificationsPage } from './pages/notifications/NotificationsPage.jsx';
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
                path="attendance"
                element={
                  <PermissionRoute permission="attendance:read">
                    <AttendanceDashboardPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="leaves"
                element={
                  <PermissionRoute permission="leave:read">
                    <LeaveManagementPage />
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
                path="payroll"
                element={
                  <PermissionRoute permission={['payroll:read', 'payslip:read']}>
                    <PayrollDashboardPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="payslips"
                element={
                  <PermissionRoute permission="payslip:read">
                    <PayslipsPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="documents"
                element={
                  <PermissionRoute permission={['document:read', 'employee:read']}>
                    <EmployeeDocumentsPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="helpdesk"
                element={
                  <PermissionRoute permission={['helpdesk:read', 'employee:read']}>
                    <HelpdeskPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="requests"
                element={
                  <PermissionRoute permission={['request:read', 'employee:read']}>
                    <EmployeeRequestsPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="notifications"
                element={
                  <PermissionRoute permission={['notification:read', 'employee:read']}>
                    <NotificationsPage />
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
