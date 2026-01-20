import { Router } from "express";
import {
  addCandidateNote,
  createCandidate,
  getCandidateOverview,
  getCandidateSummary,
  getEmploymentTimeline,
  getVerificationQueue,
  searchCandidates,
} from "../controllers/candidate.controller";

const router = Router();

router.get("/queue", getVerificationQueue);
router.get("/search", searchCandidates);
router.get("/:candidateId/employment-timeline", getEmploymentTimeline);
router.get("/:candidateId/summary", getCandidateSummary);
router.get("/:candidateId/overview", getCandidateOverview);
router.post("/", createCandidate);
router.post("/:candidateId/notes", addCandidateNote);

export default router;
