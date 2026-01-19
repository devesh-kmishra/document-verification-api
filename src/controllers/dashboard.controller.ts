import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const SLA_DAYS = 7;

export const getVerificationDashboard = async (req: Request, res: Response) => {
  const totalVerifications = await prisma.employmentVerification.count();
  const pendingVerifications = await prisma.employmentVerification.count({
    where: {
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
    },
  });
  const completedVerifications = await prisma.employmentVerification.count({
    where: {
      status: "CLEAR",
    },
  });
  const failedOrDiscrepancy = await prisma.employmentVerification.count({
    where: {
      status: {
        in: ["FAILED", "DISCREPANCY"],
      },
    },
  });
  const completed = await prisma.employmentVerification.findMany({
    where: {
      completedAt: { not: null },
    },
    select: {
      createdAt: true,
      completedAt: true,
    },
  });

  let totalTatDays = 0;
  let onTimeCount = 0;

  for (const v of completed) {
    const tatMs =
      new Date(v.completedAt!).getTime() - new Date(v.createdAt).getTime();
    const tatDays = tatMs / (1000 * 60 * 60 * 24);
    totalTatDays += tatDays;

    if (tatDays <= SLA_DAYS) {
      onTimeCount++;
    }
  }

  const averageTatDays =
    completed.length > 0
      ? Number((totalTatDays / completed.length).toFixed(2))
      : 0;
  const slaComplianceRate =
    completed.length > 0
      ? Number(((onTimeCount / completed.length) * 100).toFixed(2))
      : 0;

  res.json({
    totalVerifications,
    pendingVerifications,
    completedVerifications,
    failedOrDiscrepancy,
    averageTatDays,
    slaComplianceRate,
  });
};
