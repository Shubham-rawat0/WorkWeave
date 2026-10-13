import nodemailer from "nodemailer";

export function isSmtpConfigured() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM);
}

export async function sendPasswordResetCode(email: string, otp: string) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!isSmtpConfigured()) {
        throw new Error("SMTP is not configured");
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: "Your WorkOrchestrator password reset code",
        text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    });
}
