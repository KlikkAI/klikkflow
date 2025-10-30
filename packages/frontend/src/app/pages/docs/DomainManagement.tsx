/**
 * Domain & Subdomain Management Documentation Page
 *
 * Displays comprehensive guide for domain configuration,
 * subdomain routing, and multi-tenant setup
 */

import type React from 'react';
import { Helmet } from 'react-helmet-async';
import { MarkdownRenderer } from '@/app/components/Documentation';
import domainManagementMd from '../../../../../../docs/deployment/domain-management.md?raw';

export const DomainManagement: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Domain & Subdomain Management - Reporunner Documentation</title>
        <meta
          name="description"
          content="Configure custom domains, subdomains, and multi-tenant routing for Reporunner - AWS, GCP, Azure, Cloudflare setup guides"
        />
      </Helmet>

      <div className="max-w-4xl">
        <MarkdownRenderer content={domainManagementMd} />
      </div>
    </>
  );
};
