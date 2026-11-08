import { Router } from "express";
import { z } from "zod";
import { careController } from "../controllers/care.controller.js";
import { authenticate, authorize, requireVerifiedEmail } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { careValidator } from "../validators/care.validator.js";
import { idParam } from "../validators/common.validator.js";
import { userValidator } from "../validators/user.validator.js";

const router = Router();

router.use(authenticate);

// Patient side
router.get("/caregivers", authorize("PATIENT"), careController.caregivers);
router.post("/caregivers", authorize("PATIENT"), requireVerifiedEmail, validate({ body: careValidator.invite }), careController.invite);
router.delete("/caregivers/:id", authorize("PATIENT"), validate({ params: idParam }), careController.revoke);

// Caregiver side
router.get("/invites", authorize("CAREGIVER"), careController.invites);
router.post(
  "/invites/:id/respond",
  authorize("CAREGIVER"),
  requireVerifiedEmail,
  validate({ params: idParam, body: careValidator.respond }),
  careController.respond,
);
router.get("/patients", authorize("CAREGIVER"), careController.patients);
router.get(
  "/patients/:patientId",
  authorize("CAREGIVER", "ADMIN"),
  validate({ params: z.object({ patientId: z.string().min(1) }) }),
  careController.patientOverview,
);

router.patch(
  "/patients/:patientId/alerts",
  authorize("CAREGIVER"),
  validate({ params: z.object({ patientId: z.string().min(1) }), body: userValidator.alerts }),
  careController.updatePatientAlerts,
);

export default router;
