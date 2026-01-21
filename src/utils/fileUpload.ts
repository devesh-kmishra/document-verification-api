import multer from "multer";
import cloudinary from "../lib/cloudinary";

export const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error("Only PDF or Word documents are allowed"));
      return;
    }

    cb(null, true);
  },
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
