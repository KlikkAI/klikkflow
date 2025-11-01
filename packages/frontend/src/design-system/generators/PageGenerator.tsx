/**
 * Page Generator System
 *
 * Provides configurable page generation to eliminate
 * page duplication patterns across the application.
 *
 * Targets: 20+ page components with similar structures
 */

import type React from 'react';
import { ResponsiveGrid, SectionLayout } from '../components/DynamicLayout';
import { BasePage, PageSection, StatsCard } from '../components/layout/BasePage';
import { UniversalForm } from '../components/UniversalForm';
import type { PropertyRendererConfig } from '../factories/PropertyRendererFactory';

export interface PageAction {
  label: string;
  type?: 'default' | 'primary' | 'dashed' | 'link' | 'text';
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface Statistic {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  color?: string;
  loading?: boolean;
}

export interface PageConfig {
  title: string;
  subtitle?: string;
  actions?: PageAction[];
  sections: PageSectionConfig[];
  loading?: boolean;
  error?: string;
}

export interface PageSectionConfig {
  id: string;
  title?: string;
  subtitle?: string;
  type: 'stats' | 'form' | 'content' | 'list' | 'grid' | 'table';
  data?: any;
  config?: any;
  actions?: PageAction[];
  loading?: boolean;
  className?: string;
}

export interface StatsPageConfig extends PageConfig {
  stats: Statistic[];
}

export interface FormPageConfig extends PageConfig {
  form: {
    properties: PropertyRendererConfig[];
    initialValues?: Record<string, any>;
    onSubmit: (values: Record<string, any>) => void;
    submitText?: string;
    showCancel?: boolean;
  };
}

export interface ListPageConfig extends PageConfig {
  list: {
    items: any[];
    renderItem: (item: any, index: number) => React.ReactNode;
    emptyText?: string;
    pagination?: {
      current: number;
      total: number;
      onChange: (page: number) => void;
    };
  };
}

/**
 * Universal Page Generator
 */
export class PageGenerator {
  /**
   * Generate a basic page with sections
   */
  static generatePage(config: PageConfig): React.ReactElement {
    return (
      <BasePage
        title={config.title}
        subtitle={config.subtitle}
        actions={config.actions}
        loading={config.loading}
        error={config.error}
      >
        {config.sections.map((section) => PageGenerator.renderSection(section))}
      </BasePage>
    );
  }

  /**
   * Generate a dashboard page with statistics
   */
  static generateDashboard(config: StatsPageConfig): React.ReactElement {
    return (
      <BasePage
        title={config.title}
        subtitle={config.subtitle}
        actions={config.actions}
        loading={config.loading}
        error={config.error}
        maxWidth="wide"
      >
        {/* Statistics Section */}
        <PageSection title="Overview">
          <ResponsiveGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="1.5rem">
            {config.stats.map((stat, index) => (
              <StatsCard
                key={index}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                trend={stat.trend}
              />
            ))}
          </ResponsiveGrid>
        </PageSection>

        {/* Additional Sections */}
        {config.sections.map((section) => PageGenerator.renderSection(section))}
      </BasePage>
    );
  }

  /**
   * Generate a form page
   */
  static generateFormPage(config: FormPageConfig): React.ReactElement {
    return (
      <BasePage
        title={config.title}
        subtitle={config.subtitle}
        actions={config.actions}
        loading={config.loading}
        error={config.error}
      >
        <SectionLayout background border>
          <UniversalForm
            properties={config.form.properties}
            initialValues={config.form.initialValues}
            onSubmit={config.form.onSubmit}
            submitText={config.form.submitText}
            showCancel={config.form.showCancel}
          />
        </SectionLayout>

        {/* Additional Sections */}
        {config.sections.map((section) => PageGenerator.renderSection(section))}
      </BasePage>
    );
  }

  /**
   * Generate a list page
   */
  static generateListPage(config: ListPageConfig): React.ReactElement {
    return (
      <BasePage
        title={config.title}
        subtitle={config.subtitle}
        actions={config.actions}
        loading={config.loading}
        error={config.error}
      >
        <PageSection>
          {config.list.items.length > 0 ? (
            <div className="space-y-4">
              {config.list.items.map((item, index) => config.list.renderItem(item, index))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {config.list.emptyText || 'No items found'}
            </div>
          )}
        </PageSection>

        {/* Additional Sections */}
        {config.sections.map((section) => PageGenerator.renderSection(section))}
      </BasePage>
    );
  }

  /**
   * Render a page section based on its configuration
   */
  private static renderSection(section: PageSectionConfig): React.ReactElement {
    const sectionKey = section.id;
    const sectionProps = {
      title: section.title,
      subtitle: section.subtitle,
      actions: section.actions,
      loading: section.loading,
      className: section.className,
    };

    switch (section.type) {
      case 'stats':
        return (
          <PageSection key={sectionKey} {...sectionProps}>
            <ResponsiveGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="1.5rem">
              {section.data?.map((stat: Statistic, index: number) => (
                <StatsCard
                  key={index}
                  title={stat.title}
                  value={stat.value}
                  icon={stat.icon}
                  trend={stat.trend}
                />
              ))}
            </ResponsiveGrid>
          </PageSection>
        );

      case 'form':
        return (
          <PageSection key={sectionKey} {...sectionProps}>
            <UniversalForm
              properties={section.config?.properties || []}
              initialValues={section.config?.initialValues}
              onSubmit={section.config?.onSubmit}
              submitText={section.config?.submitText}
              showCancel={section.config?.showCancel}
            />
          </PageSection>
        );

      case 'content':
        return (
          <PageSection key={sectionKey} {...sectionProps}>
            {section.data}
          </PageSection>
        );

      case 'list':
        return (
          <PageSection key={sectionKey} {...sectionProps}>
            {section.data?.length > 0 ? (
              <div className="space-y-4">
                {section.data.map(
                  (item: any, index: number) =>
                    section.config?.renderItem?.(item, index) || (
                      <div key={index}>{JSON.stringify(item)}</div>
                    )
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                {section.config?.emptyText || 'No items found'}
              </div>
            )}
          </PageSection>
        );

      case 'grid':
        return (
          <PageSection key={sectionKey} {...sectionProps}>
            <ResponsiveGrid
              columns={section.config?.columns || { xs: 1, sm: 2, lg: 3 }}
              gap={section.config?.gap || '1.5rem'}
            >
              {section.data?.map(
                (item: any, index: number) =>
                  section.config?.renderItem?.(item, index) || (
                    <div key={index}>{JSON.stringify(item)}</div>
                  )
              )}
            </ResponsiveGrid>
          </PageSection>
        );

      case 'table':
        return (
          <PageSection key={sectionKey} {...sectionProps}>
            {/* Table implementation would go here */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="text-center text-gray-500">Table component not implemented yet</div>
              </div>
            </div>
          </PageSection>
        );

      default:
        return (
          <PageSection key={sectionKey} {...sectionProps}>
            {section.data}
          </PageSection>
        );
    }
  }
}

/**
 * Page Templates for Common Patterns
 */
export const PageTemplates = {
  /**
   * Dashboard Template
   */
  dashboard: (
    title: string,
    stats: Statistic[],
    sections: PageSectionConfig[] = [],
    actions?: PageAction[]
  ) =>
    PageGenerator.generateDashboard({
      title,
      subtitle: `Manage and monitor your ${title.toLowerCase()}`,
      stats,
      sections,
      actions,
    }),

  /**
   * Settings Template
   */
  settings: (
    title: string,
    properties: PropertyRendererConfig[],
    onSubmit: (values: Record<string, any>) => void,
    initialValues?: Record<string, any>
  ) =>
    PageGenerator.generateFormPage({
      title,
      subtitle: `Configure your ${title.toLowerCase()} settings`,
      sections: [],
      form: {
        properties,
        onSubmit,
        initialValues,
        submitText: 'Save Settings',
        showCancel: true,
      },
    }),

  /**
   * List/Index Template
   */
  list: (
    title: string,
    items: any[],
    renderItem: (item: any, index: number) => React.ReactNode,
    createAction?: PageAction,
    emptyText?: string
  ) =>
    PageGenerator.generateListPage({
      title,
      subtitle: `Browse and manage ${title.toLowerCase()}`,
      sections: [],
      actions: createAction ? [createAction] : [],
      list: {
        items,
        renderItem,
        emptyText,
      },
    }),

  /**
   * Detail Template
   */
  detail: (title: string, content: React.ReactNode, actions?: PageAction[]) =>
    PageGenerator.generatePage({
      title,
      sections: [
        {
          id: 'detail-content',
          type: 'content',
          data: content,
        },
      ],
      actions,
    }),

  /**
   * Create/Edit Template
   */
  createEdit: (
    title: string,
    properties: PropertyRendererConfig[],
    onSubmit: (values: Record<string, any>) => void,
    initialValues?: Record<string, any>,
    isEdit = false
  ) =>
    PageGenerator.generateFormPage({
      title,
      subtitle: `${isEdit ? 'Edit' : 'Create'} ${title.toLowerCase()}`,
      sections: [],
      form: {
        properties,
        onSubmit,
        initialValues,
        submitText: isEdit ? 'Update' : 'Create',
        showCancel: true,
      },
    }),

  /**
   * Analytics Template
   */
  analytics: (title: string, stats: Statistic[], charts: PageSectionConfig[]) =>
    PageGenerator.generateDashboard({
      title,
      subtitle: `Analytics and insights for ${title.toLowerCase()}`,
      stats,
      sections: charts,
    }),
};

export default PageGenerator;
