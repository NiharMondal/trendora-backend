import { Gender, Prisma } from "@/lib/prisma-client";

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
export const STOREFRONT_FILTER_KEYS = [
    "categoryId",
    "brandId",
    "vendorId",
    "gender",
    "sizeId",
    "minPrice",
    "maxPrice",
    "minRating",
    "inStock",
] as const;

export type TStorefrontFilterKey = (typeof STOREFRONT_FILTER_KEYS)[number];

export type TStorefrontQuery = Partial<Record<TStorefrontFilterKey, string>>;

/**
 * The dimensions a facet count can be computed for. Each one names the group
 * of clauses that must be dropped when counting it — see `facetWhere`.
 */
export type TFacetDimension =
    | "category"
    | "brand"
    | "vendor"
    | "gender"
    | "size"
    | "price"
    | "rating"
    | "stock";

/** `?brandId=a,b,c` — the multi-select form every facet uses. */
const splitValues = (value?: string): string[] =>
    String(value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

const toNumber = (value?: string): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Pull the storefront keys out of a raw query string object, leaving the rest
 * (search / page / limit / sortBy and anything else) for the query builder.
 */
export const splitStorefrontQuery = (
    query: Record<string, unknown>,
): { storefront: TStorefrontQuery; rest: Record<string, unknown> } => {
    const storefront: TStorefrontQuery = {};
    const rest: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(query)) {
        if ((STOREFRONT_FILTER_KEYS as readonly string[]).includes(key)) {
            // Express gives `string | string[]` for a repeated param; the
            // storefront always sends the comma-joined form, so collapse it.
            storefront[key as TStorefrontFilterKey] = Array.isArray(value)
                ? value.join(",")
                : String(value ?? "");
            continue;
        }
        rest[key] = value;
    }

    return { storefront, rest };
};

/**
 * One `where` fragment per dimension rather than one merged clause.
 *
 * Facet counts have to be *disjunctive*: the count beside "Nike" must be
 * computed with every OTHER filter applied but the brand filter dropped.
 * Merged into a single clause that is impossible — ticking Nike would drop
 * every other brand to 0 and the shopper could never tick a second one.
 */
export const storefrontFilterClauses = (
    query: TStorefrontQuery,
): Partial<Record<TFacetDimension, Prisma.ProductWhereInput>> => {
    const clauses: Partial<Record<TFacetDimension, Prisma.ProductWhereInput>> =
        {};

    const categoryIds = splitValues(query.categoryId);
    if (categoryIds.length) {
        clauses.category = { categoryId: { in: categoryIds } };
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
    const genders = splitValues(query.gender).filter(
        (value): value is Gender =>
            (Object.values(Gender) as string[]).includes(value),
    );
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
        const bounds: Prisma.DecimalFilter = {};
        if (minPrice !== undefined) bounds.gte = minPrice;
        if (maxPrice !== undefined) bounds.lte = maxPrice;

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

    return clauses;
};

/** Case-insensitive name/description match, matching `GET /products`. */
export const storefrontSearchClause = (
    search: unknown,
): Prisma.ProductWhereInput | null => {
    const term = typeof search === "string" ? search.trim() : "";
    if (!term) return null;

    return {
        OR: [
            { name: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
        ],
    };
};

/**
 * The `where` a facet count runs under: everything the shopper has chosen
 * EXCEPT the dimension being counted. Pass no dimension for the total.
 */
export const facetWhere = (
    base: Prisma.ProductWhereInput,
    clauses: Partial<Record<TFacetDimension, Prisma.ProductWhereInput>>,
    except?: TFacetDimension,
): Prisma.ProductWhereInput => ({
    AND: [
        base,
        ...Object.entries(clauses)
            .filter(([dimension]) => dimension !== except)
            .map(([, clause]) => clause),
    ],
});
