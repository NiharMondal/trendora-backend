"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userServices = void 0;
const prisma_client_1 = require("../../lib/prisma-client.js");
const db_1 = require("../../config/db.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const cloudinary_1 = require("../../utils/cloudinary.js");
const customError_1 = __importDefault(require("../../utils/customError.js"));
const vendor_1 = require("../../helpers/vendor.js");
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
// ------------------------------------------------------- admin user management
//
// Everything below is ADMIN-only and acts on *another* account.
//
// **An admin may not act on their own account here.** Disabling or demoting
// yourself locks you out with no way back in, and `authGuard` reads the role
// from the database, so it lands on the very next request.
//
// That single rule is also what keeps the platform from losing its last admin,
// which is worth spelling out because the obvious extra guard ("refuse if this
// is the only active ADMIN") would be unreachable code: the caller has already
// passed `authGuard(Role.ADMIN)`, so they are themselves an active admin, and
// they cannot be the target — so any admin target leaves at least two. There is
// no path here that empties the role.
const assertNotSelf = (actorId, targetUserId, action) => {
    if (actorId === targetUserId) {
        throw new customError_1.default(400, `You cannot ${action} your own account`);
    }
};
/**
 * One user in full, for the admin detail screen.
 *
 * Soft-deleted users ARE returned here, unlike the list — an admin looking a
 * disabled account up by id needs to see it in order to restore it.
 */
const findById = async (userId) => {
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            auth: { select: { email: true, role: true } },
            // Enough context to decide what to do with the account without a
            // second round trip: do they sell, and have they ever bought?
            vendor: {
                select: {
                    id: true,
                    storeName: true,
                    slug: true,
                    status: true,
                    suspendedAt: true,
                },
            },
            _count: { select: { orders: true, reviews: true, addresses: true } },
        },
    });
    if (!user) {
        throw new customError_1.default(404, "User not found");
    }
    const { vendor, _count, ...rest } = user;
    return { ...flattenAuth(rest), vendor, counts: _count };
};
/**
 * Disable an account: the soft delete the frontend's `DELETE /users/:id` has
 * been calling into a 404 all along.
 *
 * This is the ban primitive. `authGuard` already 401s a soft-deleted user and
 * `loginUser` refuses them, so access stops on the next request rather than
 * whenever their 20-minute token happens to expire.
 *
 * **A seller's store is suspended with them.** Leaving it APPROVED would keep
 * their catalogue live and sellable while the account behind it cannot log in
 * to fulfil anything — `publicProductFilter` gates on `Vendor.status`, so
 * suspending is what actually takes the listings down.
 */
const disableUser = async (actor, userId) => {
    assertNotSelf(actor.id, userId, "disable");
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        include: { auth: true, vendor: true },
    });
    if (!user) {
        throw new customError_1.default(404, "User not found");
    }
    if (user.isDeleted) {
        throw new customError_1.default(400, "This account is already disabled");
    }
    return db_1.prisma.$transaction(async (tx) => {
        if (user.vendor && user.vendor.status === prisma_client_1.VendorStatus.APPROVED) {
            // This is a second door into store suspension, so it has to leave
            // the same trail the vendor moderation endpoints do — otherwise a
            // store shows as suspended with nothing saying who did it or why.
            await (0, vendor_1.logVendorStatusChange)(tx, {
                vendorId: user.vendor.id,
                oldStatus: user.vendor.status,
                newStatus: prisma_client_1.VendorStatus.SUSPENDED,
                actor,
                note: "Owner account disabled",
            });
            await tx.vendor.update({
                where: { id: user.vendor.id },
                data: {
                    status: prisma_client_1.VendorStatus.SUSPENDED,
                    suspendedAt: new Date(),
                    rejectionReason: "Owner account disabled",
                },
            });
        }
        const disabled = await tx.user.update({
            where: { id: userId },
            data: { isDeleted: true },
            include: { auth: { select: { email: true, role: true } } },
        });
        return flattenAuth(disabled);
    });
};
/**
 * Re-enable a disabled account.
 *
 * Deliberately does NOT lift a store suspension. Reinstating a store is a
 * separate judgement with its own endpoint (`PATCH /vendors/:id/reinstate`) —
 * and a seller whose store is still suspended gets an actionable 403 from
 * `requireApprovedVendor` rather than a silently half-working dashboard.
 */
const restoreUser = async (userId) => {
    const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new customError_1.default(404, "User not found");
    }
    if (!user.isDeleted) {
        throw new customError_1.default(400, "This account is already active");
    }
    const restored = await db_1.prisma.user.update({
        where: { id: userId },
        data: { isDeleted: false },
        include: { auth: { select: { email: true, role: true } } },
    });
    return flattenAuth(restored);
};
/**
 * Assign a role.
 *
 * **VENDOR is not freely assignable, in either direction.** Store approval is
 * what makes someone a seller (`vendor.service.ts` flips the role inside the
 * same transaction that approves the store), so letting this route set VENDOR
 * independently would create a second source of truth and let `Auth.role`
 * disagree with `Vendor.status`. The whole marketplace authorization layer —
 * `requireApprovedVendor`, `resolveVendorScope` — reads both.
 *
 * So: promoting to VENDOR requires an approved store, and demoting away from
 * VENDOR requires that the store is not approved any more. Both errors name the
 * endpoint that does the job properly.
 */
const updateRole = async (actorId, userId, payload) => {
    assertNotSelf(actorId, userId, "change the role of");
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        include: { auth: true, vendor: true },
    });
    if (!user) {
        throw new customError_1.default(404, "User not found");
    }
    if (!user.auth) {
        throw new customError_1.default(400, "This account has no credentials record and cannot hold a role");
    }
    const current = user.auth.role;
    const next = payload.role;
    if (current === next) {
        throw new customError_1.default(400, `This account is already a ${next}`);
    }
    const ownsApprovedStore = user.vendor?.status === prisma_client_1.VendorStatus.APPROVED;
    if (next === prisma_client_1.Role.VENDOR && !ownsApprovedStore) {
        throw new customError_1.default(400, "A seller role comes from store approval. Approve their store instead (PATCH /vendors/:id/approve).");
    }
    if (current === prisma_client_1.Role.VENDOR && ownsApprovedStore) {
        throw new customError_1.default(400, "This account still owns an approved store. Suspend the store first (PATCH /vendors/:id/suspend).");
    }
    await db_1.prisma.auth.update({
        where: { userId },
        data: { role: next },
    });
    return findById(userId);
};
exports.userServices = {
    getAllFromDB,
    myProfile,
    updateData,
    findById,
    disableUser,
    restoreUser,
    updateRole,
};
