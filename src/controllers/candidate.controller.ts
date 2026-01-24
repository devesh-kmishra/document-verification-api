import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { VerificationStatus } from "../../generated/prisma/enums";
import { EmploymentVerification } from "../../generated/prisma/client";
import cloudinary from "../lib/cloudinary";

type Timeline = {
  timestamp: Date;
  type: string;
  employmentId: string;
  company: string;
  documentType?: string;
  fileUrl?: string;
  message: string;
};

type EmploymentBreakdownItem = {
  company: string;
  status: VerificationStatus;
  risk: number;
};

type QueueStatus = "all" | "pending" | "completed" | "failed";

export const createCandidate = async (req: Request, res: Response) => {
  const { name, email, phone, city, joiningDesignation } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      message: "Name and email are required",
    });
  }

  try {
    const candidate = await prisma.candidate.create({
      data: {
        name,
        email,
        phone,
        city,
        joiningDesignation,
      },
    });

    res.status(201).json(candidate);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return res.status(409).json({
        message: "Candidate with this email already exists",
      });
    }

    console.error("Create candidate error:", error);
    res.status(500).json({
      message: "Failed to create candidate",
    });
  }
};

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
    allStatuses.map((e: { status: VerificationStatus }) => e.status),
  );

  res.json({
    candidateId: candidate.id,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    city: candidate.city,
    position:
      candidate.joiningDesignation ?? latestEmployment?.designation ?? "-",
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

  const breakdown: EmploymentBreakdownItem[] = employments.map(
    (emp: EmploymentVerification) => {
      const risk = getRiskForStatus(emp.status);

      return {
        company: emp.previousCompanyName,
        status: emp.status,
        risk,
      };
    },
  );

  const highestRisk = Math.max(
    ...breakdown.map((b: EmploymentBreakdownItem) => b.risk),
  );
  const multipleEmploymentPenalty = employments.length > 1 ? 5 : 0;
  const riskScore = Math.min(highestRisk + multipleEmploymentPenalty, 100);

  const remarks: string[] = [];

  if (
    breakdown.some((b: EmploymentBreakdownItem) => b.status === "DISCREPANCY")
  ) {
    remarks.push("One or more employment verifications have discrepancies");
  }

  if (breakdown.some((b: EmploymentBreakdownItem) => b.status === "FAILED")) {
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

  res.status(201).json(createdNote);
};

export const searchCandidates = async (req: Request, res: Response) => {
  const query = req.query.q as string | undefined;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      message: "Search query must be at least 2 characters",
    });
  }

  const candidates = await prisma.candidate.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    },
    take: 10,
    include: {
      employments: {
        select: { status: true },
      },
    },
  });

  const results = candidates.map((candidate) => {
    const statuses = candidate.employments.map((e) => e.status);

    return {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      city: candidate.city,
      joiningDesignation: candidate.joiningDesignation,
      verificationStatus: getOverallStatusFromEmployments(statuses),
    };
  });

  res.json({
    count: results.length,
    results,
  });
};

export const getVerificationQueue = async (req: Request, res: Response) => {
  const status = (req.query.status as QueueStatus) || "all";
  const city = req.query.city as string | undefined;
  const designation = req.query.designation as string | undefined;
  const q = req.query.q as string | undefined;

  const candidates = await prisma.candidate.findMany({
    where: {
      ...(city && {
        city: { equals: city, mode: "insensitive" },
      }),
      ...(designation && {
        joiningDesignation: {
          contains: designation,
          mode: "insensitive",
        },
      }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      }),
    },
    include: {
      employments: {
        select: { status: true, createdAt: true, updatedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const results = candidates
    .map((candidate) => {
      const statuses = candidate.employments.map((e) => e.status);

      const queueStatus = deriveQueueStatus(statuses);
      const riskScore = calculateCandidateRisk(statuses);
      const progress = calculateProgress(statuses);

      const createdDates = candidate.employments.map((e) => e.createdAt);
      const tatDays = calculateTAT(createdDates);

      const lastUpdated = candidate.employments.reduce(
        (latest, e) =>
          e.updatedAt && e.updatedAt > latest ? e.updatedAt : latest,
        candidate.createdAt,
      );

      return {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        city: candidate.city,
        joiningDesignation: candidate.joiningDesignation,
        verificationStatus: queueStatus,
        riskScore,
        progress,
        tatDays,
        lastUpdated,
      };
    })
    .filter((candidate) => {
      if (status === "all") return true;

      return candidate.verificationStatus === status;
    });

  res.json({
    count: results.length,
    results,
  });
};

export const uploadCandidateResume = async (req: Request, res: Response) => {
  const candidateId = req.params.candidateId as string;

  if (!req.file) {
    return res.status(400).json({ message: "Resume file is required" });
  }

  try {
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "resumes",
            resource_type: "raw",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        )
        .end(req.file?.buffer);
    });

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        resumeUrl: uploadResult.secure_url,
        resumeUploadedAt: new Date(),
      },
    });

    res.json({
      message: "Resume uploaded successfully",
      resumeUrl: candidate.resumeUrl,
    });
  } catch (error) {
    console.error("Resume upload failed:", error);
    res.status(500).json({
      message: "Failed to upload resume",
    });
  }
};

function getOverallStatusFromEmployments(statuses: VerificationStatus[]) {
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

function deriveQueueStatus(statuses: VerificationStatus[]): QueueStatus {
  if (
    statuses.includes(VerificationStatus.FAILED) ||
    statuses.includes(VerificationStatus.DISCREPANCY)
  ) {
    return "failed";
  }

  if (
    statuses.includes(VerificationStatus.PENDING) ||
    statuses.includes(VerificationStatus.IN_PROGRESS)
  ) {
    return "pending";
  }

  return "completed";
}

function calculateCandidateRisk(statuses: VerificationStatus[]): number {
  return Math.max(...statuses.map(getRiskForStatus), 0);
}

function calculateProgress(statuses: VerificationStatus[]): string {
  const completed = statuses.filter(
    (s) => s === "CLEAR" || s === "FAILED" || s === "DISCREPANCY",
  ).length;

  return `${completed}/${statuses.length}`;
}

function calculateTAT(createdDates: Date[]): number {
  const start = Math.min(...createdDates.map((d) => d.getTime()));
  const now = Date.now();
  const diffMs = now - start;

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
