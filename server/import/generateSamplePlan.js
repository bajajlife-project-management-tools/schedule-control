import * as XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const demoDir = join(__dirname, '..', '..', 'demo');
if (!existsSync(demoDir)) {
  mkdirSync(demoDir, { recursive: true });
}

const headers = [
  'Task ID', 'Milestone', 'Task Name',
  'Planned Start', 'Planned End',
  'Actual Start', 'Actual End',
  'Predecessor', 'Dependency Type', 'Owner'
];

const rows = [
  ['1.1', 'M1 - Discovery & Strategy', 'Stakeholder Interviews & Requirements', '2026-09-01', '2026-09-11', '2026-09-01', '2026-09-11', '', 'FS', 'Lead PM'],
  ['1.2', 'M1 - Discovery & Strategy', 'Current State Architecture Audit', '2026-09-01', '2026-09-15', '2026-09-01', '2026-09-18', '', 'FS', 'Architect'],
  ['1.3', 'M1 - Discovery & Strategy', 'Target State Definition & Governance', '2026-09-16', '2026-09-25', '2026-09-18', '2026-09-25', '1.1,1.2', 'FS', 'Architect'],
  
  ['2.1', 'M2 - Infrastructure Provisioning', 'VPC & Core Networking Configuration', '2026-09-28', '2026-10-09', '', '', '1.3', 'FS', 'Infra Lead'],
  ['2.2', 'M2 - Infrastructure Provisioning', 'Kubernetes Cluster & Node Pools', '2026-10-12', '2026-10-23', '', '', '2.1', 'FS', 'DevOps Lead'],
  ['2.3', 'M2 - Infrastructure Provisioning', 'IAM, Vault & Secrets Baseline', '2026-10-19', '2026-10-30', '', '', '2.2', 'FS', 'Security Lead'],

  ['3.1', 'M3 - Application Deployment', 'Core Microservices CI/CD Deployment', '2026-11-02', '2026-11-13', '', '', '2.3', 'FS', 'Dev Lead'],
  ['3.2', 'M3 - Application Deployment', 'Data Migration & Schema Validation', '2026-11-09', '2026-11-20', '', '', '3.1', 'FS', 'Data Lead'],
  ['3.3', 'M3 - Application Deployment', 'End-to-End System Integration Testing', '2026-11-23', '2026-12-04', '', '', '3.2', 'FS', 'QA Lead'],

  ['4.1', 'M4 - Go-Live & Handover', 'User Acceptance Testing & Sign-off', '2026-12-07', '2026-12-14', '', '', '3.3', 'FS', 'Business Lead'],
  ['4.2', 'M4 - Go-Live & Handover', 'Production Cutover & Hypercare', '2026-12-15', '2026-12-22', '', '', '4.1', 'FS', 'Project Manager'],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
XLSX.utils.book_append_sheet(wb, ws, 'Project Plan');

const filePath = join(demoDir, 'sample_project_plan.xlsx');
XLSX.writeFile(wb, filePath);

console.log('✅ Generated sample Excel project plan at:', filePath);
