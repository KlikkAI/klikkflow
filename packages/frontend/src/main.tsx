import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App.tsx';
import './app/styles/global.css';
import './app/styles/landing-animations.css';

// Ensure dark mode is applied immediately
if (!document.documentElement.classList.contains('dark')) {
  document.documentElement.classList.add('dark');
}

// Initialize node registry and extensions BEFORE React app starts
import '@/app/node-extensions'; // Initialize component factory and registry
import '@/core/nodes/definitions'; // Register core node definitions (includes unified Transform node)
import '@/app/data/nodes/communication/gmail'; // Register Gmail node - CRITICAL: Must be before React

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Clear any loading placeholders before rendering
const rootElement = document.getElementById('root')!;
rootElement.innerHTML = '';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          // Primary brand colors (blue-purple gradient)
          colorPrimary: '#3b82f6', // blue-500
          colorInfo: '#3b82f6',
          colorSuccess: '#10b981', // green-500
          colorWarning: '#fb923c', // orange-400
          colorError: '#ef4444', // red-500

          // Background colors with transparency for glassmorphism
          colorBgContainer: 'rgba(255, 255, 255, 0.15)', // 3x more visible for normal state
          colorBgElevated: 'rgba(255, 255, 255, 0.20)', // 2.5x more visible for elevated surfaces
          colorBgLayout: '#0f172a', // slate-900 (for gradient base)

          // Border colors with transparency
          colorBorder: 'rgba(255, 255, 255, 0.35)', // 75% more visible borders
          colorBorderSecondary: 'rgba(255, 255, 255, 0.25)', // More visible secondary borders

          // Text colors
          colorText: '#ffffff',
          colorTextSecondary: '#cbd5e1', // slate-300
          colorTextTertiary: '#94a3b8', // slate-400
          colorTextQuaternary: '#64748b', // slate-500

          // Border radius for modern look
          borderRadius: 8,
          borderRadiusLG: 12,

          // Font settings
          fontSize: 14,
          fontSizeHeading1: 32,
          fontSizeHeading2: 24,
          fontSizeHeading3: 20,
        },
        components: {
          Card: {
            colorBgContainer: 'rgba(255, 255, 255, 0.15)', // 3x more visible
            colorBorderSecondary: 'rgba(255, 255, 255, 0.35)', // Visible borders
          },
          Modal: {
            contentBg: 'rgba(255, 255, 255, 0.15)', // 3x more visible
            headerBg: 'rgba(255, 255, 255, 0.15)', // 3x more visible
          },
          Table: {
            headerBg: 'rgba(255, 255, 255, 0.20)', // 2.5x more visible
            rowHoverBg: 'rgba(255, 255, 255, 0.25)', // 2.5x more visible hover
          },
          Input: {
            colorBgContainer: 'rgba(255, 255, 255, 0.15)', // 50% more visible
            colorBorder: 'rgba(255, 255, 255, 0.4)', // Stronger borders
            activeBorderColor: '#3b82f6',
          },
          Select: {
            colorBgContainer: 'rgba(255, 255, 255, 0.15)', // 50% more visible
            colorBorder: 'rgba(255, 255, 255, 0.4)', // Stronger borders
          },
          Button: {
            colorBgContainer: 'rgba(255, 255, 255, 0.15)', // 50% more visible
            colorBorder: 'rgba(255, 255, 255, 0.35)', // Visible borders
            primaryShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
          },
        },
      }}
    >
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    </ConfigProvider>
  </React.StrictMode>
);
