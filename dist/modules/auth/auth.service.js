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
const registerUser = async (payload) => {
    const existedUser = await db_1.prisma.user.findFirst({
        where: {
            email: payload.email,
        },
    });
    if (existedUser) {
        throw new customError_1.default(302, "Email is already used");
    }
    const hashPassword = await (0, password_1.makePasswordHash)(payload.password);
    const user = await db_1.prisma.user.create({
        data: {
            ...payload,
            password: hashPassword,
        },
    });
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};
const loginUser = async (payload) => {
    const user = await db_1.prisma.user.findFirst({
        where: {
            email: payload.email,
        },
    });
    if (!user) {
        throw new customError_1.default(404, "Invalid credentials");
    }
    const isValidPassword = await (0, password_1.comparePassword)(payload.password, user.password);
    if (!isValidPassword) {
        throw new customError_1.default(404, "Invalid credentials");
    }
    const token = {
        id: user.id,
        role: user.role,
        email: user.email,
    };
    const accessToken = (0, jwt_1.generateAccessToken)(token, env_config_1.envConfig.access_token_secret);
    return { accessToken };
};
exports.authServices = { registerUser, loginUser };
