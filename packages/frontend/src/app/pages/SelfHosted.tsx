/**
 * Self-Hosted Page
 *
 * Comprehensive self-hosted deployment information for KlikkFlow
 * Deployment options, system requirements, and getting started guides
 */

import {
  Box,
  CheckCircle,
  Cloud,
  Container,
  Copy,
  Database,
  Download,
  ExternalLink,
  Globe,
  Lock,
  Play,
  Server,
  Shield,
  Terminal,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Integrations/Landing/Footer';
import { Header } from '../components/Integrations/Landing/Header';

export const SelfHosted: React.FC = () => {
  const [activeDeployment, setActiveDeployment] = useState('docker');
  const [copiedCommand, setCopiedCommand] = useState('');

  const deploymentOptions = [
    {
      id: 'docker',
      name: 'Docker Compose',
      description: 'Quick setup for development and small deployments',
      icon: Container,
      difficulty: 'Easy',
      setupTime: '5 minutes',
      suitable: 'Development, Small Teams',
    },
    {
      id: 'kubernetes',
      name: 'Kubernetes',
      description: 'Production-ready deployment with auto-scaling',
      icon: Box,
      difficulty: 'Intermediate',
      setupTime: '15 minutes',
      suitable: 'Production, Enterprise',
    },
    {
      id: 'manual',
      name: 'Manual Installation',
      description: 'Custom setup with full control over configuration',
      icon: Server,
      difficulty: 'Advanced',
      setupTime: '30 minutes',
      suitable: 'Custom Environments',
    },
  ];

  const commands = {
    docker: {
      title: 'Docker Compose Deployment',
      steps: [
        {
          description: 'Download the docker-compose.yml file',
          command:
            'curl -o docker-compose.yml https://raw.githubusercontent.com/klikkflow/klikkflow/main/docker-compose.yml',
        },
        {
          description: 'Start all services',
          command: 'docker-compose up -d',
        },
        {
          description: 'Access KlikkFlow',
          command: '# Open http://localhost:5678 in your browser',
        },
      ],
    },
    kubernetes: {
      title: 'Kubernetes Deployment',
      steps: [
        {
          description: 'Add KlikkFlow Helm repository',
          command: 'helm repo add klikkflow https://helm.klikkflow.dev',
        },
        {
          description: 'Update Helm repositories',
          command: 'helm repo update',
        },
        {
          description: 'Install KlikkFlow',
          command:
            'helm install klikkflow klikkflow/klikkflow --namespace klikkflow --create-namespace',
        },
        {
          description: 'Get the application URL',
          command: 'kubectl get ingress -n klikkflow',
        },
      ],
    },
    manual: {
      title: 'Manual Installation',
      steps: [
        {
          description: 'Install Node.js 20+ and npm',
          command: '# Install Node.js from https://nodejs.org/',
        },
        {
          description: 'Clone the repository',
          command: 'git clone https://github.com/KlikkAI/klikkflow.git && cd klikkflow',
        },
        {
          description: 'Install dependencies',
          command: 'npm install && npm run build',
        },
        {
          description: 'Start the application',
          command: 'npm start',
        },
      ],
    },
  };

  const features = [
    {
      title: 'Complete Data Sovereignty',
      description:
        'Your data never leaves your infrastructure. No external dependencies or third-party services required.',
      icon: Lock,
      benefits: ['Full data control', 'Zero external calls', 'Privacy compliant'],
    },
    {
      title: 'Hybrid Database Architecture',
      description:
        'MongoDB for operational data, PostgreSQL with pgvector for AI and analytics workloads.',
      icon: Database,
      benefits: ['Best of both worlds', 'AI-ready', 'Scalable storage'],
    },
    {
      title: 'Enterprise Security',
      description:
        'End-to-end encryption, SSO integration, and comprehensive audit logging built-in.',
      icon: Shield,
      benefits: ['Enterprise SSO', 'Audit trails', 'Encryption at rest'],
    },
    {
      title: 'Cloud Agnostic',
      description:
        'Deploy on any cloud provider or on-premises infrastructure with the same configuration.',
      icon: Cloud,
      benefits: ['Vendor flexibility', 'Avoid lock-in', 'Cost optimization'],
    },
    {
      title: 'Auto-Scaling',
      description:
        'Kubernetes-native deployment with horizontal pod autoscaling and load balancing.',
      icon: Zap,
      benefits: ['Handle traffic spikes', 'Cost efficient', 'High availability'],
    },
    {
      title: 'Global Deployment',
      description: 'Multi-region deployment support with data residency compliance.',
      icon: Globe,
      benefits: ['Low latency', 'Data residency', 'Disaster recovery'],
    },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(''), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <Header />
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Self-Hosted
              </span>
              <br />
              Workflow Automation
            </h1>
            <p className="text-xl text-slate-200 mb-8 max-w-3xl mx-auto leading-relaxed">
              Complete control over your data and infrastructure. Deploy KlikkFlow anywhere - cloud,
              on-premises, or air-gapped environments with enterprise-grade security.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg text-lg hover:scale-105 transition-transform flex items-center gap-2">
                <Download className="w-5 h-5" />
                Quick Start
              </button>
              <button className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg text-lg border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2">
                <Play className="w-5 h-5" />
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Deployment Options */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Deployment Options</h2>
            <p className="text-xl text-gray-600">
              Choose the deployment method that fits your infrastructure and requirements
            </p>
          </div>

          {/* Deployment Method Selector */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {deploymentOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => setActiveDeployment(option.id)}
                  className={`p-6 rounded-xl transition-all duration-300 ${
                    activeDeployment === option.id
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white scale-105 shadow-xl'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-lg'
                  }`}
                >
                  <div className="text-center">
                    <Icon
                      className={`w-8 h-8 mx-auto mb-3 ${
                        activeDeployment === option.id ? 'text-white' : 'text-blue-600'
                      }`}
                    />
                    <h3 className="font-semibold text-lg mb-2">{option.name}</h3>
                    <p
                      className={`text-sm mb-3 ${
                        activeDeployment === option.id ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {option.description}
                    </p>

                    <div className="space-y-1 text-sm">
                      <div
                        className={
                          activeDeployment === option.id ? 'text-blue-100' : 'text-gray-600'
                        }
                      >
                        <strong>Difficulty:</strong> {option.difficulty}
                      </div>
                      <div
                        className={
                          activeDeployment === option.id ? 'text-blue-100' : 'text-gray-600'
                        }
                      >
                        <strong>Setup:</strong> {option.setupTime}
                      </div>
                      <div
                        className={
                          activeDeployment === option.id ? 'text-blue-100' : 'text-gray-600'
                        }
                      >
                        <strong>Best for:</strong> {option.suitable}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Command Instructions */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">
                  {commands[activeDeployment as keyof typeof commands].title}
                </h3>
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-400 text-sm">Terminal</span>
                </div>
              </div>

              <div className="space-y-6">
                {commands[activeDeployment as keyof typeof commands].steps.map((step, index) => (
                  <div key={index} className="space-y-2">
                    <div className="text-gray-300 text-sm">
                      {index + 1}. {step.description}
                    </div>
                    <div className="relative">
                      <pre className="bg-black rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
                        <code>{step.command}</code>
                      </pre>
                      <button
                        onClick={() => copyToClipboard(step.command)}
                        className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedCommand === step.command ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Domain Configuration Info */}
              <div className="mt-6 p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
                <div className="flex items-center gap-2 text-purple-300 mb-2">
                  <Globe className="w-4 h-4" />
                  <span className="font-medium">Custom Domain Configuration</span>
                </div>
                <p className="text-purple-200 text-sm">
                  Want to use your own domain or set up subdomains for multi-tenant deployment?{' '}
                  <Link
                    to="/docs/deployment/domain-management"
                    className="underline hover:text-white font-semibold"
                  >
                    View our Domain & Subdomain Management guide
                  </Link>{' '}
                  for AWS, GCP, Azure, and Cloudflare configuration.
                </p>
              </div>

              <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                <div className="flex items-center gap-2 text-blue-300 mb-2">
                  <ExternalLink className="w-4 h-4" />
                  <span className="font-medium">Need Help?</span>
                </div>
                <p className="text-blue-200 text-sm">
                  Check out our comprehensive{' '}
                  <a href="#" className="underline hover:text-white">
                    deployment guide
                  </a>{' '}
                  or join our{' '}
                  <a href="#" className="underline hover:text-white">
                    community forum
                  </a>{' '}
                  for support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System Requirements */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">System Requirements</h2>
              <p className="text-xl text-gray-600">
                Hardware and software requirements for different deployment scenarios
              </p>
            </div>

            {/* System requirements content placeholder */}
            <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <p className="text-center text-gray-600">
                System requirements details coming soon...
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Self-Host */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Why Self-Host?</h2>
            <p className="text-xl text-gray-600">
              Complete control, security, and customization for your workflow automation needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="mb-4">
                    <Icon className="w-8 h-8 text-blue-600 group-hover:text-blue-700 transition-colors mb-4" />
                    <h3 className="font-semibold text-xl text-gray-900 mb-2 group-hover:text-blue-900 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 mb-4">{feature.description}</p>
                  </div>

                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Migration Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Migration Made Easy</h2>
            <p className="text-xl text-gray-600">
              Seamlessly migrate from existing workflow platforms to your self-hosted KlikkFlow
            </p>
          </div>
          <h2 className="text-4xl font-bold mb-6">Ready to Deploy Your Own?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Start your self-hosted journey today. Complete data sovereignty, enterprise security,
            and unlimited scalability await.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg text-lg hover:bg-gray-100 transition-colors flex items-center gap-2 justify-center">
              <Download className="w-5 h-5" />
              Download Now
            </button>
            <button className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-lg text-lg hover:bg-white/10 transition-colors flex items-center gap-2 justify-center">
              <ExternalLink className="w-5 h-5" />
              Documentation
            </button>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm opacity-80">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              100% Open Source
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              No License Fees
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Community Support
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default SelfHosted;
