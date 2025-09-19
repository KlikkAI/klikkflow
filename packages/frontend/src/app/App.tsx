import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout/Layout";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import GlobalErrorBoundary from "@/design-system/components/ErrorBoundary/GlobalErrorBoundary";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import WorkflowEditor from "./pages/WorkflowEditor";
import Executions from "./pages/Executions";
import Settings from "./pages/Settings";
import Credentials from "./pages/Credentials";
import { LandingPage } from "./pages/LandingPage";

// Node registry is now initialized in main.tsx before React starts
import { nodeRegistry } from "@/core";
import { logger } from "@/core/services/LoggingService";

// Debug node registry on app startup (after initialization in main.tsx)
if (import.meta.env.DEV) {
  logger.info(
    "🚀 App.tsx - Node registry already initialized in main.tsx",
    nodeRegistry.getStatistics(),
  );
  logger.info("🚀 App.tsx - Available node types", {
    nodeTypes: nodeRegistry.getAllNodeTypeDescriptions().map((d) => d.name),
  });

  // Expose registry to window for debugging
  (window as any).nodeRegistry = nodeRegistry;
  console.log("🔧 Node registry exposed to window.nodeRegistry for debugging");
}

function App() {
  return (
    <GlobalErrorBoundary>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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

        {/* Legacy redirects for authenticated users */}
        <Route
          path="/dashboard"
          element={<Navigate to="/app/dashboard" replace />}
        />
        <Route
          path="/workflow/*"
          element={<Navigate to="/app/workflow" replace />}
        />
        <Route
          path="/executions"
          element={<Navigate to="/app/executions" replace />}
        />
        <Route
          path="/credentials"
          element={<Navigate to="/app/credentials" replace />}
        />
        <Route
          path="/settings"
          element={<Navigate to="/app/settings" replace />}
        />

        {/* Catch all route - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#363636",
            color: "#fff",
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />
    </GlobalErrorBoundary>
  );
}

export default App;
