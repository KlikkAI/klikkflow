/**
 * Instance Statistics Cards
 * Display summary metrics for admin dashboard
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  PlayCircleOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Skeleton, Statistic } from 'antd';
import type { InstanceStatisticsSummary } from '@/core/types/admin';

interface InstanceStatsCardsProps {
  statistics: InstanceStatisticsSummary | null;
  isLoading?: boolean;
}

/**
 * Stats cards component
 */
export const InstanceStatsCards: React.FC<InstanceStatsCardsProps> = ({
  statistics,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Row gutter={[16, 16]}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Col xs={24} sm={12} lg={8} xl={4} key={`loading-card-${index}`}>
            <Card>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <Row gutter={[16, 16]}>
      {/* Total Instances */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card>
          <Statistic
            title="Total Instances"
            value={statistics.total}
            prefix={<CloudServerOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>

      {/* Active Instances */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card>
          <Statistic
            title="Active"
            value={statistics.active}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>

      {/* Inactive Instances */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card>
          <Statistic
            title="Inactive"
            value={statistics.inactive}
            prefix={<StopOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>

      {/* Suspended Instances */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card>
          <Statistic
            title="Suspended"
            value={statistics.suspended}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Card>
      </Col>

      {/* Total Workflows */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card>
          <Statistic
            title="Total Workflows"
            value={statistics.totalWorkflows}
            prefix={<DashboardOutlined />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>

      {/* Total Executions */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card>
          <Statistic
            title="Total Executions"
            value={statistics.totalExecutions}
            prefix={<PlayCircleOutlined />}
            valueStyle={{ color: '#eb2f96' }}
          />
        </Card>
      </Col>

      {/* Total Users */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card>
          <Statistic
            title="Total Users"
            value={statistics.totalUsers}
            prefix={<TeamOutlined />}
            valueStyle={{ color: '#13c2c2' }}
          />
        </Card>
      </Col>

      {/* Recent Activity (Last 24h) */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card>
          <Statistic
            title="Active (24h)"
            value={statistics.recentActivity.last24h}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
    </Row>
  );
};
