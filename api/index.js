// Vercel serverless entry: the compiled Express app handles every request.
// Background jobs do not run here; an external cron calls GET /api/jobs/tick every minute instead.
import { createApp } from "../dist/app.js";

export default createApp();
