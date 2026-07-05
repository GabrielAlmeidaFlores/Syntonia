/** DynamoDB item shape for SintoniaLegal. */
export interface LegalDocumentItem {
  /** Partition key — composite of type and language: e.g. "terms#en", "privacy#pt-BR". */
  readonly typeLanguage: string;
  /** Document type — stored as a non-key attribute for querying and display. */
  readonly type: 'terms' | 'privacy';
  /** Language of this document version. */
  readonly language: 'en' | 'pt-BR';
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly content: string;
}
