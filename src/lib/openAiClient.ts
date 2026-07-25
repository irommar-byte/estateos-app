/** Domyślny model tekstowy — włącz w OpenAI → Project → Model access. */
export const OPENAI_MODEL_DEFAULT = 'gpt-5-mini';
/** Fallback gdy gpt-5-mini nie jest włączone na projekcie. */
export const OPENAI_MODEL_FALLBACK = 'o4-mini';
/** Ostatni fallback (chat + JSON) — zawsze dostępny na koncie. */
export const OPENAI_MODEL_LEGACY = 'gpt-4o-mini';

type OpenAiClient = {
  embeddings: {
    create: (args: Record<string, unknown>) => Promise<{
      data: Array<{ embedding: number[] }>;
      usage?: { total_tokens?: number };
    }>;
  };
  responses: { create: (args: Record<string, unknown>) => Promise<{ output_text?: string }> };
  chat: {
    completions: {
      create: (args: Record<string, unknown>) => Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
};

export function resolveOpenAiModel(envKey?: 'OPENAI_LISTING_MODEL' | 'OPENAI_OTODOM_MODEL'): string {
  if (envKey) {
    const specific = process.env[envKey]?.trim();
    if (specific) return specific;
  }
  return process.env.OPENAI_DEFAULT_MODEL?.trim() || OPENAI_MODEL_DEFAULT;
}

export function buildModelFallbackChain(primary: string, options?: { json?: boolean }): string[] {
  const chain: string[] = [primary];
  const fallback = process.env.OPENAI_FALLBACK_MODEL?.trim() || OPENAI_MODEL_FALLBACK;
  const skipReasoningFallback = options?.json === true;
  if (primary === OPENAI_MODEL_DEFAULT && fallback && !chain.includes(fallback) && !skipReasoningFallback) {
    chain.push(fallback);
  }
  if (!chain.includes(OPENAI_MODEL_LEGACY)) {
    chain.push(OPENAI_MODEL_LEGACY);
  }
  return chain;
}

/** o-series zużywa tokeny na „myślenie” — daj większy budżet wyjścia. */
function resolveMaxOutputTokens(model: string, requested: number): number {
  if (/^o[0-9]/i.test(model.trim())) {
    return Math.max(requested, 3000);
  }
  return requested;
}

export function isModelAccessDenied(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not have access to model|model_not_found|404.*model/i.test(msg);
}

function isRetryableWithFallback(err: unknown): boolean {
  if (isModelAccessDenied(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /pusty wynik|empty result/i.test(msg);
}

export function openAiErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|rate limit/i.test(msg)) return 'Limit zapytań OpenAI — spróbuj za chwilę.';
  if (/does not have access to model/i.test(msg)) {
    return `Model ${OPENAI_MODEL_DEFAULT} nie jest włączony w panelu OpenAI (Project → Model access). Włącz gpt-5-mini lub skontaktuj się z administratorem.`;
  }
  if (/401|invalid.*key|incorrect api key/i.test(msg)) return 'Błąd konfiguracji OpenAI na serwerze.';
  if (/quota|insufficient/i.test(msg)) return 'Przekroczony limit konta OpenAI.';
  return `OpenAI: ${msg.slice(0, 140)}`;
}

/** GPT-5 / o-series na tym koncie działają przez Responses API (nie chat/completions). */
export function usesResponsesApi(model: string): boolean {
  return /^gpt-5|^o[0-9]/i.test(model.trim());
}

async function callResponsesModel(
  client: OpenAiClient,
  model: string,
  system: string,
  user: string,
  maxOutputTokens: number,
  json: boolean,
): Promise<string> {
  const args: Record<string, unknown> = {
    model,
    instructions: system,
    input: user,
    max_output_tokens: maxOutputTokens,
  };
  if (json) {
    args.text = { format: { type: 'json_object' } };
  }
  const response = await client.responses.create(args);
  const text = String(response.output_text || '').trim();
  if (!text) throw new Error('OpenAI Responses API zwróciło pusty wynik.');
  return text;
}

async function callChatModel(
  client: OpenAiClient,
  model: string,
  system: string,
  user: string,
  maxOutputTokens: number,
  temperature: number,
  json: boolean,
): Promise<string> {
  const args: Record<string, unknown> = {
    model,
    temperature,
    max_tokens: maxOutputTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (json) {
    args.response_format = { type: 'json_object' };
  }
  const completion = await client.chat.completions.create(args);
  const text = String(completion.choices[0]?.message?.content || '').trim();
  if (!text) throw new Error('OpenAI chat zwróciło pusty wynik.');
  return text;
}

export async function callOpenAiText(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxOutputTokens?: number;
  temperature?: number;
  json?: boolean;
  logPrefix?: string;
}): Promise<{ text: string; model: string }> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: params.apiKey }) as unknown as OpenAiClient;
  const json = params.json === true;
  const modelsToTry = buildModelFallbackChain(params.model, { json });
  const baseMaxOutputTokens = params.maxOutputTokens ?? 900;
  const temperature = params.temperature ?? 0.72;
  const userInput = json && !/\bjson\b/i.test(params.user) ? `${params.user}\n\nZwróć poprawny JSON.` : params.user;
  const logPrefix = params.logPrefix || 'openai';

  let lastError: unknown;
  for (const model of modelsToTry) {
    try {
      const maxOutputTokens = resolveMaxOutputTokens(model, baseMaxOutputTokens);
      const text = usesResponsesApi(model)
        ? await callResponsesModel(client, model, params.system, userInput, maxOutputTokens, json)
        : await callChatModel(client, model, params.system, userInput, maxOutputTokens, temperature, json);
      return { text, model };
    } catch (err) {
      lastError = err;
      if (isRetryableWithFallback(err) && model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[${logPrefix}] model ${model} unavailable, trying fallback`);
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('OpenAI request failed');
}

export function getOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim()?.replace(/^"|"$/g, '') || null;
}

export const OPENAI_DISCOVERY_EMBEDDING_MODEL = 'text-embedding-3-small';

export async function createOpenAiEmbedding(params: {
  apiKey: string;
  input: string;
  model?: string;
}): Promise<{ vector: number[]; tokens: number; model: string }> {
  const { default: OpenAI } = await import('openai');
  const model = params.model || process.env.OPENAI_DISCOVERY_EMBEDDING_MODEL?.trim() || OPENAI_DISCOVERY_EMBEDDING_MODEL;
  const client = new OpenAI({ apiKey: params.apiKey }) as unknown as OpenAiClient;
  const response = await client.embeddings.create({ model, input: params.input, encoding_format: 'float' });
  const vector = response.data[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) throw new Error('OpenAI embeddings zwróciło pusty wektor.');
  return { vector, tokens: Math.max(0, Number(response.usage?.total_tokens || 0)), model };
}
