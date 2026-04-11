import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Permission } from '../../types';

interface ProtectedRouteProps {
  requiredPermission?: Permission;
  adminOnly?: boolean;
  employeeOnly?: boolean;
}

export default function ProtectedRoute({
  requiredPermission,
  adminOnly = false,
  employeeOnly = false,
}: ProtectedRouteProps) {
  const { user, isLoading, hasPermission, isAdmin } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/403" replace />;
  }

  // employeeOnly: allow any employee (ADMIN or EMPLOYEE role)
  if (employeeOnly && user.role !== 'ADMIN' && user.role !== 'EMPLOYEE') {
    return <Navigate to="/403" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}