import type { NextFunction, Request, Response } from "express";
import { CareLinkModel } from "../models/careLink.model.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Resolves which patient's data a request targets and sets `req.patientId`.
 *  - PATIENT   → always themselves
 *  - CAREGIVER → `?patientId=` of a patient who accepted their care invite
 *  - ADMIN     → any `?patientId=` (read access for moderation/support)
 *  - DOCTOR / PHARMACY → no access to patient records
 */
export async function patientScope(req: Request, _res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  const requested = typeof req.query.patientId === "string" ? req.query.patientId : undefined;

  if (user.role === "PATIENT") {
    if (requested && requested !== user.id) throw ApiError.forbidden();
    req.patientId = user.id;
    return next();
  }

  // Doctors and pharmacies never browse patient records directly – they hand prescriptions over instead.
  if (user.role !== "CAREGIVER" && user.role !== "ADMIN") throw ApiError.forbidden();

  if (!requested) throw ApiError.badRequest("patientId query parameter is required");

  if (user.role === "CAREGIVER") {
    const linked = await CareLinkModel.isActiveCaregiver(requested, user.id);
    if (!linked) throw ApiError.forbidden("You are not a caregiver for this patient");
  }

  req.patientId = requested;
  next();
}
