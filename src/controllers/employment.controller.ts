import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { sendVerificationEmail } from "../utils/mailer";
import { uploadFile } from "../utils/fileUpload";

type UploadedFiles = {
  offerLetter?: Express.Multer.File[];
  relievingLetter?: Express.Multer.File[];
};

export const createVerification = async (req: Request, res: Response) => {
  const {
    candidateId,
    previousCompanyName,
    previousCompanyEmail,
    designation,
    tenureFrom,
    tenureTo,
    reasonForExit,
    hrContactName,
    hrContactPhone,
  } = req.body;

  const token = crypto.randomUUID();
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const verification = await prisma.employmentVerification.create({
    data: {
      candidateId,
      previousCompanyName,
      previousCompanyEmail,
      designation,
      tenureFrom,
      tenureTo,
      reasonForExit,
      hrContactName,
      hrContactPhone,
      verificationToken: token,
      tokenExpiresAt,
    },
  });

  await sendVerificationEmail(previousCompanyEmail, token);

  res.status(201).json(verification);
};

export const getVerificationForm = async (req: Request, res: Response) => {
  const token = req.params.token as string;

  const verification = await prisma.employmentVerification.findUnique({
    where: { verificationToken: token },
  });

  if (!verification || verification.tokenExpiresAt < new Date()) {
    return res.status(400).json({ message: "Invalid or expired link" });
  }

  res.json({
    previousCompanyName: verification.previousCompanyName,
    designation: verification.designation,
    tenureFrom: verification.tenureFrom,
    tenureTo: verification.tenureTo,
    questions: [
      {
        key: "designation_match",
        label: "Is designation correct?",
        type: "boolean",
      },
      { key: "tenure_match", label: "Is tenure correct?", type: "boolean" },
      { key: "remarks", label: "Remarks", type: "text" },
    ],
  });
};

export const submitVerification = async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const answers =
    typeof req.body.answers === "string"
      ? JSON.parse(req.body.answers)
      : req.body.answers;

  const verification = await prisma.employmentVerification.findUnique({
    where: { verificationToken: token },
  });

  if (!verification || verification.tokenExpiresAt < new Date()) {
    return res.status(400).json({ message: "Invalid or expired link" });
  }

  const response = await prisma.verificationResponse.create({
    data: {
      employmentVerificationId: verification.id,
      answers,
    },
  });

  const files = req.files as UploadedFiles | undefined;

  if (files?.offerLetter?.[0]) {
    const url = await uploadFile(
      files.offerLetter[0],
      "employment-verifications/offer-letters",
    );

    await prisma.verificationDocument.create({
      data: {
        responseId: response.id,
        type: "OFFER_LETTER",
        fileUrl: url,
      },
    });
  }

  if (files?.relievingLetter?.[0]) {
    const url = await uploadFile(
      files.relievingLetter[0],
      "employment-verifications/relieving-letters",
    );

    await prisma.verificationDocument.create({
      data: {
        responseId: response.id,
        type: "RELIEVING_LETTER",
        fileUrl: url,
      },
    });
  }

  const hasDiscrepancy =
    answers.designation_match === false || answers.tenure_match === false;

  await prisma.employmentVerification.update({
    where: { id: verification.id },
    data: {
      status: hasDiscrepancy ? "DISCREPANCY" : "CLEAR",
      completedAt: new Date(),
    },
  });

  res.json({ message: "Verification submitted successfully" });
};

export const addCallingLog = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { callTime, outcome, notes } = req.body;

  const log = await prisma.callingLog.create({
    data: {
      employmentVerificationId: id,
      callTime,
      outcome,
      notes,
    },
  });

  res.status(201).json(log);
};
