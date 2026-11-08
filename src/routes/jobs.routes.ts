import { Router } from "express";
import { jobsController } from "../controllers/jobs.controller.js";

const router = Router();

router.get("/tick", jobsController.tick);
router.post("/tick", jobsController.tick);

export default router;
