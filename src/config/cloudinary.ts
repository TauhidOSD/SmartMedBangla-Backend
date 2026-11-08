import { v2 as cloudinary } from "cloudinary";
import { logger } from "../utils/logger.js";
import { env, features } from "./env.js";

if (features.cloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Cloudinary rejects signed requests whose timestamp is more than 1 hour off ("Stale request").
 * A machine with a wrong clock or time zone would break every upload, so the signing timestamp
 * follows Cloudinary's own clock (read from its `Date` header) instead of the local one.
 */
let clockOffsetMs = 0;
let lastSync = 0;
const RESYNC_MS = 30 * 60_000;

const sdkUtils = cloudinary.utils as unknown as { timestamp: () => number };
sdkUtils.timestamp = () => Math.floor((Date.now() + clockOffsetMs) / 1000);

export async function syncCloudinaryClock(force = false) {
  if (!features.cloudinary || (!force && Date.now() - lastSync < RESYNC_MS)) return;
  try {
    const res = await fetch("https://api.cloudinary.com", { method: "HEAD", signal: AbortSignal.timeout(5000) });
    const serverTime = Date.parse(res.headers.get("date") ?? "");
    if (Number.isNaN(serverTime)) return;
    clockOffsetMs = serverTime - Date.now();
    lastSync = Date.now();
    if (Math.abs(clockOffsetMs) > 5 * 60_000) {
      logger.warn(`Server clock is ${Math.round(clockOffsetMs / 60_000)} min off Cloudinary time — compensating. Fix the system clock / time zone.`);
    }
  } catch (err) {
    logger.warn("Could not read Cloudinary time:", (err as Error).message);
  }
}

export { cloudinary };
