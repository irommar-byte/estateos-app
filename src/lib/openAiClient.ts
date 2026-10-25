/**
 * Jedno miejsce wywołań OpenAI dla całej aplikacji.
 *
 * Modele (październik 2026):
 * - `gpt-6-luna` — domyślny: tani i szybki ($0,10 / $0,50 za 1 mln tokenów), następca gpt-4o-mini.
 * - `gpt-4o-mini` — awaryjny, gdy nowy model nie jest włączony w projekcie (wyłączany 14.01.2027).
 * `o4-mini` (wyłączony 23.10.2026) i `gpt-5-mini` (wyłączany 11.12.2026) zostały usunięte z łańcucha.
 *
 * Modele GPT-5+/GPT-6 i seria o idą przez Responses API (z poziomem rozumowania),
 * starsze przez Chat Completions. Każde wywołanie zapisuje dzienne zużycie (AiUsageDaily).
 */

export const OPENAI_MODEL_DEFAULT = 'gpt-6-luna';
/** Ostatni ratunek, gdy nowy model jest niedostępny dla projektu. */
export const OPENAI_MODEL_LEGACY = 'gpt-4o-mini';
/** @deprecated o4-mini zostało wyłączone przez OpenAI 23.10.2026 — zostawione dla zgodności importów. */
export const OPENAI_MODEL_FALLBACK = OPENAI_MODEL_LEGACY;

export type OpenAiReasoningEffort = 'none' | 'low' | 'medium';

export type OpenAiJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

type OpenAiUsage = { inputTokens: number; outputTokens: number };

type OpenAiClient = {
  embeddings: {
    create: (args: Record<string, unknown>) => Promise<{
      data: Array<{ embedding: number[] }>;
      usage?: { total_tokens?: number };
    }>;
  };
  responses: {
    create: (args: Record<string, unknown>) => Promise<{
      output_text?: string;
      status?: string;
      incomplete_details?: { reason?: string } | null;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
  chat: {
    completions: {
      create: (args: Record<string, unknown>) => Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }>;
    };
  };
};

/** Cena za 1 mln tokenów (USD) — do szacowania kosztu w panelu. */
const PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gpt-6-luna': { input: 0.1, output: 0.5 },
  'gpt-6.1-sol': { input: 2, output: 10 },
  'gpt-6-astra': { input: 10, output: 50 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-5-mini': { input: 0.25, output: 2 },
};

export function estimateOpenAiCostMicroUsd(model: string, usage: OpenAiUsage): number {
  const key = Object.keys(PRICE_PER_MILLION).find((name) => model === name || model.startsWith(`${name}-`));
  const price = key ? PRICE_PER_MILLION[key] : PRICE_PER_MILLION[OPENAI_MODEL_DEFAULT];
  return Math.round(usage.inputTokens * price.input + usage.outputTokens * price.output);
}

export function resolveOpenAiModel(envKey?: 'OPENAI_LISTING_MODEL' | 'OPENAI_OTODOM_MODEL'): string {
  if (envKey) {
    const specific = process.env[envKey]?.trim();
    if (specific) return specific;
  }
  return process.env.OPENAI_DEFAULT_MODEL?.trim() || OPENAI_MODEL_DEFAULT;
}

/** Wycofane modele mapujemy na następców — stary wpis w .env nie wyłączy AI po cichu. */
const RETIRED_MODELS: Record<string, string> = {
  'o4-mini': OPENAI_MODEL_DEFAULT,
  'o4-mini-2025-04-16': OPENAI_MODEL_DEFAULT,
  'gpt-5-mini': OPENAI_MODEL_DEFAULT,
  'gpt-5-mini-2025-08-07': OPENAI_MODEL_DEFAULT,
  'gpt-5-nano': OPENAI_MODEL_DEFAULT,
};

function upgradeRetiredModel(model: string): string {
  return RETIRED_MODELS[model.trim()] || model.trim();
}

export function buildModelFallbackChain(primary: string, _options?: { json?: boolean; skipReasoningFallback?: boolean }): string[] {
  const chain: string[] = [];
  const push = (model: string | undefined | null) => {
    const value = model ? upgradeRetiredModel(model) : '';
    if (value && !chain.includes(value)) chain.push(value);
  };
  push(primary);
  push(process.env.OPENAI_FALLBACK_MODEL?.trim());
  push(OPENAI_MODEL_DEFAULT);
  push(OPENAI_MODEL_LEGACY);
  return chain;
}

export function isModelAccessDenied(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not have access to model|model_not_found|404.*model|model .* (does not exist|has been deprecated|was deprecated)|not allowed to use model/i.test(msg);
}

function isRetryableWithFallback(err: unknown): boolean {
  if (isModelAccessDenied(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  // Nowy model może nie znać parametru starszego API (i odwrotnie) — spróbuj następnego zamiast wyłączać AI.
  return /pusty wynik|empty result|unsupported (parameter|value)|unknown parameter|not supported with this model/i.test(msg);
}

export function openAiErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|rate limit/i.test(msg)) return 'Limit zapytań OpenAI — spróbuj za chwilę.';
  if (isModelAccessDenied(err)) {
    return `Model ${OPENAI_MODEL_DEFAULT} nie jest włączony w projekcie OpenAI (lista dozwolonych modeli projektu).`;
  }
  if (/401|invalid.*key|incorrect api key/i.test(msg)) return 'Błąd konfiguracji OpenAI na serwerze.';
  if (/quota|insufficient/i.test(msg)) return 'Przekroczony limit konta OpenAI.';
  return `OpenAI: ${msg.slice(0, 140)}`;
}

/** GPT-5+, GPT-6 i seria o działają przez Responses API (nie chat/completions). */
export function usesResponsesApi(model: string): boolean {
  return /^(gpt-([5-9]|\d{2})|o\d)/i.test(model.trim());
}

/** gpt-5 (pierwsza generacja) zna „minimal”, nowsze — „none”. Seria o nie ma trybu bez rozumowania. */
function reasoningParam(model: string, effort: OpenAiReasoningEffort): Record<string, unknown> | undefined {
  const name = model.trim().toLowerCase();
  if (/^o\d/.test(name)) return { effort: effort === 'none' ? 'low' : effort };
  if (/^gpt-5(-|$)/.test(name)) return { effort: effort === 'none' ? 'minimal' : effort };
  if (usesResponsesApi(name)) return { effort };
  return undefined;
}

async function callResponsesModel(
  client: OpenAiClient,
  model: string,
  system: string,
  user: string,
  maxOutputTokens: number,
  json: boolean,
  jsonSchema: OpenAiJsonSchema | undefined,
  effort: OpenAiReasoningEffort,
): Promise<{ text: string; usage: OpenAiUsage }> {
  let budget = maxOutputTokens;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const args: Record<string, unknown> = {
      model,
      instructions: system,
      input: user,
      max_output_tokens: budget,
    };
    const reasoning = reasoningParam(model, effort);
    if (reasoning) args.reasoning = reasoning;
    if (jsonSchema) {
      args.text = { format: { type: 'json_schema', name: jsonSchema.name, schema: jsonSchema.schema, strict: true } };
    } else if (json) {
      args.text = { format: { type: 'json_object' } };
    }
    const response = await client.responses.create(args);
    const usage = {
      inputTokens: Number(response.usage?.input_tokens || 0),
      outputTokens: Number(response.usage?.output_tokens || 0),
    };
    const text = String(response.output_text || '').trim();
    const cutOff = response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens';
    if (text && !cutOff) return { text, usage };
    if (cutOff && attempt === 0) {
      // Rozumowanie zjadło budżet — jedna próba z podwójnym limitem zamiast przejścia na szablon.
      budget = Math.min(budget * 2, 16_000);
      continue;
    }
    throw new Error('OpenAI Responses API zwróciło pusty wynik.');
  }
  throw new Error('OpenAI Responses API zwróciło pusty wynik.');
}

async function callChatModel(
  client: OpenAiClient,
  model: string,
  system: string,
  user: string,
  maxOutputTokens: number,
  temperature: number,
  json: boolean,
  jsonSchema: OpenAiJsonSchema | undefined,
): Promise<{ text: string; usage: OpenAiUsage }> {
  const legacyParams = /^gpt-(4|3\.5)/i.test(model.trim());
  const args: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (legacyParams) {
    args.temperature = temperature;
    args.max_tokens = maxOutputTokens;
  } else {
    args.max_completion_tokens = maxOutputTokens;
  }
  if (jsonSchema) {
    args.response_format = {
      type: 'json_schema',
      json_schema: { name: jsonSchema.name, schema: jsonSchema.schema, strict: true },
    };
  } else if (json) {
    args.response_format = { type: 'json_object' };
  }
  const completion = await client.chat.completions.create(args);
  const text = String(completion.choices[0]?.message?.content || '').trim();
  if (!text) throw new Error('OpenAI chat zwróciło pusty wynik.');
  return {
    text,
    usage: {
      inputTokens: Number(completion.usage?.prompt_tokens || 0),
      outputTokens: Number(completion.usage?.completion_tokens || 0),
    },
  };
}

function usageDayKey(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
}

/** Dzienne liczniki: wywołania, błędy, tokeny, koszt — widoczne w panelu Automatyzacja. */
async function recordAiUsage(feature: string, model: string, usage: OpenAiUsage | null, failed: boolean) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const cost = usage ? estimateOpenAiCostMicroUsd(model, usage) : 0;
    await prisma.$executeRawUnsafe(
      `INSERT INTO AiUsageDaily (day, feature, model, calls, failures, inputTokens, outputTokens, costMicroUsd)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         calls = calls + 1,
         failures = failures + VALUES(failures),
         inputTokens = inputTokens + VALUES(inputTokens),
         outputTokens = outputTokens + VALUES(outputTokens),
         costMicroUsd = costMicroUsd + VALUES(costMicroUsd)`,
      usageDayKey(),
      feature.slice(0, 48),
      model.slice(0, 64),
      failed ? 1 : 0,
      usage?.inputTokens ?? 0,
      usage?.outputTokens ?? 0,
      cost,
    );
  } catch {
    /* statystyka nie może zatrzymać importu */
  }
}

export async function callOpenAiText(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxOutputTokens?: number;
  temperature?: number;
  json?: boolean;
  /** Ścisły format odpowiedzi — model nie zwróci niepoprawnego JSON. */
  jsonSchema?: OpenAiJsonSchema;
  /** Poziom rozumowania dla nowych modeli. Domyślnie „none” — najszybciej i najtaniej. */
  reasoningEffort?: OpenAiReasoningEffort;
  skipReasoningFallback?: boolean;
  logPrefix?: string;
  /** Nazwa funkcji do statystyk zużycia (np. „import-rewrite”). */
  feature?: string;
}): Promise<{ text: string; model: string; usage: OpenAiUsage }> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: params.apiKey, timeout: 55_000, maxRetries: 1 }) as unknown as OpenAiClient;
  const json = params.json === true || Boolean(params.jsonSchema);
  const modelsToTry = buildModelFallbackChain(params.model);
  const baseMaxOutputTokens = params.maxOutputTokens ?? 900;
  const temperature = params.temperature ?? 0.72;
  const userInput = json && !/\bjson\b/i.test(params.user) ? `${params.user}\n\nZwróć poprawny JSON.` : params.user;
  const logPrefix = params.logPrefix || 'openai';
  const feature = params.feature || logPrefix;
  const effort = params.reasoningEffort ?? 'none';

  let lastError: unknown;
  for (const model of modelsToTry) {
    try {
      const result = usesResponsesApi(model)
        ? await callResponsesModel(client, model, params.system, userInput, baseMaxOutputTokens, json, params.jsonSchema, effort)
        : await callChatModel(client, model, params.system, userInput, baseMaxOutputTokens, temperature, json, params.jsonSchema);
      void recordAiUsage(feature, model, result.usage, false);
      return { text: result.text, model, usage: result.usage };
    } catch (err) {
      lastError = err;
      void recordAiUsage(feature, model, null, true);
      if (isRetryableWithFallback(err) && model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[${logPrefix}] model ${model} niedostępny (${openAiErrorMessage(err)}), próbuję następnego`);
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
  const client = new OpenAI({ apiKey: params.apiKey, timeout: 30_000, maxRetries: 1 }) as unknown as OpenAiClient;
  const response = await client.embeddings.create({ model, input: params.input, encoding_format: 'float' });
  const vector = response.data[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) throw new Error('OpenAI embeddings zwróciło pusty wektor.');
  return { vector, tokens: Math.max(0, Number(response.usage?.total_tokens || 0)), model };
}

/** Zużycie AI z ostatnich dni — do panelu Automatyzacja. */
export async function listAiUsage(days = 30): Promise<
  Array<{ day: string; feature: string; model: string; calls: number; failures: number; inputTokens: number; outputTokens: number; costUsd: number }>
> {
  const { prisma } = await import('@/lib/prisma');
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT day, feature, model, calls, failures, inputTokens, outputTokens, costMicroUsd
     FROM AiUsageDaily
     WHERE day >= ?
     ORDER BY day DESC, feature ASC`,
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() - days * 86_400_000)),
  ).catch(() => [])) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    day: String(row.day),
    feature: String(row.feature),
    model: String(row.model),
    calls: Number(row.calls || 0),
    failures: Number(row.failures || 0),
    inputTokens: Number(row.inputTokens || 0),
    outputTokens: Number(row.outputTokens || 0),
    costUsd: Number(row.costMicroUsd || 0) / 1_000_000,
  }));
}
