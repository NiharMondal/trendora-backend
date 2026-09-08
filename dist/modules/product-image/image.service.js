"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageServices = void 0;
const db_1 = require("../../config/db");
const findByProductId = async (productId) => {
    const variants = await db_1.prisma.productImage.findMany({
        where: {
            productId,
        },
    });
    return variants;
};
exports.productImageServices = { findByProductId };
