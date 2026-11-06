import { TEmailPayload } from "./sendEmail";

/**
 * Email bodies live here so `sendEmail` stays a dumb transport and a new
 * notification is a function in this file plus one call site.
 *
 * Each template returns everything except `to`, so a caller cannot forget the
 * plain-text fallback or invent its own subject line.
 */

type TTemplate = Omit<TEmailPayload, "to">;

const BRAND = "Trendora";

/** Minimal inline-styled shell — email clients ignore <style> blocks. */
const layout = (heading: string, bodyHtml: string): string => `
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

const button = (href: string, label: string): string => `
  <p style="margin:0 0 24px;">
    <a href="${href}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a>
  </p>`;

/**
 * Money, formatted the way the storefront formats it.
 *
 * Hardcoded to USD because the whole platform is — see `currencyFormatter` in
 * the frontend's `calculate-order-total.ts`. If multi-currency ever lands, this
 * is one of the places that has to learn about it.
 */
const money = (value: number | string): string =>
	`$${Number(value).toFixed(2)}`;

/** A simple label/value table, used by most of the order emails. */
const rows = (pairs: [string, string][]): string => `
  <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
    ${pairs
		.map(
			([k, v]) => `<tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280;">${k}</td>
      <td style="padding:6px 0;font-size:14px;color:#111827;text-align:right;font-weight:600;">${v}</td>
    </tr>`,
		)
		.join("")}
  </table>`;

/**
 * The reset link. `resetUrl` already carries the raw token as a query param —
 * it is the only place that token is ever written down, so this mail is the
 * single delivery channel for it.
 */
export const passwordResetEmail = ({
	name,
	resetUrl,
	expiresInMinutes,
}: {
	name: string;
	resetUrl: string;
	expiresInMinutes: number;
}): TTemplate => ({
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
	html: layout(
		"Reset your password",
		`
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
    </p>`,
	),
});

/**
 * Sent after a reset succeeds. This is the tripwire: if the account owner did
 * not do it, this mail is how they find out.
 */
export const passwordChangedEmail = ({ name }: { name: string }): TTemplate => ({
	subject: `Your ${BRAND} password was changed`,
	text: [
		`Hi ${name},`,
		"",
		`The password on your ${BRAND} account was just changed.`,
		"",
		"If this was you, nothing further is needed.",
		"If it was not, reset your password immediately and contact support.",
	].join("\n"),
	html: layout(
		"Your password was changed",
		`
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#374151;">
      The password on your ${BRAND} account was just changed.
    </p>
    <p style="margin:0;font-size:13px;line-height:21px;color:#374151;">
      If this was you, nothing further is needed. If it was not,
      <strong>reset your password immediately</strong> and contact support.
    </p>`,
	),
});

/* ------------------------------------------------------------------ orders */

/** Buyer: we have your order. Sent once, after the order row commits. */
export const orderPlacedEmail = ({
	name,
	orderNumber,
	totalAmount,
	paymentMethod,
	groups,
}: {
	name: string;
	orderNumber: string;
	totalAmount: number | string;
	paymentMethod: string;
	/** One entry per store — a multi-vendor order ships in separate parcels. */
	groups: { storeName: string; items: string[]; total: number | string }[];
}): TTemplate => ({
	subject: `${BRAND} order ${orderNumber} confirmed`,
	// NOTE: no `.filter(Boolean)` here — it would strip the deliberate blank
	// lines as well as the optional trailing note. Optional pieces are spread
	// conditionally instead.
	text: [
		`Hi ${name},`,
		"",
		`Thanks for your order. We have it as ${orderNumber}.`,
		"",
		...groups.flatMap((g) => [
			`Shipped by ${g.storeName} — ${money(g.total)}`,
			...g.items.map((i) => `  ${i}`),
			"",
		]),
		`Total: ${money(totalAmount)} (${paymentMethod})`,
		...(groups.length > 1
			? [
					"",
					"Your items come from more than one store, so they arrive as separate parcels and may not turn up on the same day.",
				]
			: []),
	].join("\n"),
	html: layout(
		`Order ${orderNumber} confirmed`,
		`
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#374151;">
      Thanks for your order. We have it as <strong>${orderNumber}</strong>.
    </p>
    ${groups
		.map(
			(g) => `
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111827;">Shipped by ${g.storeName}</p>
      <p style="margin:0 0 4px;font-size:13px;line-height:21px;color:#6b7280;">${g.items.join("<br>")}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#111827;">${money(g.total)}</p>`,
		)
		.join("")}
    ${rows([
		["Payment method", paymentMethod],
		["Order total", money(totalAmount)],
	])}
    ${
		groups.length > 1
			? `<p style="margin:0;font-size:13px;line-height:21px;color:#6b7280;">
      Your items come from more than one store, so they arrive as separate parcels
      and may not turn up on the same day.</p>`
			: ""
	}`,
	),
});

/** Seller: you have a new order. One per store on a multi-vendor order. */
export const newOrderForSellerEmail = ({
	storeName,
	orderNumber,
	parcelNumber,
	items,
	earning,
}: {
	storeName: string;
	orderNumber: string;
	parcelNumber: string;
	items: string[];
	earning: number | string;
}): TTemplate => ({
	subject: `New order for ${storeName} — ${parcelNumber}`,
	text: [
		`You have a new order on ${BRAND}.`,
		"",
		`Store:  ${storeName}`,
		`Parcel: ${parcelNumber} (order ${orderNumber})`,
		"",
		...items.map((i) => `  ${i}`),
		"",
		`Your earning after commission: ${money(earning)}`,
		"",
		"Open your seller dashboard to accept and fulfil it.",
	].join("\n"),
	html: layout(
		"You have a new order",
		`
    <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#374151;">
      A buyer has ordered from <strong>${storeName}</strong>.
    </p>
    <p style="margin:0 0 4px;font-size:13px;line-height:21px;color:#6b7280;">${items.join("<br>")}</p>
    ${rows([
		["Parcel", parcelNumber],
		["Order", orderNumber],
		["Your earning after commission", money(earning)],
	])}
    <p style="margin:0;font-size:13px;line-height:21px;color:#374151;">
      Open your seller dashboard to accept and fulfil it.
    </p>`,
	),
});

/**
 * Buyer: this parcel moved. Only sent for states the buyer cares about —
 * SHIPPED, DELIVERED and CANCELED. PROCESSING is noise.
 */
export const orderStatusEmail = ({
	name,
	orderNumber,
	parcelNumber,
	storeName,
	status,
	trackingNumber,
	carrier,
	cancelReason,
	refundExpected,
}: {
	name: string;
	orderNumber: string;
	parcelNumber: string;
	storeName: string;
	status: "SHIPPED" | "DELIVERED" | "CANCELED";
	trackingNumber?: string | null;
	carrier?: string | null;
	cancelReason?: string | null;
	/** True when money is on its way back, so the buyer is not left guessing. */
	refundExpected?: boolean;
}): TTemplate => {
	const headline =
		status === "SHIPPED"
			? "Your parcel is on its way"
			: status === "DELIVERED"
				? "Your parcel was delivered"
				: "Your parcel was cancelled";

	const detail: [string, string][] = [
		["Order", orderNumber],
		["Parcel", parcelNumber],
		["Shipped by", storeName],
	];
	if (trackingNumber) detail.push(["Tracking number", trackingNumber]);
	if (carrier) detail.push(["Carrier", carrier]);
	if (status === "CANCELED" && cancelReason)
		detail.push(["Reason", cancelReason]);

	const refundNote =
		status === "CANCELED" && refundExpected
			? "A refund for this parcel is on its way back to your original payment method. It can take a few working days to appear."
			: "";

	return {
		subject: `${headline} — ${parcelNumber}`,
		text: [
			`Hi ${name},`,
			"",
			`${headline}.`,
			"",
			...detail.map(([k, v]) => `${k}: ${v}`),
			...(refundNote ? ["", refundNote] : []),
		].join("\n"),
		html: layout(
			headline,
			`
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    ${rows(detail)}
    ${
		refundNote
			? `<p style="margin:0;font-size:13px;line-height:21px;color:#374151;">${refundNote}</p>`
			: ""
	}`,
		),
	};
};

/** Buyer: money actually went back. Sent only once a refund SUCCEEDS. */
export const refundProcessedEmail = ({
	name,
	orderNumber,
	amount,
}: {
	name: string;
	orderNumber: string;
	amount: number | string;
}): TTemplate => ({
	subject: `Refund sent for ${orderNumber}`,
	text: [
		`Hi ${name},`,
		"",
		`We have refunded ${money(amount)} for order ${orderNumber}.`,
		"",
		"It goes back to your original payment method and can take a few working days to appear on your statement.",
	].join("\n"),
	html: layout(
		"Your refund is on its way",
		`
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    ${rows([
		["Order", orderNumber],
		["Refunded", money(amount)],
	])}
    <p style="margin:0;font-size:13px;line-height:21px;color:#374151;">
      It goes back to your original payment method and can take a few working days
      to appear on your statement.
    </p>`,
	),
});

/* ----------------------------------------------------------------- vendors */

/** Seller: your application was decided. */
export const vendorApplicationDecisionEmail = ({
	name,
	storeName,
	approved,
	rejectionReason,
	storeUrl,
}: {
	name: string;
	storeName: string;
	approved: boolean;
	rejectionReason?: string | null;
	storeUrl?: string;
}): TTemplate =>
	approved
		? {
				subject: `${storeName} is approved on ${BRAND}`,
				text: [
					`Hi ${name},`,
					"",
					`Good news — ${storeName} has been approved. You can list products and start selling now.`,
					...(storeUrl ? ["", `Your storefront: ${storeUrl}`] : []),
				].join("\n"),
				html: layout(
					`${storeName} is approved`,
					`
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#374151;">
      Good news — <strong>${storeName}</strong> has been approved. You can list
      products and start selling now.
    </p>
    ${storeUrl ? button(storeUrl, "View your storefront") : ""}`,
				),
			}
		: {
				subject: `Your ${BRAND} store application was not approved`,
				text: [
					`Hi ${name},`,
					"",
					`We could not approve ${storeName} at this time.`,
					...(rejectionReason ? ["", `Reason: ${rejectionReason}`] : []),
					"",
					"You can update your details and apply again.",
				].join("\n"),
				html: layout(
					"Your store application was not approved",
					`
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">
      We could not approve <strong>${storeName}</strong> at this time.
    </p>
    ${rejectionReason ? rows([["Reason", rejectionReason]]) : ""}
    <p style="margin:0;font-size:13px;line-height:21px;color:#374151;">
      You can update your details and apply again.
    </p>`,
				),
			};

/** Seller: a payout has been sent. */
export const payoutPaidEmail = ({
	name,
	storeName,
	amount,
	reference,
	method,
}: {
	name: string;
	storeName: string;
	amount: number | string;
	reference?: string | null;
	method?: string | null;
}): TTemplate => {
	const detail: [string, string][] = [
		["Store", storeName],
		["Amount", money(amount)],
	];
	if (method) detail.push(["Method", method]);
	if (reference) detail.push(["Reference", reference]);

	return {
		subject: `Payout sent — ${money(amount)}`,
		text: [
			`Hi ${name},`,
			"",
			`A payout of ${money(amount)} has been sent for ${storeName}.`,
			"",
			...detail.map(([k, v]) => `${k}: ${v}`),
		].join("\n"),
		html: layout(
			"Your payout has been sent",
			`
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#374151;">Hi ${name},</p>
    ${rows(detail)}`,
		),
	};
};
