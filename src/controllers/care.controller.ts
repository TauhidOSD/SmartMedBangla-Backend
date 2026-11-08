import type { Request, Response } from "express";
import { careService } from "../services/care.service.js";
import { sendResponse } from "../utils/response.js";

export const careController = {
  async invite(req: Request, res: Response) {
    const link = await careService.invite(req.user!, req.body.email, req.body.relation);
    sendResponse(res, { statusCode: 201, message: `Invitation sent to ${link.inviteEmail}`, data: link });
  },

  async caregivers(req: Request, res: Response) {
    sendResponse(res, { data: await careService.listCaregivers(req.user!.id) });
  },

  async revoke(req: Request, res: Response) {
    await careService.revoke(req.user!, req.params.id as string);
    sendResponse(res, { message: "Caregiver access removed" });
  },

  async invites(req: Request, res: Response) {
    sendResponse(res, { data: await careService.pendingInvites(req.user!) });
  },

  async respond(req: Request, res: Response) {
    const link = await careService.respond(req.user!, req.params.id as string, req.body.accept);
    sendResponse(res, { message: req.body.accept ? "Invitation accepted" : "Invitation declined", data: link });
  },

  async patients(req: Request, res: Response) {
    sendResponse(res, { data: await careService.patients(req.user!) });
  },

  async updatePatientAlerts(req: Request, res: Response) {
    const data = await careService.updatePatientAlerts(req.user!, req.params.patientId as string, req.body);
    sendResponse(res, { message: "Alert settings saved", data });
  },

  async patientOverview(req: Request, res: Response) {
    sendResponse(res, { data: await careService.patientOverview(req.user!, req.params.patientId as string) });
  },
};
