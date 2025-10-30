/**
 * Admin Route Protection
 * Ensures user has admin or super_admin role
 */

import { Result } from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/core/stores/authStore';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute wrapper component
 * Protects routes that require admin privileges
 */
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isAuthenticated, getCurrentUser, isLoading } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    getCurrentUser();
  }, [getCurrentUser]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has admin role
  const userRole = user?.role;
  const hasAdminRole = userRole ? ['admin', 'super_admin'].includes(userRole) : false;

  if (!hasAdminRole) {
    // Show access denied page
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Result
          status="403"
          title="Access Denied"
          subTitle="You don't have permission to access this page. Administrator privileges are required."
          extra={
            <a href="/" className="ant-btn ant-btn-primary">
              Go to Dashboard
            </a>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
