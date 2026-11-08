import { logger } from "../utils/logger.js";
import { JOBS, type JobName } from "./handlers.js";

/**
 * Serverless replacement for the in-process scheduler: an external cron calls this once a minute
 * and it runs every job whose schedule matches the current minute (Asia/Dhaka, same patterns as JOBS).
 * All handlers are idempotent, so a duplicate or late tick is harmless.
 */
export function dueJobs(now = new Date()): JobName[] {
  const minute = now.getUTCMinutes();
  const dhakaHour = (now.getUTCHours() + 6) % 24;
  const due: JobName[] = ["dispatch-reminders"];
  if (minute % 5 === 0) due.push("missed-doses");
  if (minute === 5) due.push("materialize-doses");
  if (minute === 15) due.push("expiry-alerts");
  if (dhakaHour === 3 && minute === 30) due.push("daily-maintenance");
  return due;
}

export async function runTick(only?: JobName) {
  const names = only ? [only] : dueJobs();
  const results: Record<string, "ok" | string> = {};
  for (const name of names) {
    try {
      await JOBS[name].handler();
      results[name] = "ok";
    } catch (err) {
      results[name] = (err as Error).message;
      logger.error(`Job ${name} failed:`, (err as Error).message);
    }
  }
  return results;
}
