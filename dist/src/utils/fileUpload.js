import multer from "multer";
import cloudinary from "../lib/cloudinary";
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});
export const verificationUpload = upload.fields([
    { name: "offerLetter", maxCount: 1 },
    { name: "relievingLetter", maxCount: 1 },
]);
export async function uploadFile(file, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder,
            resource_type: "raw",
        }, (error, result) => {
            if (error || !result) {
                return reject(error);
            }
            resolve(result.secure_url);
        });
        stream.end(file.buffer);
    });
}
//# sourceMappingURL=fileUpload.js.map