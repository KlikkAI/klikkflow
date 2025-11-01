/**
 * Workflow Repository
 * Handles workflow data access operations with MongoDB
 */

import { Workflow } from '../../../models/Workflow.js';

export class WorkflowRepository {
  /**
   * Find a single workflow by query
   */
  async findOne(query: any): Promise<any> {
    return await Workflow.findOne(query);
  }

  /**
   * Find workflows with pagination
   */
  async findWithPagination(filter: any, skip: number, limit: number): Promise<any[]> {
    return await Workflow.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  }

  /**
   * Count workflows matching filter
   */
  async countDocuments(filter: any): Promise<number> {
    return await Workflow.countDocuments(filter);
  }

  /**
   * Create a new workflow
   */
  async create(data: any): Promise<any> {
    const workflow = new Workflow(data);
    return await workflow.save();
  }

  /**
   * Update workflow by ID
   */
  async updateById(id: string, data: any, allowedFields?: string[]): Promise<any> {
    const updateData = allowedFields
      ? Object.keys(data)
          .filter((key) => allowedFields.includes(key))
          .reduce((obj, key) => ({ ...obj, [key]: data[key] }), {})
      : data;

    return await Workflow.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  /**
   * Find and delete a workflow
   */
  async findOneAndDelete(filter: any): Promise<any> {
    return await Workflow.findOneAndDelete(filter);
  }
}
