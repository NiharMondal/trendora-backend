import { JwtPayload } from "jsonwebtoken";
import { prisma } from "../../config/db";
import { comparePassword, makePasswordHash } from "../../helpers/password";
import CustomError from "../../utils/customError";
import { IAuth } from "./auth.interface";
import { generateAccessToken } from "../../helpers/jwt";
import { envConfig } from "../../config/env-config";

const registerUser = async (payload: IAuth) => {
    const existedUser = await prisma.user.findUnique({
        where: {
            email: payload.email,
        },
    });

    if (existedUser) {
        throw new CustomError(302, "Email is already used");
    }

    const hashPassword = await makePasswordHash(payload.password);

    const user = await prisma.user.create({
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

const loginUser = async (payload: Omit<IAuth, "name">) => {
    const user = await prisma.user.findUnique({
        where: {
            email: payload.email,
        },
    });

    if (!user) {
        throw new CustomError(404, "Invalid credentials");
    }

    if (user && user.isDeleted) {
        throw new CustomError(400, "User has been deleted");
    }
    const isValidPassword = await comparePassword(
        payload.password,
        user.password
    );

    if (!isValidPassword) {
        throw new CustomError(400, "Invalid credentials");
    }

    const token = {
        id: user.id,
        role: user.role,
        email: user.email,
    } as JwtPayload;

    const accessToken = generateAccessToken(
        token,
        envConfig.access_token_secret as string
    );
    return { accessToken };
};

export const authServices = { registerUser, loginUser };
