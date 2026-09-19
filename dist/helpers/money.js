"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumMoney = exports.toNumber = exports.round2 = void 0;
/** Rounds to 2 decimal places, guarding the usual float-representation edge. */
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
exports.round2 = round2;
/** Prisma Decimal (or anything numeric-ish) -> number. Null/undefined -> 0. */
const toNumber = (value) => {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === "number")
        return value;
    return parseFloat(value.toString());
};
exports.toNumber = toNumber;
/** Sums a list of money values, rounding once at the end. */
const sumMoney = (values) => (0, exports.round2)(values.reduce((total, value) => total + value, 0));
exports.sumMoney = sumMoney;
