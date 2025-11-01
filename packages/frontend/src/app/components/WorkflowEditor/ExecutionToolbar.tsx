/* eslint-disable @typescript-eslint/no-explicit-any */
// Execution Toolbar Component - Controls for running workflows

import {
  BugOutlined,
  DownOutlined,
  ExportOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  SettingOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Badge, Button, Dropdown, message, Space } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { Edge, Node } from 'reactflow';
import { WorkflowApiService } from '@/core';
import type { WorkflowExecution } from '@/core/schemas';
import { exportWorkflowToBackend, validateWorkflowForExport } from '@/core/utils/workflowExporter';
import { ExecutionHistory } from '../ExecutionHistory/ExecutionHistory';
import { WorkflowTester } from '../WorkflowTester/WorkflowTester';

const workflowApiService = new WorkflowApiService();

interface ExecutionToolbarProps {
  nodes: Node[];
  edges: Edge[];
  currentExecution?: WorkflowExecution | null;
  onExecutionStart?: (executionId: string) => void;
  onExecutionStop?: () => void;
}

export const ExecutionToolbar: React.FC<ExecutionToolbarProps> = ({
  nodes,
  edges,
  currentExecution,
  onExecutionStart,
  onExecutionStop,
}) => {
  const [testing, setTesting] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [, setSaving] = useState(false);

  const isRunning = currentExecution?.status === 'running';
  const canRun = nodes.length > 0 && !isRunning;

  const handleTest = () => {
    setShowTester(true);
  };

  const handleRun = async () => {
    if (!canRun) {
      return;
    }

    // Validate workflow first
    const validation = validateWorkflowForExport(nodes, edges);
    if (!validation.isValid) {
      message.error(`Cannot run workflow: ${validation.errors.join(', ')}`);
      return;
    }

    if (validation.warnings.length > 0) {
      message.warning(`Warnings: ${validation.warnings.join(', ')}`);
    }

    try {
      setTesting(true);
      const workflowJson = exportWorkflowToBackend(nodes, edges);

      const execution = await workflowApiService.executeWorkflow({
        workflow: workflowJson as any,
        triggerData: {},
        options: {
          timeout: 600000, // 10 minutes
        },
      });

      message.success('Workflow execution started');
      onExecutionStart?.(execution.id);
    } catch (error: any) {
      message.error(`Failed to start workflow: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleStop = async () => {
    if (!currentExecution) {
      return;
    }

    try {
      await workflowApiService.stopExecution(currentExecution.id);
      message.success('Workflow execution stopped');
      onExecutionStop?.();
    } catch (error: any) {
      message.error(`Failed to stop workflow: ${error.message}`);
    }
  };

  const handleSave = async () => {
    if (nodes.length === 0) {
      message.warning('Cannot save empty workflow');
      return;
    }

    try {
      setSaving(true);

      // Use React Flow nodes directly - they already match WorkflowNode schema
      await workflowApiService.createWorkflow({
        active: true,
        name: `Workflow ${new Date().toLocaleDateString()}`,
        description: 'Saved from workflow editor',
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type || 'unknown',
          position: node.position,
          data: node.data,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || undefined,
          targetHandle: edge.targetHandle || undefined,
          data: edge.data,
        })),
        tags: ['editor'],
        isActive: true,
      } as any);

      message.success('Workflow saved successfully');
    } catch (error: any) {
      message.error(`Failed to save workflow: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (nodes.length === 0) {
      message.warning('Cannot export empty workflow');
      return;
    }

    try {
      const workflowJson = exportWorkflowToBackend(nodes, edges);
      const blob = new Blob([JSON.stringify(workflowJson, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success('Workflow exported successfully');
    } catch (error: any) {
      message.error(`Failed to export workflow: ${error.message}`);
    }
  };

  const runMenuItems = [
    {
      key: 'run',
      label: 'Run Workflow',
      icon: <PlayCircleOutlined />,
      onClick: handleRun,
      disabled: !canRun,
    },
    {
      key: 'test',
      label: 'Test Workflow',
      icon: <BugOutlined />,
      onClick: handleTest,
    },
  ];

  const moreMenuItems = [
    {
      key: 'save',
      label: 'Save Workflow',
      icon: <SaveOutlined />,
      onClick: handleSave,
    },
    {
      key: 'export',
      label: 'Export JSON',
      icon: <ExportOutlined />,
      onClick: handleExport,
    },
    {
      key: 'history',
      label: 'Execution History',
      icon: <HistoryOutlined />,
      onClick: () => setShowHistory(true),
    },
  ];

  return (
    <div className="execution-toolbar flex-shrink-0">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <Space>
          {/* Primary execution controls */}
          {isRunning ? (
            <Button danger icon={<StopOutlined />} onClick={handleStop} size="small">
              Stop
            </Button>
          ) : (
            <Dropdown
              menu={{ items: runMenuItems }}
              trigger={['click']}
              disabled={nodes.length === 0}
            >
              <Button type="primary" icon={<PlayCircleOutlined />} loading={testing} size="small">
                Run <DownOutlined />
              </Button>
            </Dropdown>
          )}

          {/* Test button */}
          <Button
            icon={<BugOutlined />}
            onClick={handleTest}
            disabled={nodes.length === 0}
            size="small"
          >
            Test
          </Button>

          {/* Execution status */}
          {currentExecution && (
            <Badge
              status={
                currentExecution.status === 'running'
                  ? 'processing'
                  : currentExecution.status === 'success'
                    ? 'success'
                    : currentExecution.status === 'error'
                      ? 'error'
                      : 'default'
              }
              text={
                <span className="text-sm">
                  {currentExecution.status === 'running'
                    ? `Running (${currentExecution.progress?.completedNodes?.length || 0}/${currentExecution.progress?.totalNodes || 0})`
                    : `${currentExecution.status} - ${Math.round((currentExecution.duration || 0) / 1000)}s`}
                </span>
              }
            />
          )}
        </Space>

        <Space>
          {/* Workflow info */}
          <span className="text-sm text-gray-500">
            {nodes.length} nodes • {edges.length} connections
          </span>

          {/* More actions */}
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Button icon={<SettingOutlined />} size="small">
              <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      </div>

      {/* Workflow Tester Modal */}
      {showTester && (
        <WorkflowTester nodes={nodes} edges={edges} onClose={() => setShowTester(false)} />
      )}

      {/* Execution History Modal */}
      {showHistory && <ExecutionHistory onClose={() => setShowHistory(false)} />}
    </div>
  );
};

export default ExecutionToolbar;
