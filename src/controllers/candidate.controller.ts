import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { create } from "node:domain";

interface Timeline {
  timestamp: Date;
  type: string;
  employmentId: string;
  company: string;
  documentType?: string;
  fileUrl?: string;
  message: string;
}

export const getCandidateOverview = async (req: Request, res: Response) => {
  const candidateId = req.params.candidateId as string;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      employments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!candidate) {
    return res.status(404).json({ message: "Candidate not found" });
  }

  const latestEmployment = candidate.employments[0];

  const allStatuses = await prisma.employmentVerification.findMany({
    where: { candidateId },
    select: { status: true },
  });

  const verificationStatus = getOverallStatusFromEmployments(
    allStatuses.map((e) => e.status),
  );

  res.json({
    candidateId: candidate.id,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    city: candidate.city,
    position: latestEmployment?.designation ?? "-",
    verificationStatus,
  });
};

export const getEmploymentTimeline = async (req: Request, res: Response) => {
  const candidateId = req.params.candidateId as string;

  const employments = await prisma.employmentVerification.findMany({
    where: { candidateId },
    include: {
      response: {
        include: {
          documents: true,
        },
      },
      callingLogs: true,
    },
  });

  const timeline: Timeline[] = [];

  for (const emp of employments) {
    timeline.push({
      timestamp: emp.createdAt,
      type: "EMPLOYMENT_ADDED",
      employmentId: emp.id,
      company: emp.previousCompanyName,
      message: `Employment at ${emp.previousCompanyName} added`,
    });

    if (emp.response) {
      timeline.push({
        timestamp: emp.response.submittedAt,
        type: "VERIFICATION_SUBMITTED",
        employmentId: emp.id,
        company: emp.previousCompanyName,
        message: "Verification submitted by previous employer",
      });

      for (const doc of emp.response.documents) {
        timeline.push({
          timestamp: doc.uploadedAt,
          type: "DOCUMENT_UPLOADED",
          employmentId: emp.id,
          company: emp.previousCompanyName,
          documentType: doc.type,
          fileUrl: doc.fileUrl,
          message: `${doc.type.replace("_", " ")} uploaded`,
        });
      }
    }

    for (const call of emp.callingLogs) {
      timeline.push({
        timestamp: call.callTime,
        type: "CALL_LOGGED",
        employmentId: emp.id,
        company: emp.previousCompanyName,
        message: `Manual HR call logged: ${call.outcome}`,
      });
    }
  }

  timeline.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  res.json({
    candidateId,
    timeline,
  });
};

export const getCandidateSummary = async (req: Request, res: Response) => {
  const candidateId = req.params.candidateId as string;

  const employments = await prisma.employmentVerification.findMany({
    where: { candidateId },
  });
  const notes = await prisma.candidateNote.findMany({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (employments.length === 0) {
    return res.json({
      candidateId,
      overallStatus: "CLEAR",
      riskScore: 0,
      remarks: ["No previous employments found"],
      employmentBreakdown: [],
      hrNotes: notes,
    });
  }

  const breakdown = employments.map((emp) => {
    const risk = getRiskForStatus(emp.status);

    return {
      company: emp.previousCompanyName,
      status: emp.status,
      risk,
    };
  });

  const highestRisk = Math.max(...breakdown.map((b) => b.risk));
  const multipleEmploymentPenalty = employments.length > 1 ? 5 : 0;
  const riskScore = Math.min(highestRisk + multipleEmploymentPenalty, 100);

  const remarks: string[] = [];

  if (breakdown.some((b) => b.status === "DISCREPANCY")) {
    remarks.push("One or more employment verifications have discrepancies");
  }

  if (breakdown.some((b) => b.status === "FAILED")) {
    remarks.push("One or more employment verifications failed");
  }

  if (employments.length > 1) {
    remarks.push("Multiple previous employments detected");
  }

  res.json({
    candidateId,
    overallStatus: getOverallStatus(riskScore),
    riskScore,
    remarks,
    employmentBreakdown: breakdown,
    hrNotes: notes,
  });
};

export const addCandidateNote = async (req: Request, res: Response) => {
  const candidateId = req.params.candidateId as string;
  const { note } = req.body;

  if (!note || !note.trim()) {
    return res.status(400).json({ message: "Note is required" });
  }

  const createdNote = await prisma.candidateNote.create({
    data: {
      candidateId,
      note,
    },
  });

  res.status(201).json(create);
};

function getOverallStatusFromEmployments(statuses: string[]) {
  if (statuses.includes("FAILED")) return "HIGH_RISK";
  if (statuses.includes("DISCREPANCY")) return "REVIEW";
  if (statuses.some((s) => s === "PENDING" || s === "IN_PROGRESS")) {
    return "IN_PROGRESS";
  }
  return "CLEAR";
}

function getRiskForStatus(status: string): number {
  switch (status) {
    case "CLEAR":
      return 0;
    case "PENDING":
    case "IN_PROGRESS":
      return 10;
    case "DISCREPANCY":
      return 40;
    case "FAILED":
      return 70;
    default:
      return 0;
  }
}

function getOverallStatus(riskScore: number) {
  if (riskScore <= 20) return "CLEAR";
  if (riskScore <= 50) return "REVIEW";
  return "HIGH_RISK";
}
