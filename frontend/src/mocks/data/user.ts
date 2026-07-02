import type { UserProfile } from '@/types';

export const MOCK_USER: UserProfile = {
  userId: 'user-mock-001',
  email: 'dev@syntonia.app',
  description:
    'Senior backend developer focused on AWS serverless architecture and TypeScript. ' +
    'Building scalable APIs with Lambda, DynamoDB and SQS. ' +
    'Currently learning Kubernetes, Terraform and advanced security patterns.',
  activeTags: ['AWS', 'TypeScript', 'Serverless', 'DynamoDB', 'Node.js', 'Security'],
};
