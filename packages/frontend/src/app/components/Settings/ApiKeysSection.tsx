/**
 * API Keys Section Component
 * Displays and manages user API keys in the Settings page
 */

import { CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Logger } from '@klikkflow/core';
import { Button, message, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { AuthApiService } from '@/core';
import type { ApiKey } from '@/core/schemas/AuthSchemas';
import { CreateApiKeyModal } from './CreateApiKeyModal';

const { Title, Text, Paragraph } = Typography;

const logger = new Logger('ApiKeysSection');
const authApiService = new AuthApiService();

export const ApiKeysSection: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const keys = await authApiService.getApiKeys();
      setApiKeys(keys);
    } catch (error) {
      logger.error('Failed to load API keys', { error });
      message.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load API keys on mount
  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleCreateKey = () => {
    setIsModalVisible(true);
  };

  const handleModalClose = (created: boolean) => {
    setIsModalVisible(false);
    if (created) {
      loadApiKeys();
    }
  };

  const handleCopyKey = (maskedKey: string) => {
    // Note: The full key is only shown once during creation
    // Here we just copy the masked version for reference
    navigator.clipboard.writeText(maskedKey);
    message.success('Key reference copied to clipboard');
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await authApiService.revokeApiKey(keyId);
      message.success('API key revoked successfully');
      loadApiKeys();
    } catch (error) {
      logger.error('Failed to revoke API key', { error });
      message.error('Failed to revoke API key');
    }
  };

  const formatDate = (date?: Date | string): string => {
    if (!date) {
      return 'Never';
    }
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(dateObj);
  };

  const columns: ColumnsType<ApiKey> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Key',
      dataIndex: 'maskedKey',
      key: 'maskedKey',
      width: 300,
      render: (maskedKey: string) => (
        <Space>
          <Text code copyable={false}>
            {maskedKey}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopyKey(maskedKey)}
          />
        </Space>
      ),
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 250,
      render: (permissions: string[]) => (
        <>
          {permissions.slice(0, 3).map((permission) => (
            <Tag key={permission} color="blue">
              {permission}
            </Tag>
          ))}
          {permissions.length > 3 && <Tag>+{permissions.length - 3} more</Tag>}
        </>
      ),
    },
    {
      title: 'Last Used',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 180,
      render: (date?: Date) => <Text type="secondary">{formatDate(date)}</Text>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: Date) => <Text type="secondary">{formatDate(date)}</Text>,
    },
    {
      title: 'Expires',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 180,
      render: (date?: Date) => {
        if (!date) {
          return <Text type="secondary">Never</Text>;
        }
        const isExpired = new Date(date) < new Date();
        return (
          <Text type={isExpired ? 'danger' : 'secondary'}>
            {isExpired ? 'Expired' : formatDate(date)}
          </Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_: unknown, record: ApiKey) => (
        <Popconfirm
          title="Revoke API Key"
          description="Are you sure you want to revoke this API key? This action cannot be undone."
          onConfirm={() => handleRevokeKey(record.id)}
          okText="Yes, revoke"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            Revoke
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              API Keys
            </Title>
            <Text type="secondary">Manage API keys for programmatic access</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateKey}>
            Create API Key
          </Button>
        </div>

        <Paragraph type="secondary">
          API keys allow you to access your workflows programmatically. Keep your keys secure and
          never share them publicly. You can create up to 10 API keys.
        </Paragraph>
      </div>

      <Table<ApiKey>
        columns={columns}
        dataSource={apiKeys}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} keys`,
        }}
        locale={{
          emptyText: (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Text type="secondary">No API keys yet</Text>
              <br />
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={handleCreateKey}
                style={{ marginTop: 8 }}
              >
                Create your first API key
              </Button>
            </div>
          ),
        }}
        scroll={{ x: 1200 }}
      />

      <CreateApiKeyModal visible={isModalVisible} onClose={handleModalClose} />
    </div>
  );
};

export default ApiKeysSection;
