import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { patientScope } from "../middlewares/patientScope.middleware.js";
import { imageUpload } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { userValidator } from "../validators/user.validator.js";

const router = Router();

router.use(authenticate);

router.get("/me", userController.getProfile);
router.patch("/me", validate({ body: userValidator.updateProfile }), userController.updateProfile);
router.patch("/me/preferences", validate({ body: userValidator.updatePreferences }), userController.updatePreferences);
router.post("/me/avatar", imageUpload.single("image"), userController.uploadAvatar);
router.post("/me/share-link", validate({ body: userValidator.shareLink }), userController.createShareLink);
router.delete("/me/share-link", userController.revokeShareLink);
router.delete("/me", validate({ body: userValidator.deleteAccount }), userController.deleteAccount);
router.post("/me/test-alert", userController.testAlert);

router.get("/dashboard", patientScope, userController.dashboard);

export default router;
