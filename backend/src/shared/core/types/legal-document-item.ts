/** DynamoDB item shape for SintoniaLegal. */
export interface LegalDocumentItem {
  readonly type: 'terms' | 'privacy';
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly content: string;
}
