/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Enhanced Transform Property Panel
 * Comprehensive configuration panel for the enhanced Transform node with n8n-like features
 */

import { BulbOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import TransformAssignmentCollection from './TransformAssignmentCollection';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

interface EnhancedTransformPropertyPanelProps {
  nodeData: any;
  onChange: (updates: any) => void;
  inputData?: any[];
  onTest?: () => void;
  disabled?: boolean;
}

const EnhancedTransformPropertyPanel: React.FC<EnhancedTransformPropertyPanelProps> = ({
  nodeData,
  onChange,
  inputData,
  onTest,
  disabled,
}) => {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Extract current parameters
  const parameters = nodeData.parameters || {};
  const mode = parameters.mode || 'manual';
  const includeInputFields = parameters.includeInputFields || 'all';
  const selectedInputFields = parameters.selectedInputFields || '';
  const assignments = parameters.assignments?.values || [];
  const jsonObject = parameters.jsonObject || '{\n  "newField": "{{ $json.existingField }}"\n}';
  const options = parameters.options || {};

  // Update parameter helper
  const updateParameter = useCallback(
    (key: string, value: any) => {
      const newParameters = { ...parameters, [key]: value };
      onChange({ parameters: newParameters });
    },
    [parameters, onChange]
  );

  // Update nested parameter helper
  const updateNestedParameter = useCallback(
    (path: string, value: any) => {
      const keys = path.split('.');

      // CodeQL fix: Prevent prototype pollution (Alert #110)
      // Validate all keys before any property access/assignment
      const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
      for (const key of keys) {
        if (DANGEROUS_KEYS.includes(key)) {
          return;
        }
      }

      const newParameters = { ...parameters };
      let current = newParameters;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        // Additional safety check at assignment point
        if (!DANGEROUS_KEYS.includes(key)) {
          if (!current[key]) {
            current[key] = {};
          }
          current = current[key];
        }
      }

      // Final assignment with safety check
      const finalKey = keys[keys.length - 1];
      if (!DANGEROUS_KEYS.includes(finalKey)) {
        current[finalKey] = value;
        onChange({ parameters: newParameters });
      }
    },
    [parameters, onChange]
  );

  // Validate configuration
  const validateConfiguration = useCallback(() => {
    const errors: string[] = [];

    if (mode === 'manual') {
      // Validate assignments
      assignments.forEach((assignment: any, index: number) => {
        if (!assignment.name?.trim()) {
          errors.push(`Assignment ${index + 1}: Field name is required`);
        }
        if (assignment.name?.includes('..')) {
          errors.push(`Assignment ${index + 1}: Invalid dot notation syntax`);
        }
      });

      // Validate selected fields if needed
      if (
        (includeInputFields === 'selected' || includeInputFields === 'except') &&
        !selectedInputFields.trim()
      ) {
        errors.push('Selected input fields list is required for this inclusion mode');
      }
    } else if (mode === 'json') {
      // Validate JSON syntax
      try {
        JSON.parse(jsonObject);
      } catch (error) {
        errors.push(
          'Invalid JSON syntax in JSON Object',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [mode, assignments, includeInputFields, selectedInputFields, jsonObject]);

  // Validate on parameter changes
  useEffect(() => {
    validateConfiguration();
  }, [validateConfiguration]);

  // Get input field suggestions
  const getInputFieldSuggestions = useCallback(() => {
    if (!inputData?.length) {
      return [];
    }

    const fieldNames = new Set<string>();
    inputData.forEach((item) => {
      if (item.json && typeof item.json === 'object') {
        Object.keys(item.json).forEach((key) => fieldNames.add(key));
      }
    });

    return Array.from(fieldNames);
  }, [inputData]);

  const inputFieldSuggestions = getInputFieldSuggestions();

  // Render mode configuration
  const renderModeConfiguration = () => {
    switch (mode) {
      case 'manual':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Input Field Inclusion */}
            <Card size="small" title="Input Field Handling">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Include Input Fields</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Choose which input fields to include in the output
                  </Text>
                  <Select
                    value={includeInputFields}
                    onChange={(value) => updateParameter('includeInputFields', value)}
                    style={{ width: '100%', marginTop: '8px' }}
                    disabled={disabled}
                  >
                    <Option value="all">Include All Input Fields</Option>
                    <Option value="none">Include No Input Fields</Option>
                    <Option value="selected">Include Selected Input Fields</Option>
                    <Option value="except">Include All Except Selected</Option>
                  </Select>
                </div>

                {/* Conditional field selection */}
                {(includeInputFields === 'selected' || includeInputFields === 'except') && (
                  <div>
                    <Text strong>Selected Input Fields</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Comma-separated list of field names
                    </Text>
                    <Input
                      placeholder="field1, field2, field3"
                      value={selectedInputFields}
                      onChange={(e) => updateParameter('selectedInputFields', e.target.value)}
                      style={{ marginTop: '8px' }}
                      disabled={disabled}
                    />
                    {inputFieldSuggestions.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          Available fields:{' '}
                        </Text>
                        {inputFieldSuggestions.map((field: string) => (
                          <Tag
                            key={field}
                            style={{ cursor: 'pointer', margin: '2px' }}
                            onClick={() => {
                              const currentFields = selectedInputFields
                                .split(',')
                                .map((f: string) => f.trim())
                                .filter((f: string) => f);
                              if (!currentFields.includes(field)) {
                                const newFields = [...currentFields, field].join(', ');
                                updateParameter('selectedInputFields', newFields);
                              }
                            }}
                          >
                            {field}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Space>
            </Card>

            {/* Field Assignments */}
            <Card size="small" title="Field Assignments">
              <TransformAssignmentCollection
                assignments={assignments}
                onChange={(newAssignments) =>
                  updateNestedParameter('assignments.values', newAssignments)
                }
                inputData={inputData}
                disabled={disabled}
              />
            </Card>
          </Space>
        );

      case 'json':
        return (
          <Card size="small" title="JSON Object Definition">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>JSON Object</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Define the output object structure using JSON with expressions
                </Text>
              </div>
              <TextArea
                value={jsonObject}
                onChange={(e) => updateParameter('jsonObject', e.target.value)}
                rows={8}
                placeholder='{\n  "newField": "{{ $json.existingField }}",\n  "computed": "{{ $json.value1 + $json.value2 }}"\n}'
                disabled={disabled}
                style={{
                  fontFamily: 'Monaco, Consolas, monospace',
                  fontSize: '12px',
                }}
              />
              <Alert
                message="Expression Support"
                description="Use {{ expression }} syntax to access input data and perform calculations"
                type="info"
                showIcon
                icon={<BulbOutlined />}
              />
            </Space>
          </Card>
        );

      default:
        return null;
    }
  };

  // Render advanced options
  const renderAdvancedOptions = () => (
    <Collapse ghost>
      <Panel header="Advanced Options" key="advanced">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={12}>
              <div>
                <Text strong>Dot Notation</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Access nested object properties
                </Text>
                <br />
                <Switch
                  checked={options.dotNotation ?? true}
                  onChange={(value) => updateNestedParameter('options.dotNotation', value)}
                  disabled={disabled}
                  style={{ marginTop: '4px' }}
                />
              </div>
            </Col>
            <Col span={12}>
              <div>
                <Text strong>Ignore Conversion Errors</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Continue on type conversion failures
                </Text>
                <br />
                <Switch
                  checked={options.ignoreConversionErrors ?? false}
                  onChange={(value) =>
                    updateNestedParameter('options.ignoreConversionErrors', value)
                  }
                  disabled={disabled}
                  style={{ marginTop: '4px' }}
                />
              </div>
            </Col>
          </Row>

          {mode === 'manual' && (
            <div>
              <Text strong>Keep Only Set Fields</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Only include explicitly set fields (overrides input field inclusion)
              </Text>
              <br />
              <Switch
                checked={options.keepOnlySet ?? false}
                onChange={(value) => updateNestedParameter('options.keepOnlySet', value)}
                disabled={disabled}
                style={{ marginTop: '4px' }}
              />
            </div>
          )}
        </Space>
      </Panel>
    </Collapse>
  );

  return (
    <div
      className="enhanced-transform-property-panel"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <style>{`
        .enhanced-transform-property-panel {
          background: #fff;
        }
        .ant-tabs-content-holder {
          overflow-y: auto;
          flex: 1;
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', borderBottom: '1px solid #f0f0f0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Transform Configuration
            </Title>
            <Text type="secondary">Enhanced field transformation with type validation</Text>
          </div>
          {onTest && (
            <Button
              type="primary"
              size="small"
              onClick={onTest}
              disabled={disabled || validationErrors.length > 0}
            >
              Test
            </Button>
          )}
        </div>

        {/* Mode Selection */}
        <div style={{ marginBottom: '16px' }}>
          <Text strong>Transformation Mode</Text>
          <Select
            value={mode}
            onChange={(value) => updateParameter('mode', value)}
            style={{ width: '100%', marginTop: '8px' }}
            disabled={disabled}
          >
            <Option value="manual">
              <div>
                <div>Manual Field Assignment</div>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Configure individual field transformations with type validation
                </Text>
              </div>
            </Option>
            <Option value="json">
              <div>
                <div>JSON Object</div>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Define transformations using a JSON object with expressions
                </Text>
              </div>
            </Option>
          </Select>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <Alert
            message="Configuration Errors"
            description={
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {validationErrors.map((error: string, index: number) => (
                  <li key={index} style={{ fontSize: '12px' }}>
                    {error}
                  </li>
                ))}
              </ul>
            }
            type="error"
            showIcon
            style={{ marginTop: '16px' }}
          />
        </div>
      )}

      {/* Main Configuration */}
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {renderModeConfiguration()}
          {renderAdvancedOptions()}
        </Space>
      </div>

      {/* Footer with stats */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          fontSize: '12px',
          color: '#8c8c8c',
        }}
      >
        <Row>
          <Col span={8}>
            <Text type="secondary">Mode: {mode}</Text>
          </Col>
          <Col span={8}>
            {mode === 'manual' && <Text type="secondary">Assignments: {assignments.length}</Text>}
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            {inputData && <Text type="secondary">Input items: {inputData.length}</Text>}
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default EnhancedTransformPropertyPanel;
