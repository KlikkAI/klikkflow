/**
 * Component Generator System
 *
 * Provides pattern-based code generation to eliminate
 * repetitive component creation across the codebase.
 *
 * Targets: Remaining 30+ duplicate component patterns
 */

import { Avatar, Button, Card, Empty, List, Space, Statistic, Table, Tag } from 'antd';
import type React from 'react';
import { ResponsiveGrid } from '../components/DynamicLayout';
import type { PropertyRendererConfig } from '../factories/PropertyRendererFactory';
import { cn } from '../utils';

export interface GeneratorConfig {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  className?: string;
  children?: GeneratorConfig[];
  title?: string;
  subtitle?: string;
  size?: string | number;
  hoverable?: boolean;
  actions?: React.ReactNode;
}

export interface CardConfig extends GeneratorConfig {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  cover?: React.ReactNode;
  hoverable?: boolean;
  variant?: 'outlined' | 'borderless';
  size?: 'default' | 'small';
}

export interface ListConfig<T = unknown> extends GeneratorConfig {
  items: T[];
  renderItem?: (item: T, index: number) => React.ReactNode;
  emptyText?: string;
  pagination?: false | { pageSize?: number; total?: number; current?: number };
  split?: boolean;
  size?: 'default' | 'large' | 'small';
}

export interface TableConfig<T = unknown> extends GeneratorConfig {
  columns: Array<{
    title: string;
    dataIndex: string;
    key: string;
    render?: (value: unknown, record: T) => React.ReactNode;
  }>;
  dataSource: T[];
  pagination?: false | { pageSize?: number; total?: number; current?: number };
  loading?: boolean;
  size?: 'large' | 'middle' | 'small';
  scroll?: { x?: number; y?: number };
}

export interface FormItemConfig extends GeneratorConfig {
  property: PropertyRendererConfig;
  layout?: 'horizontal' | 'vertical';
  labelCol?: { span: number };
  wrapperCol?: { span: number };
}

/**
 * Component Generator for Common UI Patterns
 * Static-only class pattern is intentional for utility generators
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility pattern for React component generation
export class ComponentGenerator {
  /**
   * Generate a card component
   */
  static generateCard(config: CardConfig): React.ReactElement {
    return (
      <Card
        key={config.id}
        title={config.title}
        extra={config.actions}
        cover={config.cover}
        hoverable={config.hoverable}
        variant={config.variant}
        size={config.size}
        className={cn('generated-card', config.className)}
        {...config.props}
      >
        {config.subtitle && (
          <p className="text-gray-600 dark:text-gray-400 mb-4">{config.subtitle}</p>
        )}
        {config.children && ComponentGenerator.generateChildren(config.children)}
      </Card>
    );
  }

  /**
   * Generate a list component
   */
  static generateList(config: ListConfig): React.ReactElement {
    return (
      <List
        key={config.id}
        dataSource={config.items}
        renderItem={
          config.renderItem ||
          ((item, index) => (
            <List.Item key={index}>
              {typeof item === 'object' ? JSON.stringify(item) : (item as React.ReactNode)}
            </List.Item>
          ))
        }
        locale={{ emptyText: config.emptyText || 'No data' }}
        pagination={config.pagination}
        split={config.split}
        size={config.size}
        className={cn('generated-list', config.className)}
        {...config.props}
      />
    );
  }

  /**
   * Generate a table component
   */
  static generateTable(config: TableConfig): React.ReactElement {
    return (
      <Table
        key={config.id}
        columns={config.columns}
        dataSource={config.dataSource}
        pagination={config.pagination}
        loading={config.loading}
        size={config.size}
        scroll={config.scroll}
        className={cn('generated-table', config.className)}
        {...config.props}
      />
    );
  }

  /**
   * Generate a stats grid
   */
  static generateStatsGrid(
    stats: Array<{
      title: string;
      value: string | number;
      suffix?: string;
      prefix?: string;
      precision?: number;
      valueStyle?: React.CSSProperties;
    }>
  ): React.ReactElement {
    return (
      <ResponsiveGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="1.5rem" className="stats-grid">
        {stats.map((stat) => (
          <Card key={stat.title} className="text-center">
            <Statistic
              title={stat.title}
              value={stat.value}
              suffix={stat.suffix}
              prefix={stat.prefix}
              precision={stat.precision}
              valueStyle={stat.valueStyle}
            />
          </Card>
        ))}
      </ResponsiveGrid>
    );
  }

  /**
   * Generate a tag list
   */
  static generateTagList(
    items: Array<{ label: string; value?: unknown; color?: string }>,
    config?: {
      closable?: boolean;
      onClose?: (item: { label: string; value?: unknown; color?: string }) => void;
      className?: string;
    }
  ): React.ReactElement {
    return (
      <Space wrap className={cn('tag-list', config?.className)}>
        {items.map((item) => (
          <Tag
            key={item.label}
            color={item.color}
            closable={config?.closable}
            onClose={() => config?.onClose?.(item)}
          >
            {item.label}
          </Tag>
        ))}
      </Space>
    );
  }

  /**
   * Generate an action bar
   */
  static generateActionBar(
    actions: Array<{
      label: string;
      type?: 'primary' | 'default' | 'dashed' | 'text' | 'link';
      danger?: boolean;
      icon?: React.ReactNode;
      onClick: () => void;
      disabled?: boolean;
      loading?: boolean;
    }>,
    align: 'left' | 'center' | 'right' = 'right'
  ): React.ReactElement {
    return (
      <div
        className={cn(
          'action-bar flex gap-2 py-2',
          align === 'left' && 'justify-start',
          align === 'center' && 'justify-center',
          align === 'right' && 'justify-end'
        )}
      >
        {actions.map((action) => (
          <Button
            key={action.label}
            type={action.type}
            danger={action.danger}
            icon={action.icon}
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
          >
            {action.label}
          </Button>
        ))}
      </div>
    );
  }

  /**
   * Generate an empty state
   */
  static generateEmptyState(
    title: string,
    description?: string,
    action?: {
      label: string;
      onClick: () => void;
      type?: 'primary' | 'default';
    },
    image?: React.ReactNode
  ): React.ReactElement {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        {image && <div className="mb-4">{image}</div>}
        <Empty
          description={
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
              {description && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
              )}
            </div>
          }
        >
          {action && (
            <Button type={action.type || 'primary'} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </Empty>
      </div>
    );
  }

  /**
   * Generate a user avatar with info
   */
  static generateUserCard(user: {
    name: string;
    email?: string;
    avatar?: string;
    status?: 'online' | 'offline' | 'away';
    role?: string;
    actions?: React.ReactNode;
  }): React.ReactElement {
    return (
      <Card size="small" className="user-card">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar src={user.avatar} size={48}>
              {user.name.charAt(0).toUpperCase()}
            </Avatar>
            {user.status && (
              <div
                className={cn(
                  'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white',
                  user.status === 'online' && 'bg-green-500',
                  user.status === 'offline' && 'bg-gray-400',
                  user.status === 'away' && 'bg-yellow-500'
                )}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {user.name}
            </h4>
            {user.email && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
            )}
            {user.role && <Tag color="blue">{user.role}</Tag>}
          </div>
          {user.actions && <div className="flex-shrink-0">{user.actions}</div>}
        </div>
      </Card>
    );
  }

  /**
   * Generate a metric card
   */
  static generateMetricCard(metric: {
    title: string;
    value: string | number;
    change?: {
      value: number;
      type: 'increase' | 'decrease';
    };
    icon?: React.ReactNode;
    description?: string;
  }): React.ReactElement {
    return (
      <Card className="metric-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{metric.title}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {metric.value}
            </p>
            {metric.change && (
              <p
                className={cn(
                  'text-sm font-medium',
                  metric.change.type === 'increase' ? 'text-green-600' : 'text-red-600'
                )}
              >
                {metric.change.type === 'increase' ? '↑' : '↓'} {Math.abs(metric.change.value)}%
              </p>
            )}
            {metric.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{metric.description}</p>
            )}
          </div>
          {metric.icon && <div className="text-3xl text-gray-400">{metric.icon}</div>}
        </div>
      </Card>
    );
  }

  /**
   * Generate children components recursively
   */
  private static generateChildren(children: GeneratorConfig[]): React.ReactNode[] {
    return children.map((child) => ComponentGenerator.generateComponent(child));
  }

  /**
   * Generate a component based on its configuration
   */
  static generateComponent(config: GeneratorConfig): React.ReactElement {
    switch (config.type) {
      case 'card':
        return ComponentGenerator.generateCard(config as CardConfig);
      case 'list':
        return ComponentGenerator.generateList(config as ListConfig);
      case 'table':
        return ComponentGenerator.generateTable(config as TableConfig);
      case 'content':
        // Content type is a simple wrapper that renders its children
        return (
          <div key={config.id} className={config.className} {...config.props}>
            {config.props?.children as React.ReactNode}
            {config.children && ComponentGenerator.generateChildren(config.children)}
          </div>
        );
      default:
        return <div key={config.id}>Unknown component type: {config.type}</div>;
    }
  }
}

/**
 * Pre-built Component Patterns
 */
// Type definitions for component patterns
interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  status?: string;
  trigger?: string;
  lastRun?: string;
  nodeCount?: number;
  isActive?: boolean;
}

interface CredentialItem {
  id: string;
  name: string;
  type: string;
  verified: boolean;
}

interface ExecutionItem {
  id: string;
  workflowId?: string;
  workflowName?: string;
  status: string;
  startTime: string;
  duration?: number;
}

export const ComponentPatterns = {
  /**
   * Create a workflow item card
   */
  workflowCard: (workflow: WorkflowItem, onEdit?: () => void, onDelete?: () => void) =>
    ComponentGenerator.generateCard({
      id: `workflow-${workflow.id}`,
      type: 'card',
      title: workflow.name,
      subtitle: workflow.description,
      hoverable: true,
      actions: (
        <Space>
          {onEdit && (
            <Button size="small" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button size="small" danger onClick={onDelete}>
              Delete
            </Button>
          )}
        </Space>
      ),
      children: [
        {
          id: 'workflow-stats',
          type: 'content',
          props: {
            children: ComponentGenerator.generateTagList([
              { label: `${workflow.nodeCount || 0} nodes`, color: 'blue' },
              {
                label: workflow.isActive ? 'Active' : 'Inactive',
                color: workflow.isActive ? 'green' : 'red',
              },
            ]),
          },
        },
      ],
    }),

  /**
   * Create a credential item
   */
  credentialItem: (
    credential: CredentialItem & { createdAt?: string; isValid?: boolean },
    onTest?: () => void,
    onEdit?: () => void
  ) => (
    <List.Item
      key={credential.id}
      actions={[
        onTest && (
          <Button size="small" onClick={onTest}>
            Test
          </Button>
        ),
        onEdit && (
          <Button size="small" onClick={onEdit}>
            Edit
          </Button>
        ),
      ].filter(Boolean)}
    >
      <List.Item.Meta
        title={credential.name}
        description={`${credential.type} • Created ${credential.createdAt}`}
        avatar={<Avatar>{credential.type.charAt(0).toUpperCase()}</Avatar>}
      />
      <div>
        <Tag color={credential.isValid ? 'green' : 'red'}>
          {credential.isValid ? 'Valid' : 'Invalid'}
        </Tag>
      </div>
    </List.Item>
  ),

  /**
   * Create an execution item
   */
  executionItem: (execution: ExecutionItem & { startedAt?: string }, onView?: () => void) => (
    <List.Item
      key={execution.id}
      actions={[
        onView && (
          <Button size="small" onClick={onView}>
            View
          </Button>
        ),
      ].filter(Boolean)}
    >
      <List.Item.Meta
        title={`Execution ${execution.id.slice(-8)}`}
        description={`${execution.workflowName} • ${execution.startedAt}`}
      />
      <div>
        <Tag
          color={
            execution.status === 'success'
              ? 'green'
              : execution.status === 'error'
                ? 'red'
                : execution.status === 'running'
                  ? 'blue'
                  : 'default'
          }
        >
          {execution.status.toUpperCase()}
        </Tag>
      </div>
    </List.Item>
  ),
};

export default ComponentGenerator;
