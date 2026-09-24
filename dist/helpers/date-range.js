"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDateRange = void 0;
const customError_1 = __importDefault(require("../utils/customError.js"));
/**
 * `?startDate=&endDate=` from a query string, for the analytics endpoints.
 *
 * `new Date("garbage")` is an Invalid Date, which Prisma rejects with a 500, so
 * a bad value is a 400 here instead. Either bound may be omitted; callers apply
 * a range only when both are present.
 */
const parseDateRange = (query) => {
    const parse = (value, name) => {
        if (value === undefined || value === "")
            return undefined;
        const date = new Date(String(value));
        if (Number.isNaN(date.getTime())) {
            throw new customError_1.default(400, `${name} must be a valid date`);
        }
        return date;
    };
    const startDate = parse(query.startDate, "startDate");
    const endDate = parse(query.endDate, "endDate");
    if (startDate && endDate && startDate > endDate) {
        throw new customError_1.default(400, "startDate must be before endDate");
    }
    return { startDate, endDate };
};
exports.parseDateRange = parseDateRange;
