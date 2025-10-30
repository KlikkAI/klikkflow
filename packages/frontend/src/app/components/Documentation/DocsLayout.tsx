/**
 * DocsLayout Component
 *
 * Provides the overall layout for documentation pages including sidebar,
 * breadcrumbs, and content area.
 */

import { ChevronRight, Edit, Home, Menu, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Footer } from '../Integrations/Landing/Footer';
import { Header } from '../Integrations/Landing/Header';
import { DocsSidebar } from './DocsSidebar';

export const DocsLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Generate breadcrumbs from current path
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Home', path: '/' }];

    let currentPath = '';
    for (const path of paths) {
      currentPath += `/${path}`;
      breadcrumbs.push({
        label: path
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        path: currentPath,
      });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  // Get "Edit on GitHub" link
  const getGitHubEditLink = () => {
    const pathMap: Record<string, string> = {
      '/docs/getting-started': 'docs/user-guide/GETTING_STARTED.md',
      '/docs/integrations-guide': 'docs/user-guide/INTEGRATIONS_GUIDE.md',
      '/docs/workflow-examples': 'docs/user-guide/WORKFLOW_EXAMPLES.md',
      '/docs/deployment/docker': 'docs/deployment/docker/README.md',
      '/docs/deployment/kubernetes': 'docs/deployment/kubernetes/README.md',
      '/docs/deployment/domain-management': 'docs/deployment/domain-management.md',
      '/docs/operations/monitoring': 'docs/operations/monitoring/README.md',
      '/docs/operations/logging': 'docs/operations/logging/README.md',
      '/docs/operations/scaling': 'docs/operations/scaling/README.md',
      '/docs/operations/troubleshooting': 'docs/operations/troubleshooting/README.md',
      '/docs/operations/backup-recovery': 'docs/operations/backup-recovery/README.md',
      '/docs/operations/tracing': 'docs/operations/tracing/README.md',
      '/docs/api/plugin-marketplace': 'docs/api/PLUGIN_MARKETPLACE_API.md',
      '/docs/api/workflow-optimization': 'docs/api/WORKFLOW_OPTIMIZATION_API.md',
    };

    const docPath = pathMap[location.pathname];
    if (docPath) {
      return `https://github.com/KlikkAI/klikkflow/edit/main/${docPath}`;
    }
    return null;
  };

  const githubEditLink = getGitHubEditLink();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex">
        {/* Mobile Sidebar Toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-20 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Sidebar - Desktop */}
        <div className="hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <DocsSidebar />
        </div>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <DocsSidebar className="h-full" />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumbs */}
            <nav
              className="flex items-center gap-2 text-sm text-gray-500 mb-6"
              aria-label="Breadcrumb"
            >
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.path} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="w-4 h-4" />}
                  {index === 0 ? (
                    <Link to={crumb.path} className="flex items-center gap-1 hover:text-gray-700">
                      <Home className="w-4 h-4" />
                      <span>{crumb.label}</span>
                    </Link>
                  ) : index === breadcrumbs.length - 1 ? (
                    <span className="text-gray-900 font-medium">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.path} className="hover:text-gray-700">
                      {crumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>

            {/* Page Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <Outlet />
            </div>

            {/* Page Footer Actions */}
            <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
              {githubEditLink && (
                <a
                  href={githubEditLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit this page on GitHub</span>
                </a>
              )}

              {/* Back to Top */}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Back to top ↑
              </button>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};
