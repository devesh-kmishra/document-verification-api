import { Router } from "express";
import {
  addCandidateNote,
  getCandidateOverview,
  getCandidateSummary,
  getEmploymentTimeline,
} from "../controllers/candidate.controller";

const router = Router();

router.get("/:candidateId/employment-timeline", getEmploymentTimeline);
router.get("/:candidateId/summary", getCandidateSummary);
router.get("/:candidateId/overview", getCandidateOverview);
router.post("/:candidateId/notes", addCandidateNote);

export default router;
