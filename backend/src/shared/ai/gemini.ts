import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../core/env.js';
import type { GeneratedPost, PostSummaryWithLike, Tag } from '../core/types/index.js';

const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-pro';

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
 * @param language — the user's preferred language; Gemini will generate the
 *   entire article in this language ('en' = English, 'pt-BR' = Brazilian Portuguese).
 */
export async function generatePost(params: {
  readonly tags: Tag[];
  readonly description: string | null;
  readonly recentPosts: PostSummaryWithLike[];
  readonly language: 'en' | 'pt-BR';
}): Promise<GeneratedPost> {
  const prompt = buildPostPrompt(params.tags, params.description, params.recentPosts, params.language);
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
  language: 'en' | 'pt-BR',
): string {
  const langInstruction = language === 'pt-BR'
    ? 'Write the ENTIRE article in Brazilian Portuguese (pt-BR). All titles, summaries, explanations and code comments must be in Portuguese.'
    : 'Write the ENTIRE article in English.';

  let recentContext = '';
  if (recentPosts.length > 0) {
    const lines = recentPosts.map((p, i) => {
      const liked = p.likedAt !== undefined ? ' [❤️ LIKED by user]' : '';
      return `${String(i + 1)}. "${p.title}" — ${p.summary}${liked}`;
    });
    recentContext = `\nRecent posts already generated for this user on these tags (last ${String(recentPosts.length)} posts):\n${lines.join('\n')}\n\nDO NOT repeat these topics or close variations.\nPRIORITISE generating content SIMILAR IN STYLE AND DEPTH to the posts marked [❤️ LIKED by user] — those reflect the user's preferences.\n`;
  }

  const profileDirective = description !== null
    ? `The following is the user's content profile and generation directives. Follow them strictly — they define tone, style, depth and content scope:\n---\n${description}\n---\n`
    : '';

  return `You are generating a high-quality, in-depth article for a user with specific content preferences.
${profileDirective}
Topic area for this article: ${tags.join(', ')}.
${recentContext}
LANGUAGE INSTRUCTION: ${langInstruction}

Generate a UNIQUE, dense and original article about a specific and advanced subtopic within the given topic area.${recentPosts.length > 0 ? ' The article MUST be substantially different from any topic listed above.' : ''}
The article can cover technology, history, geopolitics, finance, military strategy, economics, or any other domain indicated by the topic area and user profile — it does NOT need to be a technical software article.

Respond EXCLUSIVELY with a valid JSON object (no markdown, no text before or after):

{
  "title": "Precise and informative title (max 60 characters)",
  "summary": "One sentence explaining the practical value (max 120 characters)",
  "content": "## Title\\n\\nFull Markdown content with at least 600 words. Include code blocks only when relevant to the topic.",
  "tags": ["tag1", "tag2"],
  "gradient": ["#hexcolor1", "#hexcolor2"]
}

Mandatory rules:
1. Content must have at least 600 words
2. Include code blocks only when directly relevant (omit for history, geopolitics, finance articles)
3. Expert-level content — assume the reader is knowledgeable in the subject area
4. Gradient colors must be coherent with the topic theme (e.g. AWS = orange/amber, TypeScript = blue, History = earthy tones, Finance = green/gold, Geopolitics = grey/navy)
5. Do not include any text before or after the JSON`;
}

function buildTagExtractionPrompt(description: string): string {
  return `Given this user profile and content generation instructions:
"${description}"

Extract ALL distinct areas of interest and content categories from this profile.
These tags will be used to generate personalized content across all the user's interest areas.

Rules:
1. Return between 5 and 20 tags
2. Tags represent ANY area of interest — technology, history, geopolitics, finance, cybersecurity, military strategy, economics, etc.
3. Be comprehensive: capture ALL content pillars mentioned, not just technical ones
4. Order by relevance (most relevant first)
5. Use concise English labels that describe the topic clearly
6. Respond ONLY with a valid JSON array of strings, no other text

Example response: ["AWS", "Microservices", "Cybersecurity", "Geopolitics", "Roman History", "Cryptocurrency", "Stock Market", "Software Architecture", "Clean Code", "Political Analysis"]`;
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
