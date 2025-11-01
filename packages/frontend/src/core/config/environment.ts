// Environment configuration service
export interface EnvironmentConfig {
  apiBaseUrl: string;
  environment: 'development' | 'staging' | 'production';
  enableDebugLogs: boolean;
  features: {
    aiAssistant: boolean;
    collaboration: boolean;
    analytics: boolean;
  };
}

const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = import.meta.env;

  return {
    // Fallback to backend port 5000 if VITE_API_BASE_URL not set
    apiBaseUrl: env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    environment: (env.VITE_NODE_ENV as any) || 'development',
    enableDebugLogs: env.VITE_DEBUG_LOGS === 'true',
    features: {
      aiAssistant: env.VITE_FEATURE_AI_ASSISTANT !== 'false',
      collaboration: env.VITE_FEATURE_COLLABORATION !== 'false',
      analytics: env.VITE_FEATURE_ANALYTICS !== 'false',
    },
  };
};

export const config = getEnvironmentConfig();

export default config;
