import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import type { OtpPurpose, Role } from "../generated/prisma/enums.js";
import { OtpModel } from "../models/otp.model.js";
import { SessionModel } from "../models/session.model.js";
import { UserModel } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { generateOtp, randomToken, sha256 } from "../utils/crypto.js";
import { signAccessToken } from "../utils/jwt.js";
import { addMinutes } from "../utils/time.js";
import { emailTemplates } from "../views/emails/templates.js";
import { sendEmail } from "./email.service.js";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

async function issueTokens(user: { id: string; role: Role }, meta: ClientMeta) {
  const refreshToken = randomToken(48);
  const session = await SessionModel.create({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    userAgent: meta.userAgent?.slice(0, 255),
    ip: meta.ip,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: session.id });
  return { accessToken, refreshToken };
}

async function sendOtp(user: { id: string; name: string; email: string }, purpose: OtpPurpose) {
  const code = generateOtp();
  await OtpModel.replace(user.id, purpose, await bcrypt.hash(code, 10), addMinutes(new Date(), OTP_TTL_MINUTES));
  await sendEmail(user.email, emailTemplates.otp(user.name, code, purpose));
}

async function consumeOtp(userId: string, purpose: OtpPurpose, code: string) {
  const otp = await OtpModel.findLatestActive(userId, purpose);
  if (!otp) throw ApiError.badRequest("Code expired. Please request a new one.");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw ApiError.tooMany("Too many wrong attempts. Please request a new code.");
  if (!(await bcrypt.compare(code, otp.codeHash))) {
    await OtpModel.incrementAttempts(otp.id);
    throw ApiError.badRequest("Incorrect code");
  }
  await OtpModel.consume(otp.id);
}

export const authService = {
  async register(
    input: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      role: "PATIENT" | "CAREGIVER" | "DOCTOR" | "PHARMACY";
      organization?: string;
      licenseNumber?: string;
      specialty?: string;
    },
    meta: ClientMeta,
  ) {
    if (await UserModel.findByEmail(input.email)) throw ApiError.conflict("An account with this email already exists");

    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      organization: input.organization,
      licenseNumber: input.licenseNumber,
      specialty: input.specialty,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
    await sendOtp(user, "EMAIL_VERIFY");
    const tokens = await issueTokens(user, meta);
    return { user, tokens };
  },

  async login(input: { email: string; password: string }, meta: ClientMeta) {
    const user = await UserModel.findByEmail(input.email);
    const invalid = ApiError.unauthorized("Invalid email or password");
    if (!user) {
      await bcrypt.compare(input.password, "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv"); // equalise timing
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ApiError(423, `Account temporarily locked after too many failed attempts. Try again in ${minutes} minute(s).`, {
        code: "ACCOUNT_LOCKED",
      });
    }
    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      const attempts = user.failedLoginAttempts + 1;
      const lock = attempts >= MAX_FAILED_LOGINS ? addMinutes(new Date(), LOCK_MINUTES) : null;
      await UserModel.registerFailedLogin(user.id, lock ? 0 : attempts, lock);
      throw invalid;
    }
    if (user.status === "SUSPENDED") throw ApiError.forbidden("Your account has been suspended. Contact support.");

    await UserModel.registerSuccessfulLogin(user.id);
    const tokens = await issueTokens(user, meta);
    return { user: await UserModel.findById(user.id), tokens };
  },

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw ApiError.unauthorized("No refresh token");
    const session = await SessionModel.findActiveByHash(sha256(refreshToken));
    if (!session) throw ApiError.unauthorized("Session expired. Please log in again.");
    if (session.user.status === "SUSPENDED") throw ApiError.forbidden("Your account has been suspended.");

    // Rotate the refresh token on every use.
    const nextRefresh = randomToken(48);
    await SessionModel.rotate(session.id, sha256(nextRefresh), new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000));
    const accessToken = signAccessToken({ sub: session.user.id, role: session.user.role, sid: session.id });
    return { accessToken, refreshToken: nextRefresh };
  },

  logout: (sessionId: string) => SessionModel.revoke(sessionId),

  async logoutByRefreshToken(refreshToken: string | undefined) {
    if (!refreshToken) return;
    const session = await SessionModel.findActiveByHash(sha256(refreshToken));
    if (session) await SessionModel.revoke(session.id);
  },

  async verifyEmail(email: string, code: string) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw ApiError.badRequest("Incorrect code");
    if (user.isEmailVerified) return UserModel.findById(user.id);
    await consumeOtp(user.id, "EMAIL_VERIFY", code);
    return UserModel.update(user.id, { isEmailVerified: true });
  },

  async resendOtp(email: string, purpose: OtpPurpose) {
    const user = await UserModel.findByEmail(email);
    // Do not reveal whether the email exists.
    if (!user || (purpose === "EMAIL_VERIFY" && user.isEmailVerified)) return;
    const latest = await OtpModel.findLatest(user.id, purpose);
    if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw ApiError.tooMany(`Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.`);
    }
    await sendOtp(user, purpose);
  },

  async forgotPassword(email: string) {
    const user = await UserModel.findByEmail(email);
    if (user && user.status === "ACTIVE") await sendOtp(user, "PASSWORD_RESET");
  },

  async resetPassword(email: string, code: string, password: string) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw ApiError.badRequest("Incorrect code");
    await consumeOtp(user.id, "PASSWORD_RESET", code);
    await UserModel.update(user.id, {
      passwordHash: await bcrypt.hash(password, 12),
      isEmailVerified: true, // proving inbox ownership also verifies the email
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await SessionModel.revokeAllForUser(user.id);
  },

  async changePassword(userId: string, sessionId: string, currentPassword: string, newPassword: string) {
    const user = await UserModel.findByIdWithSecrets(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest("Current password is incorrect");
    }
    await UserModel.update(userId, { passwordHash: await bcrypt.hash(newPassword, 12) });
    await SessionModel.revokeAllForUser(userId, sessionId);
  },

  listSessions: (userId: string) => SessionModel.listActive(userId),

  async revokeSession(userId: string, sessionId: string) {
    const sessions = await SessionModel.listActive(userId);
    if (!sessions.some((s) => s.id === sessionId)) throw ApiError.notFound("Session not found");
    await SessionModel.revoke(sessionId);
  },

  revokeOtherSessions: (userId: string, currentSessionId: string) => SessionModel.revokeAllForUser(userId, currentSessionId),
};
