import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { AWS_REGION, GENERATION_QUEUE_URL } from '../core/env.js';
import type { GenerationMessage } from '../core/types/index.js';

const client = new SQSClient({ region: AWS_REGION });

/**
 * Sends a generation request to the SQS GenerationQueue.
 * The message body contains everything workerInternal needs to generate a post
 * without an additional DynamoDB read.
 *
 * Returns the SQS MessageId for audit trail storage in SintoniaRequests.
 */
export async function sendGenerationRequest(message: GenerationMessage): Promise<string> {
  if (GENERATION_QUEUE_URL === '') {
    throw new Error('GENERATION_QUEUE_URL not configured — set it in .env.local or serverless.yml');
  }

  const result = await client.send(new SendMessageCommand({
    QueueUrl: GENERATION_QUEUE_URL,
    MessageBody: JSON.stringify(message),
  }));

  return result.MessageId ?? '';
}
