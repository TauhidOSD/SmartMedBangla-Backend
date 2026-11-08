import type { Request, Response } from "express";
import { issuedService } from "../services/issued.service.js";
import { ApiError } from "../utils/ApiError.js";
import { sendResponse } from "../utils/response.js";

export const issuedController = {
  async create(req: Request, res: Response) {
    sendResponse(res, { statusCode: 201, message: "Prescription created", data: await issuedService.create(req.user!, req.body) });
  },

  async scan(req: Request, res: Response) {
    if (!req.file) throw ApiError.badRequest("Please attach a prescription photo");
    sendResponse(res, { message: "Prescription read successfully. Please review the medicines.", data: await issuedService.scan(req.user!, req.file) });
  },

  async list(req: Request, res: Response) {
    const { items, stats, meta } = await issuedService.list(req.user!, req.query);
    sendResponse(res, { data: { items, stats }, meta });
  },

  async get(req: Request, res: Response) {
    sendResponse(res, { data: await issuedService.get(req.user!, req.params.id as string) });
  },

  async remove(req: Request, res: Response) {
    await issuedService.remove(req.user!, req.params.id as string);
    sendResponse(res, { message: "Prescription deleted" });
  },

  async send(req: Request, res: Response) {
    const result = await issuedService.sendToPatient(req.user!, req.params.id as string, req.body.email);
    sendResponse(res, {
      message: result.delivered === "account" ? "Added to the patient's SmartMed account" : "Prescription link sent by email",
      data: result,
    });
  },

  async preview(req: Request, res: Response) {
    sendResponse(res, { data: await issuedService.preview(req.params.code as string) });
  },

  async claim(req: Request, res: Response) {
    const result = await issuedService.claim(req.user!, req.params.code as string);
    sendResponse(res, {
      statusCode: result.alreadyClaimed ? 200 : 201,
      message: result.alreadyClaimed ? "This prescription is already in your account" : "Prescription added to your account",
      data: result,
    });
  },
};
