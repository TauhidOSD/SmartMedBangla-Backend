import type { Request, Response } from "express";
import { userService } from "../services/user.service.js";
import { ApiError } from "../utils/ApiError.js";
import { clearAuthCookies } from "../utils/cookies.js";
import { sendResponse } from "../utils/response.js";

export const userController = {
  async getProfile(req: Request, res: Response) {
    sendResponse(res, { data: await userService.getProfile(req.user!.id) });
  },

  async updateProfile(req: Request, res: Response) {
    sendResponse(res, { message: "Profile updated", data: await userService.updateProfile(req.user!.id, req.body) });
  },

  async updatePreferences(req: Request, res: Response) {
    sendResponse(res, { message: "Preferences saved", data: await userService.updatePreferences(req.user!.id, req.body) });
  },

  async uploadAvatar(req: Request, res: Response) {
    if (!req.file) throw ApiError.badRequest("Please choose an image");
    sendResponse(res, { message: "Photo updated", data: await userService.uploadAvatar(req.user!.id, req.file) });
  },

  async createShareLink(req: Request, res: Response) {
    const link = await userService.createShareLink(req.user!.id, req.body.expiresInDays);
    sendResponse(res, { statusCode: 201, message: "Share link created", data: link });
  },

  async revokeShareLink(req: Request, res: Response) {
    await userService.revokeShareLink(req.user!.id);
    sendResponse(res, { message: "Share link disabled" });
  },

  async sharedProfile(req: Request, res: Response) {
    sendResponse(res, { data: await userService.sharedProfile(req.params.token as string) });
  },

  async testAlert(req: Request, res: Response) {
    const result = await userService.testAlert(req.user!.id);
    sendResponse(res, {
      message: result.smsConfigured ? "Test alert sent" : "SMS provider is not configured – the message was only logged on the server",
      data: result,
    });
  },

  async dashboard(req: Request, res: Response) {
    sendResponse(res, { data: await userService.dashboard(req.patientId!) });
  },

  async deleteAccount(req: Request, res: Response) {
    await userService.deleteAccount(req.user!, req.body.password);
    clearAuthCookies(res);
    sendResponse(res, { message: "Your account has been deleted" });
  },
};
