"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authServices = void 0;
const db_1 = require("../../config/db");
const password_1 = require("../../helpers/password");
const customError_1 = __importDefault(require("../../utils/customError"));
const jwt_1 = require("../../helpers/jwt");
const env_config_1 = require("../../config/env-config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
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
exports.authServices = {
    registerUser,
    loginUser,
    oAuthLogin,
    changePassword,
    refreshToken,
};
