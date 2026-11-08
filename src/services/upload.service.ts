import type { UploadApiResponse } from "cloudinary";
import { cloudinary, syncCloudinaryClock } from "../config/cloudinary.js";
import { features } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export type UploadFolder = "prescriptions" | "medicine-strips" | "avatars";

/** Streams an in-memory image to Cloudinary and returns its secure URL. */
export async function uploadImage(buffer: Buffer, folder: UploadFolder): Promise<{ url: string; publicId: string }> {
  if (!features.cloudinary) {
    throw ApiError.unavailable("Image storage is not configured on the server", "STORAGE_DISABLED");
  }
  await syncCloudinaryClock();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `smartmed/${folder}`,
        resource_type: "image",
        // Keep originals readable for OCR, but cap the size to save bandwidth.
        transformation: [{ width: 2000, height: 2000, crop: "limit", quality: "auto:good" }],
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          logger.error("Cloudinary upload failed:", error?.message);
          if (error?.message?.includes("Stale request")) void syncCloudinaryClock(true);
          return reject(ApiError.unavailable("Could not upload image. Please try again."));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId?: string | null) {
  if (!publicId || !features.cloudinary) return;
  try {
    await syncCloudinaryClock();
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.warn("Cloudinary delete failed:", (err as Error).message);
  }
}
