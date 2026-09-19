import slugify from "slugify";
import { prisma } from "../config/db";

export const generateSlug = (title: string): string => {
    const slug = slugify(title, { lower: true });
    return slug;
};

/**
 * Product slugs are globally unique but product NAMES are only unique per
 * vendor, so two stores selling "Nike Air Max 90" would collide on the slug.
 * The store slug is appended to disambiguate, then a numeric suffix if that
 * still collides (the same store renaming a second product identically).
 *
 * `excludeProductId` lets an update keep its own slug instead of bumping it.
 */
export const generateUniqueProductSlug = async (
    name: string,
    vendorSlug: string,
    excludeProductId?: string,
): Promise<string> => {
    const base = generateSlug(name);

    const isTaken = async (candidate: string) => {
        const existing = await prisma.product.findUnique({
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

/**
 * Store slugs are globally unique; a second "Urban Threads" becomes
 * "urban-threads-2".
 */
export const generateUniqueVendorSlug = async (
    storeName: string,
    excludeVendorId?: string,
): Promise<string> => {
    const base = generateSlug(storeName);

    const isTaken = async (candidate: string) => {
        const existing = await prisma.vendor.findUnique({
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
