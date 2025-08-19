"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantServices = void 0;
const db_1 = require("../../config/db");
const findByProductId = async (productId) => {
    const variants = await db_1.prisma.productVariant.findMany({
        where: {
            productId,
        },
    });
    return variants;
};
const addVariants = async (productId, payload) => {
    const variants = await db_1.prisma.productVariant.createMany({
        data: payload.map((v) => ({
            ...v,
            productId,
        })),
    });
    return variants;
};
const updateVariant = async (id, payload) => {
    await db_1.prisma.productVariant.findUniqueOrThrow({ where: { id } });
    const updatedData = await db_1.prisma.productVariant.update({
        where: { id },
        data: {
            ...payload,
        },
    });
    return updatedData;
};
const deleteVariant = async (id) => {
    const variant = await db_1.prisma.productVariant.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });
    return variant;
};
exports.variantServices = {
    findByProductId,
    addVariants,
    updateVariant,
    deleteVariant,
};
