import { Router } from "express";
import { issuedController } from "../controllers/issued.controller.js";
import { authenticate, authorize, requireVerifiedEmail } from "../middlewares/auth.middleware.js";
import { aiLimiter } from "../middlewares/rateLimit.middleware.js";
import { imageUpload } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { idParam } from "../validators/common.validator.js";
import { issuedValidator } from "../validators/issued.validator.js";

/** Doctors and pharmacies: write / scan prescriptions and hand them to patients. */
export const issuedRoutes = Router();

issuedRoutes.use(authenticate, authorize("DOCTOR", "PHARMACY"));

issuedRoutes.get("/", validate({ query: issuedValidator.listQuery }), issuedController.list);
issuedRoutes.post("/", requireVerifiedEmail, validate({ body: issuedValidator.create }), issuedController.create);
issuedRoutes.post("/scan", authorize("PHARMACY"), requireVerifiedEmail, aiLimiter, imageUpload.single("image"), issuedController.scan);
issuedRoutes.get("/:id", validate({ params: idParam }), issuedController.get);
issuedRoutes.delete("/:id", validate({ params: idParam }), issuedController.remove);
issuedRoutes.post("/:id/send", requireVerifiedEmail, validate({ params: idParam, body: issuedValidator.send }), issuedController.send);

/** Patients: preview (public, via QR) and claim a prescription. */
export const claimRoutes = Router();

claimRoutes.get("/:code", validate({ params: issuedValidator.codeParam }), issuedController.preview);
claimRoutes.post("/:code", authenticate, validate({ params: issuedValidator.codeParam }), issuedController.claim);
