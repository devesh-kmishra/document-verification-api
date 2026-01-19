import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import cloudinary from "../lib/cloudinary";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const verificationUpload = upload.fields([
  { name: "offerLetter", maxCount: 1 },
  { name: "relievingLetter", maxCount: 1 },
]);

export async function uploadFile(
  file: Express.Multer.File,
  folder: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "raw",
      },
      (error, result) => {
        if (error || !result) {
          return reject(error);
        }
        resolve(result.secure_url);
      },
    );

    stream.end(file.buffer);
  });
}
