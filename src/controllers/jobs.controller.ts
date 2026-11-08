import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { JOBS, type JobName } from "../jobs/handlers.js";
import { runTick } from "../jobs/tick.js";
import { ApiError } from "../utils/ApiError.js";
import { sendResponse } from "../utils/response.js";

function authorized(req: Request) {
  if (!env.CRON_SECRET) throw ApiError.notFound("Route not found");
  const header = req.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : String(req.query.key ?? ""));
  const expected = Buffer.from(env.CRON_SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const jobsController = {
  /** GET /api/jobs/tick[?job=<name>] — called every minute by Vercel Cron / cron-job.org. */
  async tick(req: Request, res: Response) {
    if (!authorized(req)) throw ApiError.unauthorized("Invalid cron secret");
    const job = typeof req.query.job === "string" && req.query.job in JOBS ? (req.query.job as JobName) : undefined;
    sendResponse(res, { data: await runTick(job) });
  },
};
