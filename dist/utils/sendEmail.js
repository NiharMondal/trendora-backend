"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailSafely = exports.sendEmail = exports.isEmailConfigured = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_config_1 = require("../config/env-config.js");
/**
 * Built once and reused. nodemailer pools the underlying connection, so
 * creating a transport per message would open a new SMTP session every time.
 */
let transporter = null;
/**
 * True when the SMTP credentials are present. Callers use this to skip mail
 * entirely in an environment that has none (a fresh clone, CI) instead of
 * failing the request that triggered it.
 */
const isEmailConfigured = () => Boolean(env_config_1.envConfig.emailUtils.email && env_config_1.envConfig.emailUtils.password);
exports.isEmailConfigured = isEmailConfigured;
const getTransporter = () => {
    if (transporter) {
        return transporter;
    }
    transporter = nodemailer_1.default.createTransport({
        host: env_config_1.envConfig.emailUtils.host,
        port: env_config_1.envConfig.emailUtils.port,
        // 465 is implicit TLS; 587 upgrades with STARTTLS.
        secure: env_config_1.envConfig.emailUtils.port === 465,
        auth: {
            user: env_config_1.envConfig.emailUtils.email,
            pass: env_config_1.envConfig.emailUtils.password,
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
const sendEmail = async (payload) => {
    if (!(0, exports.isEmailConfigured)()) {
        throw new Error("Email is not configured: set EMAIL and PASSWORD in the environment");
    }
    await getTransporter().sendMail({
        from: env_config_1.envConfig.emailUtils.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
    });
};
exports.sendEmail = sendEmail;
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
const sendEmailSafely = async (payload) => {
    try {
        await (0, exports.sendEmail)(payload);
        return true;
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[email] failed to send "${payload.subject}" to ${payload.to}:`, error instanceof Error ? error.message : error);
        return false;
    }
};
exports.sendEmailSafely = sendEmailSafely;
