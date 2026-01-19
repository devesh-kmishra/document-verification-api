import { Router } from "express";
import {
  createVerification,
  getVerificationForm,
  submitVerification,
  addCallingLog,
} from "../controllers/employment.controller";
import { verificationUpload } from "../utils/fileUpload";

const router = Router();

router.get("/form/:token", getVerificationForm);
router.post("/", createVerification);
// todo: uncomment and use later
// router.post("/submit/:token", verificationUpload, submitVerification);
router.post("/submit/:token", submitVerification);
router.post("/:id/calling-log", addCallingLog);

export default router;
