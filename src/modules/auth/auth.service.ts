import { JwtPayload } from "jsonwebtoken";
import { prisma } from "../../config/db";
import { comparePassword, makePasswordHash } from "../../helpers/password";
import CustomError from "../../utils/customError";
import { IAuth, IChangePassword, IOAuth } from "./auth.interface";
import { generateAccessToken, generateRefreshToken } from "../../helpers/jwt";
import { envConfig } from "../../config/env-config";
import { TRegisterUserType } from "./auth.validation";
import { Auth, AuthProvider } from "../../../generated/prisma";
import jwt from 'jsonwebtoken'
const registerUser = async (payload: TRegisterUserType) => {
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
                name: payload.name
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


const loginUser = async (payload: Omit<IAuth, "name">) => {
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
        refreshToken
    };
};


const oAuthLogin = async (payload: IOAuth) => {
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
        envConfig.access_token_secret as string
    );

    const refreshToken = generateRefreshToken(
        tokenPayload,
        envConfig.refresh_token_secret as string
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


const changePassword = async (payload: IChangePassword, userId: string) => {

    const auth = await prisma.auth.findUnique({
        where: {
            userId:userId
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
        where: { userId }, data: {
            password: hashPassword
        }
    })

}

const refreshToken = async(token:string)=> {
    if(!token){
        throw new CustomError(400, "Token is not provided")
    }

    let data: JwtPayload;
    try {
        
        data = jwt.verify(token, envConfig.refresh_token_secret as string) as JwtPayload
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    } catch (error) {
        throw new CustomError(401, "Invalid or expired refresh token")
    }

    const auth =  await prisma.auth.findUniqueOrThrow({where:{userId: data.id}});

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
        accessToken
    }

}
export const authServices = { registerUser, loginUser, oAuthLogin, changePassword , refreshToken };
