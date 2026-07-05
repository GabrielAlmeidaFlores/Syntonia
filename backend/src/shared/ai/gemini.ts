import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../core/env.js';
import type { GeneratedPost, PostSummaryWithLike, Tag } from '../core/types.js';

const PRIMARY_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-pro';

/** Thrown when Gemini fails to generate usable content after all retries. */
export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

/**
 * Generates a unique technical post using Gemini.
 * Tries the primary model first; falls back to the secondary on failure.
 * Includes recent posts as deduplication context to avoid repeating topics.
 *
 * @param tags — content tags that guide the topic of the generated article.
 * @param description — the user's free-text profile description, injected
 *   into the prompt to make the article more relevant to their background.
 * @param recentPosts — titles and summaries of the last 30 posts already
 *   generated for this user on these tags. Used as deduplication context so
 *   Gemini avoids repeating topics.
 */
export async function generatePost(params: {
  readonly tags: Tag[];
  readonly description: string | null;
  readonly recentPosts: PostSummaryWithLike[];
}): Promise<GeneratedPost> {
  const prompt = buildPostPrompt(params.tags, params.description, params.recentPosts);
  let raw: string;
  try {
    raw = await callGemini(PRIMARY_MODEL, prompt);
  } catch {
    raw = await callGemini(FALLBACK_MODEL, prompt);
  }
  return parseGeminiResponse(raw);
}

/**
 * Extracts relevant content tags from a user's profile description using Gemini.
 *
 * Returns whatever tags the AI considers relevant — there is no predefined
 * allow-list. Tags are free-form strings representing the user's areas of
 * interest (e.g. "AWS", "Rust", "distributed systems", "WebAssembly").
 *
 * Throws GeminiError if no tags can be extracted or if both models fail.
 *
 * @param description — the user's free-text profile description.
 */
export async function extractTagsFromDescription(description: string): Promise<Tag[]> {
  const prompt = buildTagExtractionPrompt(description);
  let raw: string;
  try {
    raw = await callGemini(PRIMARY_MODEL, prompt);
  } catch {
    raw = await callGemini(FALLBACK_MODEL, prompt);
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const extracted: unknown = JSON.parse(cleaned);

  if (!Array.isArray(extracted)) {
    throw new GeminiError('Expected a JSON array of tags');
  }

  const tags = (extracted as unknown[])
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim());

  if (tags.length === 0) {
    throw new GeminiError('No tags could be extracted from the description');
  }

  return tags;
}

async function callGemini(modelName: string, prompt: string): Promise<string> {
  if (GEMINI_API_KEY === '') {
    throw new GeminiError('GEMINI_API_KEY not configured — set it in .env.local or SSM');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

function buildPostPrompt(
  tags: Tag[],
  description: string | null,
  recentPosts: PostSummaryWithLike[],
): string {
  let recentContext = '';
  if (recentPosts.length > 0) {
    const lines = recentPosts.map((p, i) => {
      const liked = p.likedAt !== undefined ? ' [❤️ LIKED by user]' : '';
      return `${String(i + 1)}. "${p.title}" — ${p.summary}${liked}`;
    });
    recentContext = `\nRecent posts already generated for this user on these tags (last ${String(recentPosts.length)} posts):\n${lines.join('\n')}\n\nDO NOT repeat these topics or close variations.\nPRIORITISE generating content SIMILAR IN STYLE AND DEPTH to the posts marked [❤️ LIKED by user] — those reflect the user's preferences.\n`;
  }

  return `You are generating a technical article for a developer.
${description !== null ? `Developer profile: "${description}"\n` : ''}
Active areas of interest: ${tags.join(', ')}.
${recentContext}
Generate a UNIQUE, dense, and original technical article about a specific and advanced subtopic within these areas of interest.${recentPosts.length > 0 ? ' The article MUST be substantially different from any topic listed above.' : ''}

Respond EXCLUSIVELY with a valid JSON object (no markdown, no text before or after):

{
  "title": "Precise and technical title (max 60 characters)",
  "summary": "One sentence explaining the practical value (max 120 characters)",
  "content": "## Title\\n\\nFull Markdown content with at least 600 words and real functional code blocks.",
  "tags": ["tag1", "tag2"],
  "gradient": ["#hexcolor1", "#hexcolor2"]
}

Mandatory rules:
1. Content must have at least 600 words
2. Include at least one real, functional code block with comments
3. Expert-level content — assume the reader is a professional developer
4. Gradient colors must be coherent with the topic theme (e.g. AWS = orange/amber, TypeScript = blue, Docker = cyan/dark)
5. Do not include any text before or after the JSON`;
}

function buildTagExtractionPrompt(description: string): string {
  return `Given this developer profile description:
"${description}"

Extract the most relevant technical areas of interest from this description.
These will be used to generate personalised technical content for the user.

Rules:
1. Return between 3 and 10 tags
2. Tags should be specific technical topics (technologies, concepts, tools, languages)
3. Order by relevance (most relevant first)
4. Use concise labels (e.g. "AWS", "TypeScript", "distributed systems", "Rust")
5. Respond ONLY with a valid JSON array of strings

Example response: ["AWS", "TypeScript", "Node.js", "serverless", "DynamoDB"]`;
}

function parseGeminiResponse(raw: string): GeneratedPost {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  for (const field of ['title', 'summary', 'content', 'tags', 'gradient']) {
    if (!parsed[field]) {
      throw new GeminiError(`Missing required field: ${field}`);
    }
  }

  const gradient = parsed['gradient'];
  if (!Array.isArray(gradient) || gradient.length !== 2) {
    throw new GeminiError('gradient must be an array of exactly 2 hex color strings');
  }

  return {
    title: String(parsed['title']),
    summary: String(parsed['summary']),
    content: String(parsed['content']),
    tags: parsed['tags'] as Tag[],
    gradient: [String(gradient[0]), String(gradient[1])],
  };
}
