"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordChangedEmail = exports.passwordResetEmail = void 0;
const BRAND = "Trendora";
/** Minimal inline-styled shell — email clients ignore <style> blocks. */
const layout = (heading, bodyHtml) => `
<div style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <p style="margin:0 0 24px;font-size:20px;font-weight:600;color:#111827;">${BRAND}</p>
    <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111827;">${heading}</h1>
    ${bodyHtml}
  </div>
  <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#6b7280;text-align:center;">
    &copy; ${new Date().getFullYear()} ${BRAND}
  </p>
</div>`;
const button = (href, label) => `
  <p style="margin:0 0 24px;">
    <a href="${href}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a>
  </p>`;
/**
 * The reset link. `resetUrl` already carries the raw token as a query param —
 * it is the only place that token is ever written down, so this mail is the
 * single delivery channel for it.
 */
const passwordResetEmail = ({ name, resetUrl, expiresInMinutes, }) => ({
    subject: `Reset your ${BRAND} password`,
    text: [
        `Hi ${name},`,
        "",
        `We received a request to reset the password on your ${BRAND} account.`,
        `Open this link to choose a new one (it expires in ${expiresInMinutes} minutes):`,
        "",
        resetUrl,
        "",
        "If you did not ask for this, you can ignore this email — your password will not change.",
    ].join("\n"),
    html: layout("Reset your password", `
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#374151;">
      We received a request to reset the password on your ${BRAND} account.
      Choose a new one using the button below — the link expires in
      <strong>${expiresInMinutes} minutes</strong> and can only be used once.
    </p>
    ${button(resetUrl, "Choose a new password")}
    <p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#6b7280;">
      If the button does not work, paste this into your browser:
    </p>
    <p style="margin:0 0 24px;font-size:12px;line-height:20px;color:#6b7280;word-break:break-all;">
      ${resetUrl}
    </p>
    <p style="margin:0;font-size:13px;line-height:21px;color:#374151;">
      If you did not ask for this, you can safely ignore this email — your password will not change.
    </p>`),
});
exports.passwordResetEmail = passwordResetEmail;
/**
 * Sent after a reset succeeds. This is the tripwire: if the account owner did
 * not do it, this mail is how they find out.
 */
const passwordChangedEmail = ({ name }) => ({
    subject: `Your ${BRAND} password was changed`,
    text: [
        `Hi ${name},`,
        "",
        `The password on your ${BRAND} account was just changed.`,
        "",
        "If this was you, nothing further is needed.",
        "If it was not, reset your password immediately and contact support.",
    ].join("\n"),
    html: layout("Your password was changed", `
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#374151;">
      The password on your ${BRAND} account was just changed.
    </p>
    <p style="margin:0;font-size:13px;line-height:21px;color:#374151;">
      If this was you, nothing further is needed. If it was not,
      <strong>reset your password immediately</strong> and contact support.
    </p>`),
});
exports.passwordChangedEmail = passwordChangedEmail;
