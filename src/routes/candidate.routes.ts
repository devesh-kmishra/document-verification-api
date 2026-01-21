import { Router } from "express";
import {
  addCandidateNote,
  createCandidate,
  getCandidateOverview,
  getCandidateSummary,
  getEmploymentTimeline,
  getVerificationQueue,
  searchCandidates,
  uploadCandidateResume,
} from "../controllers/candidate.controller";
import { upload } from "../utils/fileUpload";

const router = Router();

router.get("/queue", getVerificationQueue);
router.get("/search", searchCandidates);
router.get("/:candidateId/employment-timeline", getEmploymentTimeline);
router.get("/:candidateId/summary", getCandidateSummary);
router.get("/:candidateId/overview", getCandidateOverview);
router.post("/", createCandidate);
router.post("/:candidateId/notes", addCandidateNote);
router.post(
  "/:candidateId/resume",
  upload.single("resume"),
  uploadCandidateResume,
);

export default router;
