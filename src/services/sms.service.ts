/**
 * Offline alerts for patients without internet or a smartphone.
 *  - SMS:   BulkSMSBD (Bangladesh) or Twilio
 *  - Voice: Twilio automated call that reads the reminder aloud
 * With provider "log" (default) nothing is sent – the message is printed instead.
 * Never throws: a failed SMS must not break reminders or the request that triggered it.
 */
import { env, features } from "../config/env.js";
import { logger } from "../utils/logger.js";

/** Normalises Bangladeshi numbers to E.164 without "+": 01712345678 → 8801712345678. */
export function normalizeBdPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  if (/^01[3-9]\d{8}$/.test(digits)) return `88${digits}`;
  if (/^1[3-9]\d{8}$/.test(digits)) return `880${digits}`;
  // Other countries (caregivers abroad) – accept a plausible international number as-is.
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

async function twilio(path: string, body: Record<string, string>) {
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Twilio HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function sendSms(phone: string | null | undefined, message: string): Promise<boolean> {
  const to = normalizeBdPhone(phone);
  if (!to) return false;
  if (!features.sms) {
    logger.warn(`[sms ${env.SMS_PROVIDER === "log" ? "log" : "not configured"}] to=${to} "${message}"`);
    return false;
  }
  try {
    if (env.SMS_PROVIDER === "bulksmsbd") {
      const res = await fetch("https://bulksmsbd.net/api/smsapi", {
        method: "POST",
        body: new URLSearchParams({
          api_key: env.BULKSMSBD_API_KEY!,
          senderid: env.BULKSMSBD_SENDER_ID!,
          number: to,
          message,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json().catch(() => ({}))) as { response_code?: number | string; error_message?: string };
      if (String(data.response_code) !== "202") throw new Error(`BulkSMSBD code ${data.response_code}: ${data.error_message ?? "unknown"}`);
    } else {
      await twilio("Messages.json", { To: `+${to}`, From: env.TWILIO_FROM_NUMBER!, Body: message });
    }
    return true;
  } catch (err) {
    logger.error(`SMS to ${to} failed:`, (err as Error).message);
    return false;
  }
}

/** Places an automated call that speaks `text` twice (Bangla or English voice). */
export async function placeVoiceCall(phone: string | null | undefined, text: string, lang: "bn" | "en"): Promise<boolean> {
  const to = normalizeBdPhone(phone);
  if (!to) return false;
  if (!features.voice) {
    logger.warn(`[voice call ${env.VOICE_PROVIDER === "log" ? "log" : "not configured"}] to=${to} "${text}"`);
    return false;
  }
  const voice = lang === "bn" ? 'language="bn-IN" voice="Google.bn-IN-Standard-A"' : 'language="en-US" voice="Polly.Joanna"';
  const say = `<Say ${voice}>${escapeXml(text)}</Say>`;
  try {
    await twilio("Calls.json", {
      To: `+${to}`,
      From: env.TWILIO_FROM_NUMBER!,
      Twiml: `<Response>${say}<Pause length="1"/>${say}</Response>`,
    });
    return true;
  } catch (err) {
    logger.error(`Voice call to ${to} failed:`, (err as Error).message);
    return false;
  }
}
