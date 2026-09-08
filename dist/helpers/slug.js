"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUniqueVendorSlug = exports.generateUniqueProductSlug = exports.generateSlug = void 0;
const slugify_1 = __importDefault(require("slugify"));
const db_1 = require("../config/db");
const generateSlug = (title) => {
    const slug = (0, slugify_1.default)(title, { lower: true });
    return slug;
};
exports.generateSlug = generateSlug;
/**
 * Product slugs are globally unique but product NAMES are only unique per
 * vendor, so two stores selling "Nike Air Max 90" would collide on the slug.
 * The store slug is appended to disambiguate, then a numeric suffix if that
 * still collides (the same store renaming a second product identically).
 *
 * `excludeProductId` lets an update keep its own slug instead of bumping it.
 */
const generateUniqueProductSlug = async (name, vendorSlug, excludeProductId) => {
    const base = (0, exports.generateSlug)(name);
    const isTaken = async (candidate) => {
        const existing = await db_1.prisma.product.findUnique({
            where: { slug: candidate },
            select: { id: true },
        });
        return !!existing && existing.id !== excludeProductId;
    };
    if (!(await isTaken(base))) {
        return base;
    }
    const scoped = `${base}-${vendorSlug}`;
    if (!(await isTaken(scoped))) {
        return scoped;
    }
    for (let suffix = 2; suffix < 100; suffix++) {
        const candidate = `${scoped}-${suffix}`;
        if (!(await isTaken(candidate))) {
            return candidate;
        }
    }
    // Effectively unreachable, but never return a slug we know is taken.
    return `${scoped}-${Date.now()}`;
};
exports.generateUniqueProductSlug = generateUniqueProductSlug;
/**
 * Store slugs are globally unique; a second "Urban Threads" becomes
 * "urban-threads-2".
 */
const generateUniqueVendorSlug = async (storeName, excludeVendorId) => {
    const base = (0, exports.generateSlug)(storeName);
    const isTaken = async (candidate) => {
        const existing = await db_1.prisma.vendor.findUnique({
            where: { slug: candidate },
            select: { id: true },
        });
        return !!existing && existing.id !== excludeVendorId;
    };
    if (!(await isTaken(base))) {
        return base;
    }
    for (let suffix = 2; suffix < 1000; suffix++) {
        const candidate = `${base}-${suffix}`;
        if (!(await isTaken(candidate))) {
            return candidate;
        }
    }
    return `${base}-${Date.now()}`;
};
exports.generateUniqueVendorSlug = generateUniqueVendorSlug;
