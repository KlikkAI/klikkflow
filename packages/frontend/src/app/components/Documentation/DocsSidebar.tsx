/**
 * DocsSidebar Component
 *
 * Provides navigation for documentation pages with collapsible sections,
 * active page highlighting, and search functionality.
 */

import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code,
  FileText,
  GitBranch,
  Play,
  Search,
  Server,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface DocSection {
  title: string;
  icon: React.ElementType;
  items: DocItem[];
  defaultOpen?: boolean;
}

interface DocItem {
  title: string;
  path: string;
  badge?: string;
}

const docSections: DocSection[] = [
  {
    title: 'Getting Started',
    icon: Play,
    defaultOpen: true,
    items: [
      { title: 'Quick Start', path: '/docs/getting-started' },
      { title: 'Workflow Examples', path: '/docs/workflow-examples' },
      { title: 'Integrations Guide', path: '/docs/integrations-guide' },
    ],
  },
  {
    title: 'Deployment',
    icon: Cloud,
    items: [
      { title: 'Docker Deployment', path: '/docs/deployment/docker' },
      { title: 'Kubernetes', path: '/docs/deployment/kubernetes' },
      { title: 'Cloud Providers', path: '/docs/deployment/cloud' },
      { title: 'Domain & Subdomain Management', path: '/docs/deployment/domain-management' },
    ],
  },
  {
    title: 'Operations',
    icon: Server,
    items: [
      { title: 'Monitoring', path: '/docs/operations/monitoring' },
      { title: 'Logging', path: '/docs/operations/logging' },
      { title: 'Scaling', path: '/docs/operations/scaling' },
      { title: 'Troubleshooting', path: '/docs/operations/troubleshooting' },
      { title: 'Backup & Recovery', path: '/docs/operations/backup-recovery' },
      { title: 'Tracing', path: '/docs/operations/tracing' },
    ],
  },
  {
    title: 'API Reference',
    icon: Code,
    items: [
      { title: 'Plugin Marketplace API', path: '/docs/api/plugin-marketplace', badge: 'New' },
      { title: 'Workflow Optimization API', path: '/docs/api/workflow-optimization', badge: 'New' },
      { title: 'OpenAPI Specification', path: '/docs/api/openapi' },
    ],
  },
  {
    title: 'Architecture',
    icon: GitBranch,
    items: [
      { title: 'Enterprise Architecture', path: '/docs/architecture/enterprise' },
      { title: 'AI Agents System', path: '/docs/architecture/agents' },
    ],
  },
];

export const DocsSidebar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(docSections.filter((s) => s.defaultOpen).map((s) => s.title))
  );

  const toggleSection = (title: string) => {
    setOpenSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const isActive = (path: string) => location.pathname === path;

  // Filter items based on search query
  const filteredSections = docSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className={`w-64 bg-white border-r border-gray-200 overflow-y-auto ${className}`}>
      {/* Search */}
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isOpen = openSections.has(section.title);

          return (
            <div key={section.title} className="mb-4">
              {/* Section Header */}
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{section.title}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Section Items */}
              {isOpen && (
                <div className="mt-1 ml-6 space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive(item.path)
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>{item.title}</span>
                      {item.badge && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* No results message */}
        {searchQuery && filteredSections.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No documentation found</p>
            <p className="text-xs mt-1">Try a different search term</p>
          </div>
        )}
      </nav>

      {/* Help Links */}
      <div className="border-t border-gray-200 p-4 mt-auto">
        <div className="space-y-2">
          <Link
            to="/contact"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Need help?</span>
          </Link>
          <a
            href="https://github.com/KlikkAI/klikkflow"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span>GitHub Docs</span>
          </a>
        </div>
      </div>
    </div>
  );
};
