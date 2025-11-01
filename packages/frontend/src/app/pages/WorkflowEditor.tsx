/**
 * Workflow Editor Page - Full-screen canvas layout
 *
 * Provides an immersive full-screen editing experience without
 * the constraints of traditional page layouts.
 */

import {
  ExperimentOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Logger } from '@klikkflow/core';
import { Button, Space } from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLeanWorkflowStore } from '@/core';
import WorkflowEditorComponent from '../components/WorkflowEditor';

const logger = new Logger('WorkflowEditor');

export const WorkflowEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentWorkflow, saveWorkflow, loadWorkflow, isLoading } = useLeanWorkflowStore();

  useEffect(() => {
    if (id) {
      loadWorkflow(id).catch((_error: any) => {
        // If workflow not found, redirect to dashboard or show error
      });
    }
  }, [id, loadWorkflow]);

  const handleSave = async () => {
    if (currentWorkflow) {
      await saveWorkflow(currentWorkflow);
    }
  };

  const handleTestRun = () => {
    logger.info('Test run workflow', { workflowId: id });
  };

  const handleViewHistory = () => {
    logger.info('View workflow history', { workflowId: id });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-white">
            {currentWorkflow?.name || 'New Workflow'}
          </h1>
          <p className="text-sm text-gray-400">
            {(currentWorkflow as any)?.description || 'Design your automation workflow'}
          </p>
        </div>

        {/* Action Buttons */}
        <Space>
          <Button
            type="default"
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={isLoading}
            loading={isLoading}
            className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:border-gray-500"
          >
            Save
          </Button>
          <Button
            type="default"
            icon={<ExperimentOutlined />}
            onClick={handleTestRun}
            className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:border-gray-500"
          >
            Test Run
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => logger.info('Execute workflow', { workflowId: id })}
            className="bg-blue-600 border-blue-600 hover:bg-blue-500"
          >
            Execute
          </Button>
          <Button
            type="link"
            icon={<HistoryOutlined />}
            onClick={handleViewHistory}
            className="text-gray-400 hover:text-gray-200"
          >
            History
          </Button>
        </Space>
      </div>

      {/* Workflow Canvas - Full height */}
      <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900">
        <WorkflowEditorComponent />
      </div>
    </div>
  );
};

export default WorkflowEditor;
