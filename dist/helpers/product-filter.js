"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.facetWhere = exports.storefrontSearchClause = exports.storefrontFilterClauses = exports.splitStorefrontQuery = exports.STOREFRONT_FILTER_KEYS = void 0;
const prisma_client_1 = require("../lib/prisma-client.js");
/**
 * Storefront filtering, in one place, because two endpoints have to agree on
 * it: `GET /products` (which rows come back) and `GET /products/filters`
 * (which options the shopper is offered, and how many rows each would leave).
 * If the two ever disagree the panel offers a filter that returns nothing.
 *
 * These keys are handled HERE and deliberately removed from the query before
 * `PrismaQueryBuilder.filter()` sees it. That method turns any unrecognised
 * key into a literal `where` clause on a column of the same name, so leaving
 * `minPrice` in would produce `where: { minPrice: 50 }` — a 500, not a 400.
 */
exports.STOREFRONT_FILTER_KEYS = [
    "categoryId",
    "brandId",
    "vendorId",
    "gender",
    "sizeId",
    "minPrice",
    "maxPrice",
    "minRating",
    "inStock",
    "onSale",
];
/** `?brandId=a,b,c` — the multi-select form every facet uses. */
const splitValues = (value) => String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
const toNumber = (value) => {
    if (value === undefined || value === null || value === "")
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};
/**
 * Pull the storefront keys out of a raw query string object, leaving the rest
 * (search / page / limit / sortBy and anything else) for the query builder.
 */
const splitStorefrontQuery = (query) => {
    const storefront = {};
    const rest = {};
    for (const [key, value] of Object.entries(query)) {
        if (exports.STOREFRONT_FILTER_KEYS.includes(key)) {
            // Express gives `string | string[]` for a repeated param; the
            // storefront always sends the comma-joined form, so collapse it.
            storefront[key] = Array.isArray(value)
                ? value.join(",")
                : String(value ?? "");
            continue;
        }
        rest[key] = value;
    }
    return { storefront, rest };
};
exports.splitStorefrontQuery = splitStorefrontQuery;
/**
 * One `where` fragment per dimension rather than one merged clause.
 *
 * Facet counts have to be *disjunctive*: the count beside "Nike" must be
 * computed with every OTHER filter applied but the brand filter dropped.
 * Merged into a single clause that is impossible — ticking Nike would drop
 * every other brand to 0 and the shopper could never tick a second one.
 */
const storefrontFilterClauses = (query) => {
    const clauses = {};
    const categoryIds = splitValues(query.categoryId);
    if (categoryIds.length) {
        // Self OR children. The taxonomy is two deep (Footwear -> Sneakers)
        // and products hang off the LEAF, so matching `categoryId` alone makes
        // every parent category return nothing — which is exactly what the
        // storefront's "shop by category" tiles link to.
        clauses.category = {
            OR: [
                { categoryId: { in: categoryIds } },
                { category: { parentId: { in: categoryIds } } },
            ],
        };
    }
    const brandIds = splitValues(query.brandId);
    if (brandIds.length) {
        clauses.brand = { brandId: { in: brandIds } };
    }
    const vendorIds = splitValues(query.vendorId);
    if (vendorIds.length) {
        clauses.vendor = { vendorId: { in: vendorIds } };
    }
    // Unknown values are dropped rather than passed through: Prisma rejects an
    // invalid enum member with a 500, and a typo'd `?gender=` should narrow
    // nothing, not break the page.
    const genders = splitValues(query.gender).filter((value) => Object.values(prisma_client_1.Gender).includes(value));
    if (genders.length) {
        clauses.gender = { gender: { in: genders } };
    }
    const sizeIds = splitValues(query.sizeId);
    if (sizeIds.length) {
        // A size lives on the variant, so this is "has at least one live
        // variant in one of these sizes", not a column comparison.
        clauses.size = {
            variants: { some: { isDeleted: false, sizeId: { in: sizeIds } } },
        };
    }
    const minPrice = toNumber(query.minPrice);
    const maxPrice = toNumber(query.maxPrice);
    if (minPrice !== undefined || maxPrice !== undefined) {
        const bounds = {};
        if (minPrice !== undefined)
            bounds.gte = minPrice;
        if (maxPrice !== undefined)
            bounds.lte = maxPrice;
        // Compare against the price the shopper is actually shown: the
        // discounted one where there is a discount, the base price otherwise.
        // Filtering `basePrice` alone hides a 200 shirt discounted to 40 from
        // the "under 50" bucket it visibly belongs in.
        clauses.price = {
            OR: [
                { discountPrice: { not: null, ...bounds } },
                { discountPrice: null, basePrice: bounds },
            ],
        };
    }
    const minRating = toNumber(query.minRating);
    if (minRating !== undefined && minRating > 0) {
        clauses.rating = { averageRating: { gte: minRating } };
    }
    if (query.inStock === "true") {
        clauses.stock = { stockQuantity: { gt: 0 } };
    }
    if (query.onSale === "true") {
        // "Discounted" is `discountPrice IS NOT NULL`, which no generic column
        // filter can express — `?discountPrice=` can only ever test equality.
        // The create service already normalises a nonsense discount (<= 1) to
        // NULL, so a non-null value here is a real markdown.
        clauses.sale = { discountPrice: { not: null } };
    }
    return clauses;
};
exports.storefrontFilterClauses = storefrontFilterClauses;
/** Case-insensitive name/description match, matching `GET /products`. */
const storefrontSearchClause = (search) => {
    const term = typeof search === "string" ? search.trim() : "";
    if (!term)
        return null;
    return {
        OR: [
            { name: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
        ],
    };
};
exports.storefrontSearchClause = storefrontSearchClause;
/**
 * The `where` a facet count runs under: everything the shopper has chosen
 * EXCEPT the dimension being counted. Pass no dimension for the total.
 */
const facetWhere = (base, clauses, except) => ({
    AND: [
        base,
        ...Object.entries(clauses)
            .filter(([dimension]) => dimension !== except)
            .map(([, clause]) => clause),
    ],
});
exports.facetWhere = facetWhere;
