import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Can - Declarative RBAC Component
 * Renders children only if the logged-in user has the required permission or role
 *
 * Usage:
 *   <Can permission="org:write">
 *     <Button>Add Organization</Button>
 *   </Can>
 */
export const Can = ({ permission, role, children, fallback = null }) => {
  const { hasPermission, hasRole } = useAuth();

  let isAllowed = true;

  if (permission) {
    isAllowed = hasPermission(permission);
  }

  if (role && isAllowed) {
    isAllowed = hasRole(role);
  }

  if (!isAllowed) {
    return fallback;
  }

  return <>{children}</>;
};
