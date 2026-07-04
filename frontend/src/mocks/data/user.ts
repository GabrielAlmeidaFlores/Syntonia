import type { Language, Theme } from "@/stores/preferences";
import type { Tag, UserProfile } from "@/types";

interface MockUser extends UserProfile {
  readonly theme: Theme;
  readonly language: Language;
  readonly activeTags: Tag[];
}

export const MOCK_USER: MockUser = {
  userId: "user-mock-001",
  email: "dev@syntonia.app",
  description:
    "Senior backend developer focused on AWS serverless architecture and TypeScript. " +
    "Building scalable APIs with Lambda, DynamoDB and SQS. " +
    "Currently learning Kubernetes, Terraform and advanced security patterns.",
  activeTags: [
    "AWS",
    "TypeScript",
    "Serverless",
    "DynamoDB",
    "Node.js",
    "Security",
  ],
  theme: "dark",
  language: "en",
};
