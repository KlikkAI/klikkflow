/**
 * Create API Key Modal Component
 * Handles API key creation with permissions and expiration settings
 */

import { CopyOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Logger } from '@klikkflow/core';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
  Space,
  Typography,
} from 'antd';
import type React from 'react';
import { useState } from 'react';
import { AuthApiService } from '@/core';
import type { CreateApiKeyRequest } from '@/core/schemas/AuthSchemas';

const { Text, Paragraph, Title } = Typography;
const { Option } = Select;

const logger = new Logger('CreateApiKeyModal');
const authApiService = new AuthApiService();

interface CreateApiKeyModalProps {
  visible: boolean;
  onClose: (created: boolean) => void;
}

// Available permissions for API keys
const AVAILABLE_PERMISSIONS = [
  { value: 'read', label: 'Read', description: 'View workflows and executions' },
  { value: 'write', label: 'Write', description: 'Create and update workflows' },
  { value: 'execute', label: 'Execute', description: 'Run workflows' },
  { value: 'workflows:read', label: 'Workflows: Read', description: 'View workflow details' },
  { value: 'workflows:write', label: 'Workflows: Write', description: 'Modify workflows' },
  { value: 'workflows:execute', label: 'Workflows: Execute', description: 'Execute workflows' },
  { value: 'workflows:delete', label: 'Workflows: Delete', description: 'Delete workflows' },
  { value: 'credentials:read', label: 'Credentials: Read', description: 'View credentials' },
  { value: 'credentials:write', label: 'Credentials: Write', description: 'Manage credentials' },
  { value: 'executions:read', label: 'Executions: Read', description: 'View execution history' },
];

// Expiration presets in seconds
const EXPIRATION_PRESETS = [
  { label: '7 days', value: 7 * 24 * 60 * 60 },
  { label: '30 days', value: 30 * 24 * 60 * 60 },
  { label: '90 days', value: 90 * 24 * 60 * 60 },
  { label: '1 year', value: 365 * 24 * 60 * 60 },
  { label: 'Never expires', value: 0 },
];

export const CreateApiKeyModal: React.FC<CreateApiKeyModalProps> = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(true);

  const handleCreate = async (values: CreateApiKeyRequest & { expiresInPreset?: number }) => {
    setLoading(true);
    try {
      // Use preset value or custom value
      const expiresIn =
        values.expiresInPreset === 0 ? undefined : values.expiresInPreset || values.expiresIn;

      const response = await authApiService.createApiKey({
        name: values.name,
        permissions: values.permissions || ['read'],
        expiresIn,
      });

      // Show the created key
      setCreatedKey(response.key);
      message.success('API key created successfully!');
    } catch (error) {
      logger.error('Failed to create API key', { error });
      message.error('Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      message.success('API key copied to clipboard!');
    }
  };

  const handleClose = () => {
    form.resetFields();
    setCreatedKey(null);
    setShowKey(true);
    onClose(!!createdKey);
  };

  const toggleShowKey = () => {
    setShowKey(!showKey);
  };

  // Show key display modal after creation
  if (createdKey) {
    return (
      <Modal
        title={
          <Space>
            <span>🔑</span>
            <span>API Key Created Successfully</span>
          </Space>
        }
        open={visible}
        onCancel={handleClose}
        footer={[
          <Button key="close" type="primary" onClick={handleClose}>
            Done
          </Button>,
        ]}
        width={600}
        maskClosable={false}
      >
        <Alert
          message="Important: Save your API key now"
          description="For security reasons, you won't be able to see this key again after closing this dialog. Make sure to copy and store it securely."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <div style={{ marginBottom: 24 }}>
          <Title level={5}>Your API Key:</Title>
          <div
            style={{
              padding: '12px 16px',
              background: '#f5f5f5',
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              fontFamily: 'monospace',
              fontSize: 14,
              wordBreak: 'break-all',
              position: 'relative',
            }}
          >
            {showKey ? createdKey : '•'.repeat(createdKey.length)}
            <div style={{ position: 'absolute', right: 12, top: 12 }}>
              <Space>
                <Button
                  type="text"
                  size="small"
                  icon={showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={toggleShowKey}
                />
                <Button type="primary" size="small" icon={<CopyOutlined />} onClick={handleCopyKey}>
                  Copy
                </Button>
              </Space>
            </div>
          </div>
        </div>

        <Paragraph type="secondary">
          <strong>Usage:</strong> Include this key in your API requests using the{' '}
          <Text code>x-api-key</Text> header:
        </Paragraph>
        <pre
          style={{
            padding: '12px',
            background: '#fafafa',
            borderRadius: 4,
            border: '1px solid #d9d9d9',
            overflow: 'auto',
          }}
        >
          {`curl -H "x-api-key: ${showKey ? createdKey : 'YOUR_API_KEY'}" \\
  https://api.reporunner.com/workflows`}
        </pre>
      </Modal>
    );
  }

  // Show creation form
  return (
    <Modal
      title="Create New API Key"
      open={visible}
      onCancel={handleClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Create Key"
      cancelText="Cancel"
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleCreate}
        initialValues={{
          permissions: ['read'],
          expiresInPreset: 90 * 24 * 60 * 60, // Default: 90 days
        }}
      >
        <Form.Item
          label="Key Name"
          name="name"
          rules={[
            { required: true, message: 'Please enter a name for your API key' },
            {
              min: 1,
              max: 100,
              message: 'Name must be between 1 and 100 characters',
            },
          ]}
        >
          <Input placeholder="e.g., Production Server, CI/CD Pipeline, Mobile App" />
        </Form.Item>

        <Form.Item
          label="Permissions"
          name="permissions"
          rules={[{ required: true, message: 'Please select at least one permission' }]}
        >
          <Checkbox.Group style={{ width: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <div key={perm.value}>
                  <Checkbox value={perm.value}>
                    <strong>{perm.label}</strong>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {perm.description}
                    </Text>
                  </Checkbox>
                </div>
              ))}
            </Space>
          </Checkbox.Group>
        </Form.Item>

        <Form.Item label="Expiration" name="expiresInPreset">
          <Select placeholder="Select expiration time">
            {EXPIRATION_PRESETS.map((preset) => (
              <Option key={preset.value} value={preset.value}>
                {preset.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Custom Expiration (days)"
          name="expiresIn"
          help="Optionally specify a custom expiration in days (1-365). Leave empty to use the preset above."
        >
          <InputNumber
            min={1}
            max={365}
            style={{ width: '100%' }}
            placeholder="e.g., 60"
            onChange={(value) => {
              if (value) {
                // Convert days to seconds
                form.setFieldValue('expiresInPreset', undefined);
              }
            }}
          />
        </Form.Item>

        <Alert
          message="Security Note"
          description="API keys provide full access according to the permissions you select. Keep them secure and rotate them regularly."
          type="info"
          showIcon
        />
      </Form>
    </Modal>
  );
};

export default CreateApiKeyModal;
