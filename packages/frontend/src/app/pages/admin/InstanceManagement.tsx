/**
 * Instance Management Page
 * Admin dashboard for managing self-hosted instances
 */

import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Alert, Button, Col, Input, Modal, message, Row, Select, Space, Tabs } from 'antd';
import { useEffect, useState } from 'react';
import { InstanceActivityTimeline } from '@/app/components/Admin/InstanceActivityTimeline';
import { InstanceStatsCards } from '@/app/components/Admin/InstanceStatsCards';
import { InstanceTable } from '@/app/components/Admin/InstanceTable';
import { PlatformDistributionChart } from '@/app/components/Admin/PlatformDistributionChart';
import { VersionDistributionChart } from '@/app/components/Admin/VersionDistributionChart';
import { useAdminStore, useFilteredInstances } from '@/core/stores/adminStore';
import type { InstancePlatform, InstanceStatus } from '@/core/types/admin';

/**
 * Instance Management Page
 */
const InstanceManagement: React.FC = () => {
  const {
    statistics,
    isLoading,
    error,
    filters,
    fetchInstances,
    fetchStatistics,
    cleanupStaleInstances,
    setFilters,
    clearFilters,
    clearError,
  } = useAdminStore();

  const filteredInstances = useFilteredInstances();
  const [activeTab, setActiveTab] = useState<string>('overview');

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    try {
      await Promise.all([fetchInstances(), fetchStatistics()]);
    } catch (_err) {
      message.error('Failed to load instance data');
    }
  };

  /**
   * Load data on mount
   */
  useEffect(() => {
    handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Handle cleanup
   */
  const handleCleanup = () => {
    Modal.confirm({
      title: 'Cleanup Stale Instances',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>This will deactivate instances that haven't sent a heartbeat in over 30 days.</p>
          <p>Are you sure you want to proceed?</p>
        </div>
      ),
      okText: 'Cleanup',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const result = await cleanupStaleInstances(30);
          if (result.cleaned > 0) {
            message.success(`Cleaned up ${result.cleaned} stale instance(s)`);
          } else {
            message.info('No stale instances found');
          }
          await handleRefresh();
        } catch (_err) {
          message.error('Failed to cleanup instances');
        }
      },
    });
  };

  /**
   * Filter controls
   */
  const FilterControls = () => (
    <Space size="middle" wrap>
      <Input
        placeholder="Search hostname or instance ID..."
        prefix={<SearchOutlined />}
        value={filters.search || ''}
        onChange={(e) => setFilters({ search: e.target.value })}
        style={{ width: 250 }}
        allowClear
      />
      <Select
        placeholder="Filter by status"
        value={filters.status}
        onChange={(value: InstanceStatus | undefined) => setFilters({ status: value })}
        style={{ width: 150 }}
        allowClear
      >
        <Select.Option value="active">Active</Select.Option>
        <Select.Option value="inactive">Inactive</Select.Option>
        <Select.Option value="suspended">Suspended</Select.Option>
      </Select>
      <Select
        placeholder="Filter by platform"
        value={filters.platform}
        onChange={(value: InstancePlatform | undefined) => setFilters({ platform: value })}
        style={{ width: 150 }}
        allowClear
      >
        <Select.Option value="docker">Docker</Select.Option>
        <Select.Option value="kubernetes">Kubernetes</Select.Option>
        <Select.Option value="vps">VPS</Select.Option>
        <Select.Option value="cloud">Cloud</Select.Option>
        <Select.Option value="local">Local</Select.Option>
      </Select>
      <Button onClick={clearFilters}>Clear Filters</Button>
    </Space>
  );

  /**
   * Tab items
   */
  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <InstanceStatsCards statistics={statistics} isLoading={isLoading} />

          {/* Charts Row */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <PlatformDistributionChart statistics={statistics} isLoading={isLoading} />
            </Col>
            <Col xs={24} lg={12}>
              <VersionDistributionChart statistics={statistics} isLoading={isLoading} />
            </Col>
          </Row>

          {/* Activity Timeline */}
          <InstanceActivityTimeline
            instances={filteredInstances}
            isLoading={isLoading}
            limit={10}
          />
        </div>
      ),
    },
    {
      key: 'instances',
      label: 'All Instances',
      children: (
        <div className="space-y-4">
          {/* Filters and Actions */}
          <div className="flex justify-between items-center">
            <FilterControls />
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                Refresh
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleCleanup}>
                Cleanup Stale
              </Button>
            </Space>
          </div>

          {/* Instance Table */}
          <InstanceTable
            instances={filteredInstances}
            isLoading={isLoading}
            onRefresh={handleRefresh}
          />
        </div>
      ),
    },
    {
      key: 'analytics',
      label: 'Analytics',
      children: (
        <div className="space-y-6">
          {/* Statistics Summary */}
          <InstanceStatsCards statistics={statistics} isLoading={isLoading} />

          {/* Detailed Charts */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <PlatformDistributionChart statistics={statistics} isLoading={isLoading} />
            </Col>
            <Col xs={24} lg={12}>
              <VersionDistributionChart statistics={statistics} isLoading={isLoading} />
            </Col>
          </Row>

          {/* Additional Analytics Placeholder */}
          <Alert
            message="More Analytics Coming Soon"
            description="Additional analytics features such as usage trends, performance metrics, and geographic distribution will be available in future updates."
            type="info"
            showIcon
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Instance Management</h1>
        <p className="text-gray-600 mt-1">Monitor and manage self-hosted Reporunner instances</p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          onClose={clearError}
          className="mb-4"
        />
      )}

      {/* Main Content */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
};

export default InstanceManagement;
