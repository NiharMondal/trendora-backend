"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userServices = void 0;
const db_1 = require("../../config/db.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const cloudinary_1 = require("../../utils/cloudinary.js");
const customError_1 = __importDefault(require("../../utils/customError.js"));
const flattenAuth = ({ auth, ...user }) => ({
    ...user,
    // Nullable because `User.auth` is optional in the schema. A user with no
    // Auth row cannot sign in at all, so this is a data problem rather than a
    // normal state — but it must not blank the whole row.
    email: auth?.email ?? null,
    role: auth?.role ?? null,
});
/**
 * Admin-only list of every user. Paginated because it grows without bound —
 * this is the one endpoint whose result set is the whole user base.
 *
 * Soft-deleted users are excluded; they were previously returned.
 */
const getAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query, {
        model: "User",
        // `email` and `role` are columns of `Auth`, so the DMMF-derived
        // allowlist would reject them even though the client can see both.
        sortAliases: { email: "auth.email", role: "auth.role" },
    });
    const prismaArgs = builder
        .withDefaultFilter({ isDeleted: false })
        // Email is the identifier an admin actually has to hand when someone
        // writes in about their account — searching only name and phone made
        // the box near-useless for support.
        .search(["name", "phone"], ["auth.email"])
        .filter()
        .paginate()
        .sort()
        .include({ auth: { select: { email: true, role: true } } })
        .build();
    const [users, meta] = await Promise.all([
        db_1.prisma.user.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.user),
    ]);
    return { meta, users: users.map(flattenAuth) };
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
