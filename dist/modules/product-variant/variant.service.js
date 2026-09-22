"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantServices = void 0;
const db_1 = require("../../config/db.js");
const findByProductId = async (productId) => {
    const variants = await db_1.prisma.productVariant.findMany({
        where: {
            productId,
        },
    });
    return variants;
};
exports.variantServices = {
    findByProductId,
};
