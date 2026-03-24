import nodemailer from 'nodemailer';
import { getSmtpConfig } from '$lib/server/settings';

export async function sendMail({
	to,
	subject,
	html,
}: {
	to: string;
	subject: string;
	html: string;
}) {
	const smtp = await getSmtpConfig();

	if (!smtp.host || !smtp.user) {
		console.warn('[Email] SMTP not configured. Skipping email to:', to, '|', subject);
		return;
	}

	const transporter = nodemailer.createTransport({
		host: smtp.host,
		port: parseInt(smtp.port || '587'),
		secure: smtp.secure,
		auth: { user: smtp.user, pass: smtp.pass },
	});

	const from = smtp.from || `"Course Platform" <${smtp.user}>`;

	try {
		const info = await transporter.sendMail({ from, to, subject, html });
		console.log('[Email] Sent:', info.messageId, '→', to);
	} catch (err) {
		console.error('[Email] Failed to send to', to, err);
	}
}
