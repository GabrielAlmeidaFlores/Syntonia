import type { Tag } from '@/types';

export const AVAILABLE_TAGS: Tag[] = [
  'AWS',
  'React',
  'TypeScript',
  'Node.js',
  'Python',
  'Docker',
  'Kubernetes',
  'Linux',
  'DynamoDB',
  'PostgreSQL',
  'Redis',
  'GraphQL',
  'Rust',
  'Go',
  'CI/CD',
  'Terraform',
  'Serverless',
  'Security',
  'Performance',
  'Architecture',
];

export const DEFAULT_TAGS: Tag[] = ['AWS', 'TypeScript', 'React'];

export const TRIGGER_THRESHOLD = 2;

export const MAX_PENDING_REQUESTS = 5;

export const FEED_PAGE_SIZE = 5;

export const TAG_EXTRACTION_DELAY_MS = 2000;

export const JIT_GENERATION_DELAY_MS = 1500;
