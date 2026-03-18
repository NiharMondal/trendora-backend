import { JwtPayload } from "jsonwebtoken";
import { prisma } from "../../config/db";
import { comparePassword, makePasswordHash } from "../../helpers/password";
import CustomError from "../../utils/customError";
import { IAuth, IOAuth } from "./auth.interface";
import { generateAccessToken } from "../../helpers/jwt";
import { envConfig } from "../../config/env-config";

const registerUser = async (payload: IAuth & { phone?: string; avatar?: string }) => {
    const existedAuth = await prisma.auth.findUnique({
        where: {
            email: payload.email,
        },
    });

    if (existedAuth) {
        throw new CustomError(302, "Email is already used");
    }

    const hashPassword = await makePasswordHash(payload.password);

    const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                name: payload.name,
                phone: payload.phone,
                avatar: payload.avatar,
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

    return {
        id: result.user.id,
        name: result.user.name,
        email: result.auth.email,
        phone: result.user.phone,
        role: result.auth.role,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
    };
};

const loginUser = async (payload: Omit<IAuth, "name">) => {
    const auth = await prisma.auth.findUnique({
        where: {
            email: payload.email,
        },
        include: {
            user: true
        }
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
        auth.password
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
        envConfig.access_token_secret as string
    );
    return { accessToken };
};

const oauthLogin = async (payload: IOAuth) => {
    let auth = await prisma.auth.findUnique({
        where: { email: payload.email },
        include: { user: true }
    });

    if (auth) {
        if (auth.user && auth.user.isDeleted) {
            throw new CustomError(400, "User has been deleted");
        }
        
        // Update auth to link the OAuth provider if they previously signed up differently
        if (auth.provider !== payload.provider || !auth.providerId) {
            auth = await prisma.auth.update({
                where: { email: payload.email },
                data: {
                    provider: payload.provider,
                    providerId: payload.providerId,
                },
                include: { user: true }
            });

            // Update user avatar if provided
            if (payload.avatar && auth.user && auth.user.avatar !== payload.avatar) {
                await prisma.user.update({
                    where: { id: auth.userId },
                    data: { avatar: payload.avatar }
                });
            }
        }
    } else {
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: payload.name,
                    avatar: payload.avatar,
                },
            });

            const newAuth = await tx.auth.create({
                data: {
                    email: payload.email,
                    provider: payload.provider,
                    providerId: payload.providerId,
                    userId: user.id,
                },
                include: { user: true }
            });

            return newAuth;
        });
        auth = result;
    }

    const token = {
        id: auth.userId,
        role: auth.role,
        email: auth.email,
    } as JwtPayload;

    const accessToken = generateAccessToken(
        token,
        envConfig.access_token_secret as string
    );
    return { accessToken };
};

export const authServices = { registerUser, loginUser, oauthLogin };
