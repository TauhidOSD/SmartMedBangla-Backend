import { GoogleGenAI, type Content } from "@google/genai";
import { env, features } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";

export interface AiImage {
  mimeType: string;
  /** base64 encoded bytes */
  data: string;
}

export interface GenerateOptions {
  system: string;
  prompt: string;
  images?: AiImage[];
  history?: { role: "user" | "assistant"; text: string }[];
  json?: boolean;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  provider: string;
}

/**
 * Per-provider limit. Two providers must fit inside the host's request limit (60 s on Vercel),
 * so a hanging primary model still leaves time for the fallback to answer.
 */
const TIMEOUT_MS = 25_000;
/** After a provider fails, skip it for a while so users don't wait for it on every request. */
const COOLDOWN_MS = 2 * 60_000;
const cooldownUntil = new Map<string, number>();

let gemini: GoogleGenAI | null = null;
const getGemini = () => (gemini ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! }));

async function generateWithGemini(opts: GenerateOptions): Promise<GenerateResult> {
  const contents: Content[] = [
    ...(opts.history ?? []).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })),
    {
      role: "user",
      parts: [...(opts.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })), { text: opts.prompt }],
    },
  ];
  const response = await getGemini().models.generateContent({
    model: env.GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return { text, provider: `gemini:${env.GEMINI_MODEL}` };
}

/** Groq exposes an OpenAI-compatible API – used as a fallback when Gemini fails. */
async function generateWithGroq(opts: GenerateOptions): Promise<GenerateResult> {
  const hasImages = Boolean(opts.images?.length);
  const model = hasImages ? env.GROQ_VISION_MODEL : env.GROQ_MODEL;
  if (!model) throw new Error("No Groq vision model configured");

  const userContent = hasImages
    ? [
        { type: "text", text: opts.prompt },
        ...opts.images!.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } })),
      ]
    : opts.prompt;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: opts.system },
        ...(opts.history ?? []).map((m) => ({ role: m.role, content: m.text })),
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned an empty response");
  return { text, provider: `groq:${model}` };
}

/**
 * Runs the prompt on the primary provider (Gemini) and falls back to Groq.
 * Throws a 503 ApiError with a friendly message when every provider fails.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const providers: { name: string; run: (o: GenerateOptions) => Promise<GenerateResult> }[] = [];
  if (features.gemini) providers.push({ name: "gemini", run: generateWithGemini });
  if (features.groq) providers.push({ name: "groq", run: generateWithGroq });

  if (!providers.length) {
    throw ApiError.unavailable("AI features are not configured on the server.", "AI_DISABLED");
  }

  // Providers in cooldown go last instead of being dropped, so a single configured provider still gets tried.
  const now = Date.now();
  providers.sort((a, b) => Number((cooldownUntil.get(a.name) ?? 0) > now) - Number((cooldownUntil.get(b.name) ?? 0) > now));

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const result = await provider.run(opts);
      cooldownUntil.delete(provider.name);
      return result;
    } catch (err) {
      lastError = err;
      cooldownUntil.set(provider.name, Date.now() + COOLDOWN_MS);
      logger.warn(`AI provider ${provider.name} failed:`, (err as Error).message);
    }
  }
  const error = ApiError.unavailable("Our AI assistant is busy right now. Please try again in a moment.", "AI_UNAVAILABLE");
  (error as { cause?: unknown }).cause = lastError;
  throw error;
}

/** Extracts the first JSON object from a model response (tolerates ```json fences and chatter). */
export function parseJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("AI response did not contain JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}
