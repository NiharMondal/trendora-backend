import nodemailer, { Transporter } from "nodemailer";
import { envConfig } from "../config/env-config";

/**
 * The one place this app sends mail from.
 *
 * Everything else describes *what* to send (see `src/utils/email-templates.ts`)
 * and calls `sendEmail`; nobody else builds a transport. Adding a new
 * notification is a template plus one call, not another copy of this file.
 *
 * Delivery is best-effort by design — see `sendEmailSafely` at the bottom.
 */

export type TEmailPayload = {
	to: string;
	subject: string;
	/** Rendered HTML body. */
	html: string;
	/** Plain-text fallback for clients that will not render HTML. */
	text: string;
};

/**
 * Built once and reused. nodemailer pools the underlying connection, so
 * creating a transport per message would open a new SMTP session every time.
 */
let transporter: Transporter | null = null;

/**
 * True when the SMTP credentials are present. Callers use this to skip mail
 * entirely in an environment that has none (a fresh clone, CI) instead of
 * failing the request that triggered it.
 */
export const isEmailConfigured = (): boolean =>
	Boolean(envConfig.emailUtils.email && envConfig.emailUtils.password);

const getTransporter = (): Transporter => {
	if (transporter) {
		return transporter;
	}

	transporter = nodemailer.createTransport({
		host: envConfig.emailUtils.host,
		port: envConfig.emailUtils.port,
		// 465 is implicit TLS; 587 upgrades with STARTTLS.
		secure: envConfig.emailUtils.port === 465,
		auth: {
			user: envConfig.emailUtils.email,
			pass: envConfig.emailUtils.password,
		},
	});

	return transporter;
};

/**
 * Send one message. Throws if SMTP is unreachable or rejects the mail, so a
 * caller that genuinely depends on delivery can surface the failure.
 *
 * Most callers should use `sendEmailSafely` instead.
 */
export const sendEmail = async (payload: TEmailPayload): Promise<void> => {
	if (!isEmailConfigured()) {
		throw new Error(
			"Email is not configured: set EMAIL and PASSWORD in the environment",
		);
	}

	await getTransporter().sendMail({
		from: envConfig.emailUtils.from,
		to: payload.to,
		subject: payload.subject,
		text: payload.text,
		html: payload.html,
	});
};

/**
 * Send, and swallow any delivery failure into a logged warning.
 *
 * Use this whenever the mail is a *notification about* something that already
 * happened. A password has been reset, an order has been placed — that work is
 * committed, and a flaky SMTP host must not turn it into a failed request. It
 * is the same reasoning that keeps the gateway call outside the refund
 * transaction in `src/helpers/refund.ts`.
 *
 * It also matters for privacy in the forgot-password flow: mail is attempted
 * only for addresses that exist, so letting a send error reach the client would
 * turn the response into an account-enumeration oracle.
 *
 * @returns whether the message was handed to the SMTP server.
 */
export const sendEmailSafely = async (
	payload: TEmailPayload,
): Promise<boolean> => {
	try {
		await sendEmail(payload);
		return true;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error(
			`[email] failed to send "${payload.subject}" to ${payload.to}:`,
			error instanceof Error ? error.message : error,
		);
		return false;
	}
};
