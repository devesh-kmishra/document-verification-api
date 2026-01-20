import { Router } from "express";
import {
  addCandidateNote,
  createCandidate,
  getCandidateOverview,
  getCandidateSummary,
  getEmploymentTimeline,
} from "../controllers/candidate.controller";

const router = Router();

router.get("/:candidateId/employment-timeline", getEmploymentTimeline);
router.get("/:candidateId/summary", getCandidateSummary);
router.get("/:candidateId/overview", getCandidateOverview);
router.post("/", createCandidate);
router.post("/:candidateId/notes", addCandidateNote);

export default router;
