import "dotenv/config";
import nodemailer from "nodemailer";

const PORT = process.env.PORT;
const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(to: string, token: string) {
  // todo: change later
  if (process.env.NODE_ENV === "production") return;

  const link = `http://localhost:${PORT}/verify/employment/${token}`;

  await transporter.sendMail({
    from: '"HR Verification" <no-reply@verify.com>',
    to,
    subject: "Employment Verification Request",
    html: `
      <p>Please verify employment details by clicking below:</p>
      <a href="${link}">${link}</a>
      <p>This link expires in 7 days.</p>
    `,
  });
}
