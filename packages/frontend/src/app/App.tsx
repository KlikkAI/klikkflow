import { Toaster } from 'react-hot-toast';
import { Navigate, Route, Routes } from 'react-router-dom';
// Node registry is now initialized in main.tsx before React starts
import { nodeRegistry } from '@/core';
import { logger } from '@/core/services/LoggingService';
import GlobalErrorBoundary from '@/design-system/components/ErrorBoundary/GlobalErrorBoundary';
import AdminRoute from './components/Auth/AdminRoute';
import ProtectedRoute from './components/Auth/ProtectedRoute';
// Documentation components
import { DocsLayout } from './components/Documentation';
import Layout from './components/Layout/Layout';
import { RouteTransition } from './components/RouteTransition';
import { ScrollToTop } from './components/ScrollToTop';
import About from './pages/About';
import APIReference from './pages/APIReference';
import InstanceManagement from './pages/admin/InstanceManagement';
import Contact from './pages/Contact';
import Credentials from './pages/Credentials';
import Dashboard from './pages/Dashboard';
import Documentation from './pages/Documentation';
import {
  CloudProviders,
  DockerDeployment,
  DomainManagement,
  GettingStarted,
  IntegrationsGuide,
  KubernetesDeployment,
  PluginMarketplaceAPI,
  WorkflowExamples,
  WorkflowOptimizationAPI,
} from './pages/docs';
import Enterprise from './pages/Enterprise';
import Executions from './pages/Executions';
import Features from './pages/Features';
import IntegrationsPage from './pages/IntegrationsPage';
import { LandingPage } from './pages/LandingPage';
import Login from './pages/Login';
import PricingPage from './pages/PricingPage';
import Privacy from './pages/Privacy';
import Register from './pages/Register';
import Roadmap from './pages/Roadmap';
import SelfHosted from './pages/SelfHosted';
import Settings from './pages/Settings';
import Terms from './pages/Terms';
import WorkflowEditor from './pages/WorkflowEditor';

// Debug node registry on app startup (after initialization in main.tsx)
if (import.meta.env.DEV) {
  logger.info(
    '🚀 App.tsx - Node registry already initialized in main.tsx',
    nodeRegistry.getStatistics()
  );
  logger.info('🚀 App.tsx - Available node types', {
    nodeTypes: nodeRegistry.getAllNodeTypeDescriptions().map((d) => d.name),
  });

  // Expose registry to window for debugging
  (window as any).nodeRegistry = nodeRegistry;
}

function App() {
  return (
    <GlobalErrorBoundary>
      <ScrollToTop />
      <RouteTransition>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Product Pages */}
          <Route path="/features" element={<Features />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/enterprise" element={<Enterprise />} />
          <Route path="/self-hosted" element={<SelfHosted />} />
          <Route path="/roadmap" element={<Roadmap />} />

          {/* Developer Pages */}
          <Route path="/documentation" element={<Documentation />} />

          {/* Documentation Routes with Layout */}
          <Route path="/docs" element={<DocsLayout />}>
            <Route index element={<Navigate to="/documentation" replace />} />

            {/* Getting Started */}
            <Route path="getting-started" element={<GettingStarted />} />
            <Route path="integrations-guide" element={<IntegrationsGuide />} />
            <Route path="workflow-examples" element={<WorkflowExamples />} />

            {/* Deployment */}
            <Route path="deployment/docker" element={<DockerDeployment />} />
            <Route path="deployment/kubernetes" element={<KubernetesDeployment />} />
            <Route path="deployment/cloud" element={<CloudProviders />} />
            <Route path="deployment/domain-management" element={<DomainManagement />} />

            {/* API Reference */}
            <Route path="api/plugin-marketplace" element={<PluginMarketplaceAPI />} />
            <Route path="api/workflow-optimization" element={<WorkflowOptimizationAPI />} />
          </Route>

          <Route path="/api-reference" element={<APIReference />} />
          <Route path="/api" element={<APIReference />} />

          {/* Company Pages */}
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

          {/* Legal Pages */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Protected App Routes */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="workflow/:id?" element={<WorkflowEditor />} />
            <Route path="executions" element={<Executions />} />
            <Route path="credentials" element={<Credentials />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Admin Routes */}
          <Route
            path="/app/admin/instances"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout />
                </AdminRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<InstanceManagement />} />
          </Route>

          {/* Legacy redirects for authenticated users */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/workflow/*" element={<Navigate to="/app/workflow" replace />} />
          <Route path="/executions" element={<Navigate to="/app/executions" replace />} />
          <Route path="/credentials" element={<Navigate to="/app/credentials" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          {/* Catch all route - redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouteTransition>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </GlobalErrorBoundary>
  );
}

export default App;
