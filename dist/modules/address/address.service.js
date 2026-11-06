"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressServices = void 0;
const db_1 = require("../../config/db.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const customError_1 = __importDefault(require("../../utils/customError.js"));
/**
 * Resolve one address *belonging to the caller*, or fail.
 *
 * Every single-address operation goes through here. `authGuard` only proves the
 * caller is signed in and holds an accepted role — it cannot answer "is this
 * row yours?". Without this check the id in the URL is the only thing between
 * one shopper and every other shopper's name, phone number and street address.
 *
 * It raises **404, never 403**: a 403 confirms the row exists, which is all an
 * attacker needs to enumerate. Same convention as `assertVendorOwnsProduct` in
 * `src/helpers/vendor.ts`.
 *
 * `isDeleted` is part of the lookup so a soft-deleted address behaves as if it
 * were gone — it cannot be read, re-edited or deleted twice.
 */
const findOwnedAddress = async (id, userId) => {
    const address = await db_1.prisma.address.findFirst({
        where: { id, userId, isDeleted: false },
    });
    if (!address) {
        throw new customError_1.default(404, "Address not found");
    }
    return address;
};
const createIntoDB = async (payload, userId) => {
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user) {
        throw new customError_1.default(404, "User does not exist!");
    }
    const address = await db_1.prisma.address.create({
        data: {
            ...payload,
            userId,
        },
    });
    return address;
};
/**
 * Admin-only list of every address. Paginated because this is a PII table that
 * grows with the customer base — returning all of it in one response was the
 * sharpest edge of BE-15.
 *
 * Soft-deleted rows stay hidden.
 */
const findAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query, {
        model: "Address",
    });
    const prismaArgs = builder
        .withDefaultFilter({ isDeleted: false })
        .search(["fullName", "phone", "city"])
        .filter()
        .paginate()
        .sort()
        .build();
    const [addresses, meta] = await Promise.all([
        db_1.prisma.address.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.address),
    ]);
    return { meta, addresses };
};
const findMyAddress = async (userId) => {
    const addresses = await db_1.prisma.address.findMany({
        where: {
            userId,
            isDeleted: false,
        },
    });
    return addresses;
};
const findById = async (id, userId) => {
    return findOwnedAddress(id, userId);
};
const updateData = async (id, userId, payload) => {
    await findOwnedAddress(id, userId);
    // `payload` is the Zod-parsed body, so it cannot carry `userId` or
    // `isDeleted` — an address can never be reassigned to another account or
    // undeleted through this route.
    const updatedData = await db_1.prisma.address.update({
        where: { id },
        data: payload,
    });
    return updatedData;
};
/**
 * Soft delete. `Order.shippingAddressId` is a required column pointing here, so
 * a hard `delete` would either violate that constraint or orphan an order's
 * shipping address. The order's own `shippingSnapshot` preserves what was
 * actually shipped to (see `src/helpers/create-order.ts`), so hiding the row is
 * enough — and it keeps past orders readable.
 */
const deleteData = async (id, userId) => {
    await findOwnedAddress(id, userId);
    const data = await db_1.prisma.address.update({
        where: { id },
        data: { isDeleted: true },
    });
    return data;
};
exports.addressServices = {
    createIntoDB,
    findAllFromDB,
    findMyAddress,
    findById,
    updateData,
    deleteData,
};
