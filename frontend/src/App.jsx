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
import { EmployeeDocumentsPage } from './pages/documents/EmployeeDocumentsPage.jsx';
import { HelpdeskPage } from './pages/helpdesk/HelpdeskPage.jsx';
import { EmployeeRequestsPage } from './pages/requests/EmployeeRequestsPage.jsx';
import { PayrollPage } from './pages/payroll/PayrollPage.jsx';
import { PoliciesPage } from './pages/policies/PoliciesPage.jsx';
import { ProfilePage } from './pages/profile/ProfilePage.jsx';
import { NotificationsPage } from './pages/notifications/NotificationsPage.jsx';
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage.jsx';
import { TeamManagementPage } from './pages/team/TeamManagementPage.jsx';
import { PerformancePage } from './pages/performance/PerformancePage.jsx';
import { ApprovalsPage } from './pages/approvals/ApprovalsPage.jsx';
import { HROperationsPage } from './pages/hr/HROperationsPage.jsx';
import { ResignationPage } from './pages/exit/ResignationPage.jsx';
import { ExitChecklistPage } from './pages/exit/ExitChecklistPage.jsx';
import { OffboardingPage } from './pages/exit/OffboardingPage.jsx';
import { FnFSettlementPage } from './pages/exit/FnFSettlementPage.jsx';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.jsx';
import { RolesPermissionsPage } from './pages/admin/RolesPermissionsPage.jsx';
import { TasksPage } from './pages/tasks/TasksPage.jsx';
import { TrainingPage } from './pages/training/TrainingPage.jsx';
import { EngagementPage } from './pages/engagement/EngagementPage.jsx';
import { ProbationDashboardPage } from './pages/probation/ProbationDashboardPage.jsx';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage.jsx';
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
 * Route guard enforcing specific RBAC permissions or roles
 */
const PermissionRoute = ({ permission, roles, children }) => {
  const { hasPermission, hasRole, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage message="Verifying permissions..." />;
  }

  if (roles && !hasRole(roles)) {
    return <Navigate to="/forbidden" replace />;
  }

  if (permission && !hasPermission(permission)) {
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
                path="documents"
                element={
                  <PermissionRoute permission={['document:read', 'employee:read']}>
                    <EmployeeDocumentsPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="payroll"
                element={
                  <PermissionRoute permission="employee:read">
                    <PayrollPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="policies"
                element={
                  <PermissionRoute permission="employee:read">
                    <PoliciesPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="profile"
                element={
                  <PermissionRoute permission="employee:read">
                    <ProfilePage />
                  </PermissionRoute>
                }
              />

              <Route
                path="helpdesk"
                element={
                  <PermissionRoute permission={['helpdesk:read', 'request:read', 'employee:read']}>
                    <HelpdeskPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="requests"
                element={<Navigate to="/helpdesk?tab=requests" replace />}
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

              {/* Phase 6 Routes */}
              <Route
                path="manager"
                element={
                  <PermissionRoute roles={['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']}>
                    <ManagerDashboardPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="team"
                element={
                  <PermissionRoute roles={['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']}>
                    <TeamManagementPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="performance"
                element={
                  <PermissionRoute permission={['performance:read', 'employee:read']}>
                    <PerformancePage />
                  </PermissionRoute>
                }
              />

              <Route
                path="approvals"
                element={
                  <PermissionRoute roles={['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']}>
                    <ApprovalsPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="hr-operations"
                element={
                  <PermissionRoute roles={['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']}>
                    <HROperationsPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="hr"
                element={<Navigate to="/hr-operations" replace />}
              />

              {/* Phase 7 Routes */}
              <Route
                path="resignation"
                element={
                  <PermissionRoute permission={['exit:read', 'exit:write', 'employee:read']}>
                    <ResignationPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="exit-checklist"
                element={
                  <PermissionRoute permission={['exit:read', 'exit:write', 'employee:read']}>
                    <ExitChecklistPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="offboarding"
                element={
                  <PermissionRoute permission={['exit:read', 'exit:admin', 'employee:read']}>
                    <OffboardingPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="fnf"
                element={
                  <PermissionRoute permission={['exit:read', 'employee:read']}>
                    <FnFSettlementPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="fnf-settlement"
                element={<Navigate to="/fnf" replace />}
              />

              <Route
                path="admin-settings"
                element={
                  <PermissionRoute roles={['Admin', 'SuperAdmin', 'OrgAdmin']}>
                    <AdminSettingsPage />
                  </PermissionRoute>
                }
              />

              <Route
                path="roles"
                element={
                  <PermissionRoute roles={['Admin', 'SuperAdmin', 'OrgAdmin']}>
                    <RolesPermissionsPage />
                  </PermissionRoute>
                }
              />

              {/* Tasks & Work Management */}
              <Route
                path="tasks"
                element={
                  <PermissionRoute permission={['task:read', 'employee:read']}>
                    <TasksPage />
                  </PermissionRoute>
                }
              />


              {/* Learning & Skill Development */}
              <Route
                path="training"
                element={
                  <PermissionRoute permission={['training:read', 'employee:read']}>
                    <TrainingPage />
                  </PermissionRoute>
                }
              />

              {/* Employee Engagement & Communication */}
              <Route
                path="engagement"
                element={
                  <PermissionRoute permission={['engagement:read', 'employee:read']}>
                    <EngagementPage />
                  </PermissionRoute>
                }
              />

              {/* Probation & Confirmation */}
              <Route
                path="probation"
                element={
                  <PermissionRoute roles={['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']}>
                    <ProbationDashboardPage />
                  </PermissionRoute>
                }
              />

              {/* HR Analytics & Workforce Intelligence */}
              <Route
                path="analytics"
                element={
                  <PermissionRoute roles={['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']}>
                    <AnalyticsPage />
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
