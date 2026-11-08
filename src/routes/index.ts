import { Router } from "express";
import { features } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { userController } from "../controllers/user.controller.js";
import { adminService } from "../services/admin.service.js";
import { sendResponse } from "../utils/response.js";
import adminRoutes from "./admin.routes.js";
import aiRoutes from "./ai.routes.js";
import authRoutes from "./auth.routes.js";
import careRoutes from "./care.routes.js";
import doseRoutes from "./dose.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import { claimRoutes, issuedRoutes } from "./issued.routes.js";
import medicineRoutes from "./medicine.routes.js";
import notificationRoutes from "./notification.routes.js";
import paymentRoutes from "./payment.routes.js";
import prescriptionRoutes from "./prescription.routes.js";
import userRoutes from "./user.routes.js";

const router = Router();

router.get("/health", async (_req, res) => {
  let database = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }
  res.status(database === "up" ? 200 : 503).json({
    success: database === "up",
    service: "smartmed-api",
    database,
    integrations: {
      ai: features.gemini || features.groq,
      imageStorage: features.cloudinary,
      redis: features.redis,
      email: features.smtp,
      webPush: features.webPush,
      payments: features.sslcommerz,
      sms: features.sms,
      voiceCall: features.voice,
    },
    uptime: Math.round(process.uptime()),
  });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/prescriptions", prescriptionRoutes);
router.use("/medicines", medicineRoutes);
router.use("/doses", doseRoutes);
router.use("/cabinet", inventoryRoutes);
router.use("/care", careRoutes);
router.use("/notifications", notificationRoutes);
router.use("/ai", aiRoutes);
router.use("/payments", paymentRoutes);
router.use("/admin", adminRoutes);
router.use("/issued", issuedRoutes);
router.use("/claim", claimRoutes);

// Public, read-only doctor view
router.get("/share/:token", userController.sharedProfile);

// Public impact numbers for the landing page (real counts, cached)
router.get("/stats/public", async (_req, res) => {
  sendResponse(res, { data: await adminService.publicStats() });
});

export default router;
