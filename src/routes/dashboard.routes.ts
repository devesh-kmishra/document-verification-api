import { Router } from "express";
import { getVerificationDashboard } from "../controllers/dashboard.controller";

const router = Router();

router.get("/verifications", getVerificationDashboard);

export default router;
