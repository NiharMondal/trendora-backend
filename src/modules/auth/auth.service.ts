import crypto from "crypto";
import { JwtPayload } from "jsonwebtoken";
import { prisma } from "@/config/db";
import { comparePassword, makePasswordHash } from "@/helpers/password";
import CustomError from "@/utils/customError";
import { generateAccessToken, generateRefreshToken } from "@/helpers/jwt";
import { envConfig } from "@/config/env-config";
import { Auth, AuthProvider } from "@/lib/prisma-client";
import jwt from "jsonwebtoken";
import {
	passwordChangedEmail,
	passwordResetEmail,
} from "@/utils/email-templates";
import { isEmailConfigured, sendEmailSafely } from "@/utils/sendEmail";
import {
	TChangePassword,
	TForgotPassword,
	TLoginUser,
	TOauth,
	TRegisterUser,
	TResetPassword,
} from "./auth.validation";

const registerUser = async (payload: TRegisterUser) => {
	const existed = await prisma.auth.findUnique({
		where: { email: payload.email },
	});

	if (existed) {
		throw new CustomError(400, "Email already exists");
	}

	const hashPassword = await makePasswordHash(payload.password);

	const result = await prisma.$transaction(async (tx) => {
		const user = await tx.user.create({
			data: {
				name: payload.name,
			},
		});

		const auth = await tx.auth.create({
			data: {
				email: payload.email,
				password: hashPassword,
				userId: user.id,
			},
		});

		return { user, auth };
	});

	return result;
};

const loginUser = async (payload: TLoginUser) => {
	const auth = await prisma.auth.findUnique({
		where: {
			email: payload.email,
		},
		include: {
			user: true,
		},
	});

	if (!auth) {
		throw new CustomError(404, "Invalid credentials");
	}

	if (auth.user && auth.user.isDeleted) {
		throw new CustomError(400, "User has been deleted");
	}

	if (!auth.password) {
		throw new CustomError(400, "Please login with your social account");
	}

	const isValidPassword = await comparePassword(
		payload.password,
		auth.password,
	);

	if (!isValidPassword) {
		throw new CustomError(400, "Invalid credentials");
	}

	const token = {
		id: auth.userId,
		role: auth.role,
		email: auth.email,
	} as JwtPayload;

	const accessToken = generateAccessToken(
		token,
		envConfig.access_token_secret as string,
	);
	const refreshToken = generateRefreshToken(
		token,
		envConfig.refresh_token_secret as string,
	);
	return {
		user: {
			id: auth.userId,
			name: auth.user?.name,
			email: auth.email,
			role: auth.role,
		},
		accessToken,
		refreshToken,
	};
};

const oAuthLogin = async (payload: TOauth) => {
	const provider = payload.provider.toUpperCase() as AuthProvider;

	// 1. Check OAuth account first
	const oauthAccount = await prisma.oAuthAccount.findUnique({
		where: {
			provider_providerId: {
				provider,
				providerId: payload.providerId,
			},
		},
		include: {
			user: {
				include: { auth: true },
			},
		},
	});

	if (oauthAccount) {
		const user = oauthAccount.user;

		if (user.isDeleted) {
			throw new CustomError(400, "User deleted");
		}

		if (!user.auth) {
			throw new CustomError(500, "Auth record missing for OAuth user");
		}

		return generateTokenResponse(user.auth);
	}

	// 2. Check if user exists by email (account linking)
	const auth = await prisma.auth.findUnique({
		where: { email: payload.email },
		include: { user: true },
	});

	if (auth) {
		if (auth.user.isDeleted) {
			throw new CustomError(400, "User deleted");
		}

		// Link new provider
		await prisma.oAuthAccount.create({
			data: {
				provider,
				providerId: payload.providerId,
				userId: auth.userId,
			},
		});

		return generateTokenResponse(auth);
	}

	// 3. Create new user + auth + oauth
	const result = await prisma.$transaction(async (tx) => {
		const user = await tx.user.create({
			data: {
				name: payload.name,
				avatar: payload.avatar,
			},
		});

		const auth = await tx.auth.create({
			data: {
				email: payload.email,
				userId: user.id,
			},
		});

		await tx.oAuthAccount.create({
			data: {
				provider,
				providerId: payload.providerId,
				userId: user.id,
			},
		});

		return { user, auth };
	});

	return generateTokenResponse(result.auth);
};

const generateTokenResponse = (auth: Auth) => {
	const tokenPayload = {
		id: auth.userId,
		role: auth.role,
		email: auth.email,
	};

	const accessToken = generateAccessToken(
		tokenPayload,
		envConfig.access_token_secret as string,
	);

	const refreshToken = generateRefreshToken(
		tokenPayload,
		envConfig.refresh_token_secret as string,
	);

	return {
		user: {
			id: auth.userId,
			email: auth.email,
			role: auth.role,
		},
		accessToken,
		refreshToken,
	};
};

const changePassword = async (payload: TChangePassword, userId: string) => {
	const auth = await prisma.auth.findUnique({
		where: {
			userId: userId,
		},
		include: {
			user: true,
		},
	});

	if (!auth) {
		throw new CustomError(404, "Invalid credentials");
	}

	if (auth.user && auth.user.isDeleted) {
		throw new CustomError(400, "User has been deleted");
	}

	if (!auth.password) {
		throw new CustomError(400, "Please login with your social account");
	}

	const isValidPassword = await comparePassword(
		payload.oldPassword,
		auth.password,
	);

	if (!isValidPassword) {
		throw new CustomError(400, "Old password does not match");
	}

	const hashPassword = await makePasswordHash(payload.newPassword);

	await prisma.auth.update({
		where: { userId },
		data: {
			password: hashPassword,
		},
	});
};

const refreshToken = async (token: string) => {
	if (!token) {
		throw new CustomError(400, "Token is not provided");
	}

	let data: JwtPayload;
	try {
		data = jwt.verify(
			token,
			envConfig.refresh_token_secret as string,
		) as JwtPayload;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		throw new CustomError(401, "Invalid or expired refresh token");
	}

	const auth = await prisma.auth.findUniqueOrThrow({
		where: { userId: data.id },
	});

	const tokenPayload = {
		id: auth.userId,
		role: auth.role,
		email: auth.email,
	} as JwtPayload;

	const accessToken = generateAccessToken(
		tokenPayload,
		envConfig.access_token_secret as string,
	);
	return {
		accessToken,
	};
};

/**
 * Reset tokens are stored as a SHA-256 hash, never in the clear. SHA-256 rather
 * than bcrypt on purpose: the token is 32 bytes of CSPRNG output, so it has no
 * guessable structure for a slow hash to defend, and the lookup has to be a
 * single indexed read on `tokenHash`.
 */
const hashResetToken = (rawToken: string): string =>
	crypto.createHash("sha256").update(rawToken).digest("hex");

/**
 * Step one of the reset flow: email a single-use link.
 *
 * **This endpoint always reports the same thing.** Whether the address is
 * registered, belongs to a deleted user, is a social-only login, or is in
 * cooldown, the caller gets one generic success. Anything else turns it into an
 * oracle for which email addresses hold accounts. The token itself is returned
 * to nobody — it exists only inside the emailed URL.
 */
const forgotPassword = async (payload: TForgotPassword) => {
	const auth = await prisma.auth.findUnique({
		where: { email: payload.email },
		include: { user: true },
	});

	// Every early return here is silent on purpose — see the note above.
	if (!auth || auth.user.isDeleted) {
		return;
	}

	// A social-only account has no password to reset; it signs in with Google.
	// Consistent with `changePassword`, which refuses for the same reason.
	if (!auth.password) {
		return;
	}

	if (!isEmailConfigured()) {
		// eslint-disable-next-line no-console
		console.error(
			"[auth] forgot-password requested but EMAIL/PASSWORD are not set — no mail sent",
		);
		return;
	}

	const now = new Date();

	// Cooldown: one live token issued a moment ago means someone is hammering
	// this address. Do nothing rather than send a second mail.
	const recent = await prisma.passwordResetToken.findFirst({
		where: {
			authId: auth.id,
			usedAt: null,
			expiresAt: { gt: now },
			createdAt: {
				gt: new Date(
					now.getTime() -
						envConfig.password_reset_cooldown_seconds * 1000,
				),
			},
		},
	});

	if (recent) {
		return;
	}

	const rawToken = crypto.randomBytes(32).toString("hex");
	const ttlMinutes = envConfig.password_reset_ttl_minutes;

	await prisma.$transaction(async (tx) => {
		// Only the newest link may work. Retiring the outstanding ones is what
		// makes "I clicked the old email" fail closed.
		await tx.passwordResetToken.updateMany({
			where: { authId: auth.id, usedAt: null },
			data: { usedAt: now },
		});

		await tx.passwordResetToken.create({
			data: {
				authId: auth.id,
				tokenHash: hashResetToken(rawToken),
				expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
			},
		});
	});

	const resetUrl = `${envConfig.front_end_url}/reset-password?token=${rawToken}`;

	// Best-effort: the token row is already committed, and surfacing an SMTP
	// error here would leak that this address exists.
	await sendEmailSafely({
		to: auth.email,
		...passwordResetEmail({
			name: auth.user.name,
			resetUrl,
			expiresInMinutes: ttlMinutes,
		}),
	});
};

/**
 * Step two: redeem the token from the emailed link and set the new password.
 *
 * Failures are deliberately indistinguishable — unknown, already used, expired
 * and malformed tokens all produce the same message, so the endpoint cannot be
 * used to probe which tokens exist.
 */
const resetPassword = async (payload: TResetPassword) => {
	const record = await prisma.passwordResetToken.findUnique({
		where: { tokenHash: hashResetToken(payload.token) },
		include: { auth: { include: { user: true } } },
	});

	if (!record || record.usedAt || record.expiresAt <= new Date()) {
		throw new CustomError(
			400,
			"This password reset link is invalid or has expired. Please request a new one.",
		);
	}

	if (record.auth.user.isDeleted) {
		throw new CustomError(400, "User has been deleted");
	}

	const hashPassword = await makePasswordHash(payload.newPassword);

	await prisma.$transaction(async (tx) => {
		await tx.auth.update({
			where: { id: record.authId },
			data: { password: hashPassword },
		});

		// Burn every outstanding token for this account, not just this one — a
		// completed reset should invalidate any other link already in an inbox.
		await tx.passwordResetToken.updateMany({
			where: { authId: record.authId, usedAt: null },
			data: { usedAt: new Date() },
		});
	});

	// The tripwire: if the account owner did not do this, the mail is how they
	// find out. Never fatal — the password is already changed.
	await sendEmailSafely({
		to: record.auth.email,
		...passwordChangedEmail({ name: record.auth.user.name }),
	});
};

export const authServices = {
	registerUser,
	loginUser,
	oAuthLogin,
	changePassword,
	refreshToken,
	forgotPassword,
	resetPassword,
};
