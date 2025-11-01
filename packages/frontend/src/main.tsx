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
