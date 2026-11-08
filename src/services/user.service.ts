import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { AuditLogModel } from "../models/auditLog.model.js";
import { InventoryModel } from "../models/inventory.model.js";
import { MedicineModel, notDraft } from "../models/medicine.model.js";
import { NotificationModel } from "../models/notification.model.js";
import { PrescriptionModel } from "../models/prescription.model.js";
import { UserModel } from "../models/user.model.js";
import type { AuthUser } from "../types/express.js";
import { ApiError } from "../utils/ApiError.js";
import { randomToken } from "../utils/crypto.js";
import { addDays } from "../utils/time.js";
import { doseService } from "./dose.service.js";
import { env, features } from "../config/env.js";
import { normalizeBdPhone, placeVoiceCall, sendSms } from "./sms.service.js";
import { deleteImage, uploadImage } from "./upload.service.js";

export const userService = {
  async getProfile(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    return user;
  },

  /** A doctor / pharmacy that changes its licence number loses the verified badge until an admin re-checks it. */
  async updateProfile(userId: string, data: Prisma.UserUpdateInput) {
    if (typeof data.licenseNumber === "string" || data.licenseNumber === null) {
      const current = await UserModel.findById(userId);
      if (current?.isProVerified && current.licenseNumber !== data.licenseNumber) data = { ...data, isProVerified: false };
    }
    return UserModel.update(userId, data);
  },

  updatePreferences: (userId: string, data: Prisma.UserUpdateInput) => UserModel.update(userId, data),

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const current = await UserModel.findByIdWithSecrets(userId);
    const stored = await uploadImage(file.buffer, "avatars");
    const user = await UserModel.update(userId, { avatarUrl: stored.url, avatarPublicId: stored.publicId });
    await deleteImage(current?.avatarPublicId);
    return user;
  },

  /** Creates a read-only link a patient can show to any new doctor. */
  async createShareLink(userId: string, expiresInDays: number | null) {
    const user = await UserModel.update(userId, {
      shareToken: randomToken(18),
      shareExpiresAt: expiresInDays ? addDays(new Date(), expiresInDays) : null,
    });
    return { token: user.shareToken, expiresAt: user.shareExpiresAt, url: `${env.CLIENT_URL}/share/${user.shareToken}` };
  },

  /** Sends a test SMS (and call, if enabled) so the user can confirm offline alerts reach their phone. */
  async testAlert(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    if (!normalizeBdPhone(user.phone)) throw ApiError.badRequest("Add a valid mobile number first");
    const bn = user.language === "bn";
    const sms = await sendSms(user.phone, bn ? "স্মার্টমেড: এটি একটি পরীক্ষামূলক বার্তা। আপনার ফোনে রিমাইন্ডার আসবে।" : "SmartMed: this is a test message. Your reminders will arrive on this phone.");
    const call = user.callEnabled
      ? await placeVoiceCall(user.phone, bn ? "আসসালামু আলাইকুম। এটি স্মার্টমেডের পরীক্ষামূলক কল।" : "Hello. This is a test call from SmartMed.", user.language)
      : false;
    return { sms, call, smsConfigured: features.sms, voiceConfigured: features.voice };
  },

  revokeShareLink: (userId: string) => UserModel.update(userId, { shareToken: null, shareExpiresAt: null }),

  /** Public doctor view – medical history only, no contact or account data. */
  async sharedProfile(token: string) {
    const user = await UserModel.findByShareToken(token);
    if (!user || user.status !== "ACTIVE" || (user.shareExpiresAt && user.shareExpiresAt < new Date())) {
      throw ApiError.notFound("This share link is invalid or has expired");
    }
    const [prescriptions, medicines, adherence] = await Promise.all([
      prisma.prescription.findMany({
        where: { patientId: user.id, status: { in: ["VERIFIED", "PROCESSED"] } },
        orderBy: [{ prescribedDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          title: true,
          doctorName: true,
          hospital: true,
          prescribedDate: true,
          diagnosis: true,
          advice: true,
          imageUrl: true,
          status: true,
          createdAt: true,
          medicines: { select: { name: true, strength: true, dosagePattern: true, durationDays: true, mealTiming: true } },
        },
      }),
      MedicineModel.list(user.id, { active: true }),
      doseService.stats(user.id, 30),
    ]);
    return {
      patient: {
        name: user.name,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        bloodGroup: user.bloodGroup,
        allergies: user.allergies,
        chronicConditions: user.chronicConditions,
      },
      expiresAt: user.shareExpiresAt,
      currentMedicines: medicines.map((m) => ({
        name: m.name,
        genericName: m.genericName,
        strength: m.strength,
        dosagePattern: m.dosagePattern,
        mealTiming: m.mealTiming,
        startDate: m.startDate,
        endDate: m.endDate,
      })),
      prescriptions,
      adherence: { rate: adherence.adherenceRate, totals: adherence.totals },
    };
  },

  async deleteAccount(user: AuthUser, password: string) {
    const record = await UserModel.findByIdWithSecrets(user.id);
    if (!record || !(await bcrypt.compare(password, record.passwordHash))) throw ApiError.badRequest("Password is incorrect");
    if (record.role === "ADMIN") throw ApiError.forbidden("Admin accounts cannot be self-deleted");
    await UserModel.delete(user.id);
    await AuditLogModel.create({ action: "USER_SELF_DELETED", targetType: "User", targetId: user.id, meta: { email: user.email } });
  },

  /** Patient home dashboard – a single round trip with everything the overview needs. */
  async dashboard(patientId: string) {
    const [today, weekly, activeMedicines, prescriptions, cabinet, unread] = await Promise.all([
      doseService.today(patientId),
      doseService.stats(patientId, 7),
      prisma.medicine.count({ where: { patientId, isActive: true, AND: [notDraft] } }),
      PrescriptionModel.countForPatient(patientId),
      InventoryModel.list(patientId, { isDisposed: false, expiryDate: { lte: addDays(new Date(), 7) } }),
      NotificationModel.unreadCount(patientId),
    ]);
    return {
      today,
      weekly: { adherenceRate: weekly.adherenceRate, streakDays: weekly.streakDays, daily: weekly.daily, totals: weekly.totals },
      counts: { activeMedicines, prescriptions, expiringItems: cabinet.length, unreadNotifications: unread },
      expiringItems: cabinet.slice(0, 5),
    };
  },
};
