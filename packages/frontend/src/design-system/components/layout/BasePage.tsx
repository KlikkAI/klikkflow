import { ArrowLeftOutlined } from '@ant-design/icons';
import { Breadcrumb, Button, Card, Space } from 'antd';
import type React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/design-system/utils';

interface BreadcrumbItem {
  title: string;
  href?: string;
  onClick?: () => void;
}

interface PageAction {
  label: string;
  onClick: () => void;
  type?: 'default' | 'primary' | 'dashed' | 'link' | 'text';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}

interface BasePageProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: PageAction[];
  backButton?: {
    show: boolean;
    onClick?: () => void;
    label?: string;
  };
  loading?: boolean;
  error?: string | null;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  maxWidth?: 'default' | 'wide' | 'full';
  children: ReactNode;
}

/**
 * Base page component that eliminates duplication across page layouts.
 * Provides consistent header structure, breadcrumbs, actions, and content area.
 */
export const BasePage: React.FC<BasePageProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  backButton,
  loading = false,
  error = null,
  className = '',
  headerClassName = '',
  contentClassName = '',
  maxWidth = 'default',
  children,
}) => {
  const renderBreadcrumbs = () => {
    if (!breadcrumbs || breadcrumbs.length === 0) {
      return null;
    }

    const items = breadcrumbs.map((item, _index) => ({
      title: item.href ? (
        <a
          href={item.href}
          onClick={(e) => {
            if (item.onClick) {
              e.preventDefault();
              item.onClick();
            }
          }}
          className="text-blue-400 hover:text-blue-300"
        >
          {item.title}
        </a>
      ) : (
        <span className="text-gray-400">{item.title}</span>
      ),
    }));

    return (
      <Breadcrumb
        items={items}
        className="mb-4 [&_.ant-breadcrumb-link]:text-gray-400 [&_.ant-breadcrumb-separator]:text-gray-500"
      />
    );
  };

  const renderActions = () => {
    if (!actions || actions.length === 0) {
      return null;
    }

    return (
      <Space>
        {actions.map((action) => (
          <Button
            key={action.label}
            type={action.type || 'default'}
            onClick={action.onClick}
            loading={action.loading}
            disabled={action.disabled}
            icon={action.icon}
            className={cn(
              'bg-gray-700 border-gray-600 text-gray-200',
              'hover:bg-gray-600 hover:border-gray-500',
              action.type === 'primary' && 'bg-blue-600 border-blue-600 hover:bg-blue-500'
            )}
          >
            {action.label}
          </Button>
        ))}
      </Space>
    );
  };

  const renderBackButton = () => {
    if (!backButton?.show) {
      return null;
    }

    return (
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={backButton.onClick || (() => window.history.back())}
        className="text-gray-400 hover:text-gray-200 mb-4"
      >
        {backButton.label || 'Back'}
      </Button>
    );
  };

  const renderError = () => {
    if (!error) {
      return null;
    }

    return (
      <Card className="mb-6 bg-red-900/20 border-red-700">
        <div className="text-red-400">
          <h4 className="text-lg font-semibold mb-2">Error</h4>
          <p>{error}</p>
        </div>
      </Card>
    );
  };

  const renderHeader = () => (
    <div className={cn('mb-6', headerClassName)}>
      {renderBreadcrumbs()}
      {renderBackButton()}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          {subtitle && <p className="text-lg text-gray-400">{subtitle}</p>}
        </div>

        <div className="flex-shrink-0">{renderActions()}</div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <Card className="bg-gray-800 border-gray-700">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading...</p>
            </div>
          </div>
        </Card>
      );
    }

    return <div className={cn('space-y-6', contentClassName)}>{children}</div>;
  };

  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'full':
        return 'max-w-full';
      case 'wide':
        return 'max-w-[1920px]';
      default:
        return 'max-w-7xl';
    }
  };

  return (
    <div className={cn('min-h-screen bg-gray-900 p-4', className)}>
      <div className={cn(getMaxWidthClass(), 'mx-auto')}>
        {renderHeader()}
        {renderError()}
        {renderContent()}
      </div>
    </div>
  );
};

/**
 * Page section component for consistent content organization
 */
interface PageSectionProps {
  title?: string;
  subtitle?: string;
  actions?: PageAction[];
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

export const PageSection: React.FC<PageSectionProps> = ({
  title,
  subtitle,
  actions,
  loading = false,
  className = '',
  children,
}) => {
  const renderSectionHeader = () => {
    if (!(title || actions)) {
      return null;
    }

    return (
      <div className="flex items-start justify-between mb-4">
        {title && (
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
          </div>
        )}

        {actions && (
          <Space>
            {actions.map((action) => (
              <Button
                key={action.label}
                type={action.type || 'default'}
                onClick={action.onClick}
                loading={action.loading}
                disabled={action.disabled}
                icon={action.icon}
                size="small"
                className={cn(
                  'bg-gray-700 border-gray-600 text-gray-200',
                  'hover:bg-gray-600 hover:border-gray-500',
                  action.type === 'primary' && 'bg-blue-600 border-blue-600 hover:bg-blue-500'
                )}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      );
    }

    return children;
  };

  return (
    <Card className={cn('bg-gray-800 border-gray-700', className)}>
      {renderSectionHeader()}
      {renderContent()}
    </Card>
  );
};

/**
 * Statistics card component for dashboard-style layouts
 */
interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = '',
}) => {
  return (
    <Card className={cn('bg-gray-800 border-gray-700', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center mt-2">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-gray-500 text-sm ml-2">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && <div className="text-gray-400 text-2xl">{icon}</div>}
      </div>
    </Card>
  );
};

export default BasePage;
