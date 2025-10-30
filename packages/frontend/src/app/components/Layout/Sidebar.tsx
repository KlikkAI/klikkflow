import type React from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/core/stores/authStore';
import { useLeanWorkflowStore } from '@/core/stores/leanWorkflowStore';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { createNewWorkflow } = useLeanWorkflowStore();

  // Check if user has admin role
  const userRole = user?.role;
  const hasAdminRole = userRole ? ['admin', 'super_admin'].includes(userRole) : false;

  const navigation = [
    { name: 'Workflows', href: '/dashboard', icon: '🔄' },
    { name: 'Executions', href: '/executions', icon: '▶️' },
    { name: 'Credentials', href: '/credentials', icon: '🔐' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
    ...(hasAdminRole ? [{ name: 'Instances', href: '/app/admin/instances', icon: '🖥️' }] : []),
  ];

  const handleCreateWorkflow = async () => {
    const name = prompt('Enter workflow name:');
    if (name) {
      if (name.trim().length === 0) {
        toast.error('Please enter a valid workflow name.');
        return;
      }

      try {
        await createNewWorkflow(name.trim(), navigate);
        toast.success('Workflow created successfully!');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create workflow';
        toast.error(errorMessage);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Navigation will be handled by ProtectedRoute when auth state changes
    } catch (_error) {}
  };

  return (
    <div
      className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white/10 backdrop-blur-md border-r border-white/20 transition-all duration-300 ease-in-out flex flex-col h-full`}
    >
      {/* Header Section */}
      <div className="border-b border-white/20 p-4">
        <div className="flex flex-col items-center justify-between">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="text-lg">{isCollapsed ? '→' : '←'}</span>
          </button>
          {!isCollapsed && (
            <Link
              to="/"
              className="text-xl font-bold text-white flex items-center space-x-2 hover:text-blue-300 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                <span className="text-white text-sm">🔄</span>
              </div>
              <span>KlikkFlow</span>
            </Link>
          )}
          {isCollapsed && (
            <Link to="/" className="text-2xl" title="KlikkFlow">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center hover:scale-110 transition-transform">
                <span className="text-white">🔄</span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {!isCollapsed && (
        <div className="p-4 border-b border-white/20">
          <button
            onClick={handleCreateWorkflow}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:scale-105 transition-all duration-300 flex items-center justify-center font-medium shadow-lg"
          >
            + Create Workflow
          </button>
        </div>
      )}

      {isCollapsed && (
        <div className="p-2 border-b border-white/20">
          <button
            onClick={handleCreateWorkflow}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg hover:scale-105 transition-all duration-300 flex items-center justify-center shadow-lg"
            title="Create Workflow"
          >
            <span className="text-lg">+</span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        <div className={`${isCollapsed ? 'px-2 py-2' : 'px-4 py-4'}`}>
          <ul className="space-y-2">
            {navigation.map((item: { name: string; href: string; icon: string }) => (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={`flex items-center ${isCollapsed ? 'px-2 py-3 justify-center' : 'px-4 py-2'} text-sm font-medium rounded-lg transition-all duration-200 ${
                    location.pathname === item.href
                      ? 'bg-white/20 text-blue-300 backdrop-blur-sm border border-white/30'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <span className={`text-lg ${isCollapsed ? '' : 'mr-3'}`}>{item.icon}</span>
                  {!isCollapsed && (
                    <span className="transition-opacity duration-200">{item.name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User Section */}
      <div className="border-t border-white/20 p-4">
        {!isCollapsed && (
          <div className="space-y-4">
            {/* User Info */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-lg">
                {user?.firstName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-300 truncate">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-start space-x-3 px-3 py-2.5 text-sm text-slate-300 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-all duration-200 border border-white/20 hover:border-red-500/50 backdrop-blur-sm"
              title="Logout"
            >
              <span className="text-base">🚪</span>
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        )}
        {isCollapsed && (
          <div className="space-y-3">
            {/* User Avatar */}
            <div className="flex justify-center">
              <div
                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                title={`${user?.firstName} ${user?.lastName} - ${user?.email || 'user@example.com'}`}
              >
                {user?.firstName?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 border border-gray-200 hover:border-red-200"
              title="Sign out"
            >
              <span className="text-base">🚪</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
