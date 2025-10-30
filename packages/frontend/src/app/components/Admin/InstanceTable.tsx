/**
 * Instance Table
 * Display and manage self-hosted instances
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Badge, Button, Modal, message, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { adminApiService } from '@/core/api/AdminApiService';
import { useAdminStore } from '@/core/stores/adminStore';
import type { Instance, InstancePlatform, InstanceStatus } from '@/core/types/admin';

interface InstanceTableProps {
  instances: Instance[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

/**
 * Get status badge
 */
const getStatusBadge = (status: InstanceStatus) => {
  const statusConfig = {
    active: { text: 'Active', status: 'success' as const, icon: <CheckCircleOutlined /> },
    inactive: { text: 'Inactive', status: 'warning' as const, icon: <StopOutlined /> },
    suspended: {
      text: 'Suspended',
      status: 'error' as const,
      icon: <CloseCircleOutlined />,
    },
  };

  const config = statusConfig[status] || statusConfig.inactive;

  return <Badge status={config.status} text={config.text} />;
};

/**
 * Get platform tag color
 */
const getPlatformColor = (platform: InstancePlatform): string => {
  const colors: Record<InstancePlatform, string> = {
    docker: 'blue',
    kubernetes: 'purple',
    vps: 'orange',
    cloud: 'cyan',
    local: 'green',
  };
  return colors[platform] || 'default';
};

/**
 * Instance table component
 */
export const InstanceTable: React.FC<InstanceTableProps> = ({
  instances,
  isLoading = false,
  onRefresh,
}) => {
  const deactivateInstance = useAdminStore((state) => state.deactivateInstance);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);

  /**
   * Handle view instance details
   */
  const handleViewDetails = useCallback((instance: Instance) => {
    setSelectedInstance(instance);
  }, []);

  /**
   * Handle deactivate instance
   */
  const handleDeactivate = useCallback(
    (instance: Instance) => {
      Modal.confirm({
        title: 'Deactivate Instance',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <p>
              Are you sure you want to deactivate <strong>{instance.hostname}</strong>?
            </p>
            <p>This action cannot be undone.</p>
          </div>
        ),
        okText: 'Deactivate',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            await deactivateInstance(instance.instanceId);
            message.success('Instance deactivated successfully');
            onRefresh?.();
          } catch (_error) {
            message.error('Failed to deactivate instance');
          }
        },
      });
    },
    [deactivateInstance, onRefresh]
  );

  /**
   * Table columns
   */
  const columns: ColumnsType<Instance> = useMemo(
    () => [
      {
        title: 'Hostname',
        dataIndex: 'hostname',
        key: 'hostname',
        fixed: 'left' as const,
        width: 200,
        ellipsis: true,
        render: (hostname: string, record: Instance) => (
          <Tooltip title={record.instanceId}>
            <Button type="link" onClick={() => handleViewDetails(record)} style={{ padding: 0 }}>
              {hostname}
            </Button>
          </Tooltip>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        filters: [
          { text: 'Active', value: 'active' },
          { text: 'Inactive', value: 'inactive' },
          { text: 'Suspended', value: 'suspended' },
        ],
        onFilter: (value, record) => record.status === value,
        render: (status: InstanceStatus) => getStatusBadge(status),
      },
      {
        title: 'Platform',
        dataIndex: 'platform',
        key: 'platform',
        width: 120,
        filters: [
          { text: 'Docker', value: 'docker' },
          { text: 'Kubernetes', value: 'kubernetes' },
          { text: 'VPS', value: 'vps' },
          { text: 'Cloud', value: 'cloud' },
          { text: 'Local', value: 'local' },
        ],
        onFilter: (value, record) => record.platform === value,
        render: (platform: InstancePlatform) => (
          <Tag color={getPlatformColor(platform)}>{platform.toUpperCase()}</Tag>
        ),
      },
      {
        title: 'Version',
        dataIndex: 'version',
        key: 'version',
        width: 100,
        sorter: (a, b) => a.version.localeCompare(b.version),
      },
      {
        title: 'Last Seen',
        dataIndex: 'lastSeen',
        key: 'lastSeen',
        width: 150,
        sorter: (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
        defaultSortOrder: 'descend' as const,
        render: (_: string, record: Instance) => (
          <Tooltip title={new Date(record.lastSeen).toLocaleString()}>
            {adminApiService.formatLastSeen(record)}
          </Tooltip>
        ),
      },
      {
        title: 'Uptime',
        key: 'uptime',
        width: 100,
        render: (_: unknown, record: Instance) => {
          const uptime = adminApiService.calculateUptime(record);
          const color = uptime >= 90 ? 'success' : uptime >= 70 ? 'warning' : 'error';
          return <Tag color={color}>{uptime}%</Tag>;
        },
      },
      {
        title: 'Workflows',
        dataIndex: ['statistics', 'workflowCount'],
        key: 'workflowCount',
        width: 100,
        sorter: (a, b) => (a.statistics?.workflowCount || 0) - (b.statistics?.workflowCount || 0),
        render: (count: number | undefined) => count || 0,
      },
      {
        title: 'Executions',
        dataIndex: ['statistics', 'executionCount'],
        key: 'executionCount',
        width: 120,
        sorter: (a, b) => (a.statistics?.executionCount || 0) - (b.statistics?.executionCount || 0),
        render: (count: number | undefined) => count || 0,
      },
      {
        title: 'First Seen',
        dataIndex: 'firstSeen',
        key: 'firstSeen',
        width: 150,
        sorter: (a, b) => new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime(),
        render: (_: string, record: Instance) => (
          <Tooltip title={new Date(record.firstSeen).toLocaleString()}>
            {adminApiService.formatInstanceAge(record)}
          </Tooltip>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right' as const,
        width: 120,
        render: (_: unknown, record: Instance) => (
          <Space size="small">
            <Tooltip title="View Details">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetails(record)}
              />
            </Tooltip>
            <Tooltip title="Deactivate">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeactivate(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [handleDeactivate, handleViewDetails]
  );

  return (
    <>
      <Table
        columns={columns}
        dataSource={instances}
        loading={isLoading}
        rowKey="instanceId"
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} instances`,
          defaultPageSize: 10,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        scroll={{ x: 1400 }}
      />

      {/* Instance Details Modal */}
      <Modal
        title="Instance Details"
        open={!!selectedInstance}
        onCancel={() => setSelectedInstance(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedInstance(null)}>
            Close
          </Button>,
        ]}
        width={700}
      >
        {selectedInstance && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700">Instance Information</h4>
              <dl className="mt-2 divide-y divide-gray-200">
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-600">Instance ID:</dt>
                  <dd className="text-sm font-mono">{selectedInstance.instanceId}</dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-600">Hostname:</dt>
                  <dd className="text-sm">{selectedInstance.hostname}</dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-600">Version:</dt>
                  <dd className="text-sm">{selectedInstance.version}</dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-600">Platform:</dt>
                  <dd>
                    <Tag color={getPlatformColor(selectedInstance.platform)}>
                      {selectedInstance.platform.toUpperCase()}
                    </Tag>
                  </dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-600">Status:</dt>
                  <dd>{getStatusBadge(selectedInstance.status)}</dd>
                </div>
              </dl>
            </div>

            {selectedInstance.metadata && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700">System Information</h4>
                <dl className="mt-2 divide-y divide-gray-200">
                  {selectedInstance.metadata.os && (
                    <div className="py-2 flex justify-between">
                      <dt className="text-sm text-gray-600">OS:</dt>
                      <dd className="text-sm">{selectedInstance.metadata.os}</dd>
                    </div>
                  )}
                  {selectedInstance.metadata.nodeVersion && (
                    <div className="py-2 flex justify-between">
                      <dt className="text-sm text-gray-600">Node Version:</dt>
                      <dd className="text-sm">{selectedInstance.metadata.nodeVersion}</dd>
                    </div>
                  )}
                  {selectedInstance.metadata.cpu && (
                    <div className="py-2 flex justify-between">
                      <dt className="text-sm text-gray-600">CPU Cores:</dt>
                      <dd className="text-sm">{selectedInstance.metadata.cpu}</dd>
                    </div>
                  )}
                  {selectedInstance.metadata.memory && (
                    <div className="py-2 flex justify-between">
                      <dt className="text-sm text-gray-600">Memory:</dt>
                      <dd className="text-sm">{selectedInstance.metadata.memory} GB</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {selectedInstance.statistics && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700">Usage Statistics</h4>
                <dl className="mt-2 divide-y divide-gray-200">
                  {selectedInstance.statistics.workflowCount !== undefined && (
                    <div className="py-2 flex justify-between">
                      <dt className="text-sm text-gray-600">Workflows:</dt>
                      <dd className="text-sm">{selectedInstance.statistics.workflowCount}</dd>
                    </div>
                  )}
                  {selectedInstance.statistics.executionCount !== undefined && (
                    <div className="py-2 flex justify-between">
                      <dt className="text-sm text-gray-600">Executions:</dt>
                      <dd className="text-sm">{selectedInstance.statistics.executionCount}</dd>
                    </div>
                  )}
                  {selectedInstance.statistics.activeUsers !== undefined && (
                    <div className="py-2 flex justify-between">
                      <dt className="text-sm text-gray-600">Active Users:</dt>
                      <dd className="text-sm">{selectedInstance.statistics.activeUsers}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};
