"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userServices = void 0;
const db_1 = require("../../config/db.js");
const cloudinary_1 = require("../../utils/cloudinary.js");
const customError_1 = __importDefault(require("../../utils/customError.js"));
const getAllFromDB = async () => {
    const users = db_1.prisma.user.findMany();
    return users;
};
const myProfile = async (userId) => {
    const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new customError_1.default(404, "User not found");
    }
    if (user && user?.isDeleted) {
        throw new customError_1.default(404, "User has been deleted");
    }
    return user;
};
const updateData = async (payload, userId) => {
    const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new customError_1.default(404, "User not found");
    }
    if (user && user?.isDeleted) {
        throw new customError_1.default(404, "User has been deleted");
    }
    const transformData = {
        name: payload?.name,
        phone: payload?.phone,
        avatar: payload.avatar?.url,
        avatarPublicId: payload.avatar?.publicId
    };
    if (payload?.avatar?.publicId) {
        const tempPublicId = payload?.avatar?.publicId;
        if (tempPublicId.includes("/temp")) {
            // 1. Delete old avatar from Cloudinary if exists
            if (user.avatarPublicId) {
                await (0, cloudinary_1.deleteFromCloudinary)(user.avatarPublicId);
            }
            // 2. Move new image from temp -> final folder
            const { publicId, url } = await (0, cloudinary_1.moveFromTemp)(tempPublicId);
            transformData.avatar = url;
            transformData.avatarPublicId = publicId;
        }
    }
    const data = await db_1.prisma.user.update({
        where: { id: userId },
        data: transformData
    });
    return data;
};
exports.userServices = { getAllFromDB, myProfile, updateData };
