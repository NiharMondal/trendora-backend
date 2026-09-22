"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authServices = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../../config/db");
const password_1 = require("../../helpers/password");
const customError_1 = __importDefault(require("../../utils/customError"));
const jwt_1 = require("../../helpers/jwt");
const env_config_1 = require("../../config/env-config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const email_templates_1 = require("../../utils/email-templates");
const sendEmail_1 = require("../../utils/sendEmail");
const registerUser = async (payload) => {
    const existed = await db_1.prisma.auth.findUnique({
        where: { email: payload.email },
    });
    if (existed) {
        throw new customError_1.default(400, "Email already exists");
    }
    const hashPassword = await (0, password_1.makePasswordHash)(payload.password);
    const result = await db_1.prisma.$transaction(async (tx) => {
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
const loginUser = async (payload) => {
    const auth = await db_1.prisma.auth.findUnique({
        where: {
            email: payload.email,
        },
        include: {
            user: true,
        },
    });
    if (!auth) {
        throw new customError_1.default(404, "Invalid credentials");
    }
    if (auth.user && auth.user.isDeleted) {
        throw new customError_1.default(400, "User has been deleted");
    }
    if (!auth.password) {
        throw new customError_1.default(400, "Please login with your social account");
    }
    const isValidPassword = await (0, password_1.comparePassword)(payload.password, auth.password);
    if (!isValidPassword) {
        throw new customError_1.default(400, "Invalid credentials");
    }
    const token = {
        id: auth.userId,
        role: auth.role,
        email: auth.email,
    };
    const accessToken = (0, jwt_1.generateAccessToken)(token, env_config_1.envConfig.access_token_secret);
    const refreshToken = (0, jwt_1.generateRefreshToken)(token, env_config_1.envConfig.refresh_token_secret);
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
const oAuthLogin = async (payload) => {
    const provider = payload.provider.toUpperCase();
    // 1. Check OAuth account first
    const oauthAccount = await db_1.prisma.oAuthAccount.findUnique({
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
            throw new customError_1.default(400, "User deleted");
        }
        if (!user.auth) {
            throw new customError_1.default(500, "Auth record missing for OAuth user");
        }
        return generateTokenResponse(user.auth);
    }
    // 2. Check if user exists by email (account linking)
    const auth = await db_1.prisma.auth.findUnique({
        where: { email: payload.email },
        include: { user: true },
    });
    if (auth) {
        if (auth.user.isDeleted) {
            throw new customError_1.default(400, "User deleted");
        }
        // Link new provider
        await db_1.prisma.oAuthAccount.create({
            data: {
                provider,
                providerId: payload.providerId,
                userId: auth.userId,
            },
        });
        return generateTokenResponse(auth);
    }
    // 3. Create new user + auth + oauth
    const result = await db_1.prisma.$transaction(async (tx) => {
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
const generateTokenResponse = (auth) => {
    const tokenPayload = {
        id: auth.userId,
        role: auth.role,
        email: auth.email,
    };
    const accessToken = (0, jwt_1.generateAccessToken)(tokenPayload, env_config_1.envConfig.access_token_secret);
    const refreshToken = (0, jwt_1.generateRefreshToken)(tokenPayload, env_config_1.envConfig.refresh_token_secret);
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
const changePassword = async (payload, userId) => {
    const auth = await db_1.prisma.auth.findUnique({
        where: {
            userId: userId,
        },
        include: {
            user: true,
        },
    });
    if (!auth) {
        throw new customError_1.default(404, "Invalid credentials");
    }
    if (auth.user && auth.user.isDeleted) {
        throw new customError_1.default(400, "User has been deleted");
    }
    if (!auth.password) {
        throw new customError_1.default(400, "Please login with your social account");
    }
    const isValidPassword = await (0, password_1.comparePassword)(payload.oldPassword, auth.password);
    if (!isValidPassword) {
        throw new customError_1.default(400, "Old password does not match");
    }
    const hashPassword = await (0, password_1.makePasswordHash)(payload.newPassword);
    await db_1.prisma.auth.update({
        where: { userId },
        data: {
            password: hashPassword,
        },
    });
};
const refreshToken = async (token) => {
    if (!token) {
        throw new customError_1.default(400, "Token is not provided");
    }
    let data;
    try {
        data = jsonwebtoken_1.default.verify(token, env_config_1.envConfig.refresh_token_secret);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }
    catch (error) {
        throw new customError_1.default(401, "Invalid or expired refresh token");
    }
    const auth = await db_1.prisma.auth.findUniqueOrThrow({
        where: { userId: data.id },
    });
    const tokenPayload = {
        id: auth.userId,
        role: auth.role,
        email: auth.email,
    };
    const accessToken = (0, jwt_1.generateAccessToken)(tokenPayload, env_config_1.envConfig.access_token_secret);
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
const hashResetToken = (rawToken) => crypto_1.default.createHash("sha256").update(rawToken).digest("hex");
/**
 * Step one of the reset flow: email a single-use link.
 *
 * **This endpoint always reports the same thing.** Whether the address is
 * registered, belongs to a deleted user, is a social-only login, or is in
 * cooldown, the caller gets one generic success. Anything else turns it into an
 * oracle for which email addresses hold accounts. The token itself is returned
 * to nobody — it exists only inside the emailed URL.
 */
const forgotPassword = async (payload) => {
    const auth = await db_1.prisma.auth.findUnique({
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
    if (!(0, sendEmail_1.isEmailConfigured)()) {
        // eslint-disable-next-line no-console
        console.error("[auth] forgot-password requested but EMAIL/PASSWORD are not set — no mail sent");
        return;
    }
    const now = new Date();
    // Cooldown: one live token issued a moment ago means someone is hammering
    // this address. Do nothing rather than send a second mail.
    const recent = await db_1.prisma.passwordResetToken.findFirst({
        where: {
            authId: auth.id,
            usedAt: null,
            expiresAt: { gt: now },
            createdAt: {
                gt: new Date(now.getTime() -
                    env_config_1.envConfig.password_reset_cooldown_seconds * 1000),
            },
        },
    });
    if (recent) {
        return;
    }
    const rawToken = crypto_1.default.randomBytes(32).toString("hex");
    const ttlMinutes = env_config_1.envConfig.password_reset_ttl_minutes;
    await db_1.prisma.$transaction(async (tx) => {
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
    const resetUrl = `${env_config_1.envConfig.front_end_url}/reset-password?token=${rawToken}`;
    // Best-effort: the token row is already committed, and surfacing an SMTP
    // error here would leak that this address exists.
    await (0, sendEmail_1.sendEmailSafely)({
        to: auth.email,
        ...(0, email_templates_1.passwordResetEmail)({
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
const resetPassword = async (payload) => {
    const record = await db_1.prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashResetToken(payload.token) },
        include: { auth: { include: { user: true } } },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
        throw new customError_1.default(400, "This password reset link is invalid or has expired. Please request a new one.");
    }
    if (record.auth.user.isDeleted) {
        throw new customError_1.default(400, "User has been deleted");
    }
    const hashPassword = await (0, password_1.makePasswordHash)(payload.newPassword);
    await db_1.prisma.$transaction(async (tx) => {
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
    await (0, sendEmail_1.sendEmailSafely)({
        to: record.auth.email,
        ...(0, email_templates_1.passwordChangedEmail)({ name: record.auth.user.name }),
    });
};
exports.authServices = {
    registerUser,
    loginUser,
    oAuthLogin,
    changePassword,
    refreshToken,
    forgotPassword,
    resetPassword,
};
