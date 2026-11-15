"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productServices = void 0;
const prisma_client_1 = require("../../lib/prisma-client.js");
const db_1 = require("../../config/db.js");
const slug_1 = require("../../helpers/slug.js");
const vendor_1 = require("../../helpers/vendor.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const product_1 = require("../../helpers/product.js");
const product_filter_1 = require("../../helpers/product-filter.js");
const cloudinary_1 = require("../../utils/cloudinary.js");
const customError_1 = __importDefault(require("../../utils/customError.js"));
/** Store identity attached to every product read, so cards can link to it. */
const vendorCardSelect = {
    id: true,
    storeName: true,
    slug: true,
    logo: true,
    averageRating: true,
    status: true,
    // The cart groups by store and charges shipping per store, so a product
    // payload has to carry its store's delivery terms.
    shippingFee: true,
    freeShippingThreshold: true,
};
/**
 * Editing one of these re-opens moderation: an approved listing whose name,
 * copy, imagery or taxonomy changed is effectively a new listing and must be
 * re-reviewed. Price and stock are deliberately absent — vendors need to
 * reprice and restock without waiting on an admin.
 */
const MATERIAL_FIELDS = [
    "name",
    "description",
    "categoryId",
    "brandId",
    "gender",
    "images",
];
const createIntoDB = async (actor, payload) => {
    const { variants, images, discountPrice, submitForReview, vendorId: requestedVendorId, ...others } = payload;
    // Who does this listing belong to? A vendor can only ever create for
    // themselves; an admin must name the store explicitly.
    const vendorId = await (0, vendor_1.resolveVendorScope)(actor, requestedVendorId);
    const vendor = await db_1.prisma.vendor.findUniqueOrThrow({
        where: { id: vendorId },
        select: { slug: true },
    });
    const category = await db_1.prisma.category.findUnique({
        where: { id: payload.categoryId },
    });
    if (!category) {
        throw new customError_1.default(404, "Category not found");
    }
    const brand = await db_1.prisma.brand.findUnique({
        where: { id: payload.brandId },
    });
    if (!brand) {
        throw new customError_1.default(404, "Brand not found");
    }
    // Product names are unique per store, so give a clear error instead of a
    // raw P2002 from the composite constraint.
    const duplicate = await db_1.prisma.product.findFirst({
        where: { vendorId, name: payload.name },
        select: { id: true },
    });
    if (duplicate) {
        throw new customError_1.default(409, "You already have a product with this name in your store");
    }
    const movedImages = await (0, product_1.promoteImages)(images);
    const slug = await (0, slug_1.generateUniqueProductSlug)(payload.name, vendor.slug);
    const dis_Price = discountPrice !== null &&
        discountPrice !== undefined &&
        Number(discountPrice) <= 1
        ? null
        : discountPrice;
    const status = submitForReview
        ? prisma_client_1.ProductStatus.PENDING
        : prisma_client_1.ProductStatus.DRAFT;
    const data = await db_1.prisma.product.create({
        data: {
            ...others,
            vendorId,
            slug,
            discountPrice: dis_Price,
            status,
            submittedAt: submitForReview ? new Date() : null,
            variants: {
                create: variants?.map((v) => ({
                    sizeId: v.sizeId,
                    color: v.color,
                    stock: v.stock,
                    price: v.price,
                })),
            },
            images: {
                create: movedImages?.map((img) => ({
                    url: img.url,
                    publicId: img.publicId,
                    altText: img.altText,
                    isMain: img.isMain,
                })),
            },
        },
        include: {
            images: true,
            variants: product_1.liveVariants,
            vendor: { select: vendorCardSelect },
        },
    });
    return data;
};
/**
 * The storefront listing. Only approved, published products from approved
 * stores — see publicProductFilter for the three gates.
 */
const findAllFromDB = async (query) => {
    // Price, size, rating and stock are not plain column comparisons, so they
    // are translated here and stripped from what the builder sees — its
    // `filter()` would turn `minPrice` into `where: { minPrice }` and 500.
    const { storefront, rest } = (0, product_filter_1.splitStorefrontQuery)(query);
    const clauses = (0, product_filter_1.storefrontFilterClauses)(storefront);
    const builder = new PrismaQueryBuilder_1.default(rest, { model: "Product" });
    builder
        .withDefaultFilter((0, vendor_1.publicProductFilter)())
        .search(["name", "description"])
        .filter();
    for (const clause of Object.values(clauses)) {
        builder.addWhere(clause);
    }
    const prismaArgs = builder
        .paginate()
        .sort()
        .include({
        images: {
            select: { id: true, url: true, isMain: true },
        },
        variants: product_1.liveVariants,
        category: true,
        brand: true,
        vendor: { select: vendorCardSelect },
    })
        .build();
    const [products, meta] = await Promise.all([
        db_1.prisma.product.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.product),
    ]);
    return { meta, data: products };
};
/**
 * How far back "best selling" looks. A lifetime ranking ossifies — the same
 * products sit at the top forever because they had a head start — so the
 * storefront rail reflects a rolling window instead.
 */
const BEST_SELLER_WINDOW_DAYS = 90;
/**
 * The storefront's best-sellers rail.
 *
 * Ranked by units actually sold, not by views or by rating. Two deliberate
 * narrowings:
 *
 * - **Cancelled parcels do not count.** A seller could otherwise order their
 *   own stock and cancel it to climb the rail. Only parcels that are still
 *   live (anything but CANCELED) on an order whose payment is PAID count, so
 *   an abandoned Stripe checkout contributes nothing either.
 * - **The winners are re-filtered through `publicProductFilter`.** A product
 *   that sold well and has since been unpublished, rejected, or whose store
 *   was suspended must not reappear here — `groupBy` runs on OrderItem, which
 *   knows nothing about visibility.
 *
 * Because of that second pass the result can be shorter than `limit`; it is a
 * merchandising rail, not a paginated list, so that is acceptable and far
 * safer than leaking a hidden listing.
 */
const bestSellingProducts = async (query) => {
    const limit = Math.min(Number(query.limit) || 10, 50);
    const windowDays = Number(query.days) || BEST_SELLER_WINDOW_DAYS;
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    // Over-fetch: some winners will be filtered out by the visibility gates
    // below, and asking for exactly `limit` ids would return a short rail
    // every time one of them is hidden.
    const ranked = await db_1.prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
            order: { paymentStatus: "PAID", createdAt: { gte: since } },
            vendorOrder: { orderStatus: { not: "CANCELED" } },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: limit * 3,
    });
    if (ranked.length === 0)
        return [];
    const rankedIds = ranked.map((row) => row.productId);
    const products = await db_1.prisma.product.findMany({
        where: (0, vendor_1.publicProductFilter)({ id: { in: rankedIds } }),
        include: {
            images: { select: { id: true, url: true, isMain: true } },
            variants: product_1.liveVariants,
            category: { select: { id: true, name: true, slug: true, taxRate: true } },
            brand: { select: { id: true, name: true } },
            vendor: { select: vendorCardSelect },
        },
    });
    // `findMany` returns them in its own order, so re-impose the ranking and
    // carry the figure that produced it — the rail wants to say "120 sold".
    const soldByProduct = new Map(ranked.map((row) => [row.productId, row._sum.quantity ?? 0]));
    return products
        .map((product) => ({
        ...product,
        unitsSold: soldByProduct.get(product.id) ?? 0,
    }))
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, limit);
};
/**
 * Products hang off LEAF categories, so a raw group-by never produces a row
 * for "Footwear" — only for "Sneakers" and "Shoe". The storefront's category
 * tiles link to the parents, so the panel has to offer them too, with a count
 * that includes everything underneath.
 *
 * Summed here rather than in SQL because Prisma's filtered relation count only
 * counts the direct relation; reaching a child's products would need a raw
 * query for a list that is small by construction — the taxonomy is
 * admin-owned, not user-generated.
 */
const rollUpCategoryFacets = (rows) => {
    const facets = new Map();
    for (const row of rows) {
        facets.set(row.id, {
            id: row.id,
            name: row.name,
            slug: row.slug,
            image: row.image,
            parentId: row.parentId,
            count: row._count.products,
        });
    }
    for (const row of rows) {
        if (!row.parent)
            continue;
        const existing = facets.get(row.parent.id);
        if (existing) {
            // The parent sells directly too; its own products are already
            // counted, so only add the child's.
            existing.count += row._count.products;
            continue;
        }
        facets.set(row.parent.id, {
            id: row.parent.id,
            name: row.parent.name,
            slug: row.parent.slug,
            image: row.parent.image,
            parentId: null,
            count: row._count.products,
        });
    }
    // Each parent immediately followed by its own children, so the panel can
    // indent them without a second pass.
    const all = [...facets.values()];
    const nameOf = (id) => (id && facets.get(id)?.name) || "";
    return all.sort((a, b) => {
        const rootA = a.parentId ? nameOf(a.parentId) : a.name;
        const rootB = b.parentId ? nameOf(b.parentId) : b.name;
        return (rootA.localeCompare(rootB) ||
            Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)) ||
            a.name.localeCompare(b.name));
    });
};
/** Ratings the panel offers, as "n stars & up". */
const RATING_BUCKETS = [4, 3, 2];
/**
 * The filter panel's options, derived from the live catalogue rather than
 * hardcoded on the client.
 *
 * Why the server owns this: sellers list whatever they like, so the set of
 * brands, categories, sizes and price points that exist is a property of the
 * data, not of the frontend. A client-side list goes stale the moment a vendor
 * adds the first product in a new category, and it cannot know the counts.
 *
 * Every option returned is reachable — it comes from products that pass the
 * same three visibility gates as `GET /products` — so the panel can never
 * offer a filter that returns an empty page. Counts are disjunctive (see
 * `facetWhere`): the number beside a brand is what the shopper would get if
 * they ticked it, with their other choices still applied.
 *
 * Takes the same query params as `GET /products`, so the frontend passes its
 * current filter state straight through and the counts narrow as it changes.
 */
const findFilterFacets = async (query) => {
    const { storefront, rest } = (0, product_filter_1.splitStorefrontQuery)(query);
    const clauses = (0, product_filter_1.storefrontFilterClauses)(storefront);
    const search = (0, product_filter_1.storefrontSearchClause)(rest.search);
    // Search is part of the base rather than a dimension of its own: a facet
    // is an option within the current result set, and the search term defines
    // that set. It is never dropped from a count.
    const base = {
        AND: [(0, vendor_1.publicProductFilter)(), ...(search ? [search] : [])],
    };
    const categoryWhere = (0, product_filter_1.facetWhere)(base, clauses, "category");
    const brandWhere = (0, product_filter_1.facetWhere)(base, clauses, "brand");
    const vendorWhere = (0, product_filter_1.facetWhere)(base, clauses, "vendor");
    const genderWhere = (0, product_filter_1.facetWhere)(base, clauses, "gender");
    const sizeWhere = (0, product_filter_1.facetWhere)(base, clauses, "size");
    const priceWhere = (0, product_filter_1.facetWhere)(base, clauses, "price");
    const ratingWhere = (0, product_filter_1.facetWhere)(base, clauses, "rating");
    const currentWhere = (0, product_filter_1.facetWhere)(base, clauses);
    const [categories, brands, vendors, genderGroups, sizeRows, priceRange, ratingCounts, totalProducts,] = await Promise.all([
        db_1.prisma.category.findMany({
            where: { isDeleted: false, products: { some: categoryWhere } },
            select: {
                id: true,
                name: true,
                slug: true,
                image: true,
                parentId: true,
                parent: {
                    select: { id: true, name: true, slug: true, image: true },
                },
                _count: { select: { products: { where: categoryWhere } } },
            },
            orderBy: { name: "asc" },
        }),
        db_1.prisma.brand.findMany({
            where: { isDeleted: false, products: { some: brandWhere } },
            select: {
                id: true,
                name: true,
                logo: true,
                _count: { select: { products: { where: brandWhere } } },
            },
            orderBy: { name: "asc" },
        }),
        db_1.prisma.vendor.findMany({
            where: { products: { some: vendorWhere } },
            select: {
                id: true,
                storeName: true,
                slug: true,
                logo: true,
                _count: { select: { products: { where: vendorWhere } } },
            },
            orderBy: { storeName: "asc" },
        }),
        db_1.prisma.product.groupBy({
            by: ["gender"],
            where: genderWhere,
            _count: { _all: true },
        }),
        // Size lives on the variant, and a product usually has several
        // variants in the same size (one per colour). `distinct` on the pair
        // is what makes the number below a count of PRODUCTS rather than of
        // variants — otherwise a three-colour shirt counts as three.
        db_1.prisma.productVariant.findMany({
            where: {
                isDeleted: false,
                sizeId: { not: null },
                product: sizeWhere,
            },
            select: {
                productId: true,
                size: {
                    select: {
                        id: true,
                        name: true,
                        sizeGroup: { select: { id: true, name: true } },
                    },
                },
            },
            distinct: ["sizeId", "productId"],
        }),
        db_1.prisma.product.aggregate({
            where: priceWhere,
            _min: { basePrice: true, discountPrice: true },
            _max: { basePrice: true },
        }),
        Promise.all(RATING_BUCKETS.map((value) => db_1.prisma.product
            .count({
            where: {
                AND: [ratingWhere, { averageRating: { gte: value } }],
            },
        })
            .then((count) => ({ value, count })))),
        db_1.prisma.product.count({ where: currentWhere }),
    ]);
    // One row per (size, product); fold it down to one entry per size.
    const sizeCounts = new Map();
    for (const row of sizeRows) {
        if (!row.size)
            continue;
        const entry = sizeCounts.get(row.size.id);
        if (entry) {
            entry.count += 1;
            continue;
        }
        sizeCounts.set(row.size.id, {
            id: row.size.id,
            name: row.size.name,
            sizeGroup: row.size.sizeGroup?.name ?? null,
            count: 1,
        });
    }
    // The shown price is the discounted one where there is a discount, so the
    // floor of the range can sit below the cheapest basePrice. The ceiling
    // cannot: a discount is always lower than the price it replaces.
    const baseMin = priceRange._min.basePrice;
    const discountMin = priceRange._min.discountPrice;
    const candidates = [baseMin, discountMin]
        .filter((value) => value !== null)
        .map((value) => Number(value));
    const price = {
        min: candidates.length ? Math.floor(Math.min(...candidates)) : 0,
        max: priceRange._max.basePrice
            ? Math.ceil(Number(priceRange._max.basePrice))
            : 0,
    };
    return {
        totalProducts,
        price,
        categories: rollUpCategoryFacets(categories),
        brands: brands.map(({ _count, ...brand }) => ({
            ...brand,
            count: _count.products,
        })),
        stores: vendors.map(({ _count, ...vendor }) => ({
            ...vendor,
            count: _count.products,
        })),
        genders: genderGroups
            .map((group) => ({
            value: group.gender,
            count: group._count._all,
        }))
            .sort((a, b) => b.count - a.count),
        // Grouped first, then natural order inside the group, so the panel can
        // render "Clothing: S M L XL" and "Footwear: 8 9 10" as written rather
        // than interleaving 2XL with shoe size 8.
        sizes: [...sizeCounts.values()].sort((a, b) => (a.sizeGroup ?? "").localeCompare(b.sizeGroup ?? "") ||
            a.name.localeCompare(b.name, undefined, { numeric: true })),
        ratings: ratingCounts.filter((bucket) => bucket.count > 0),
    };
};
/**
 * The caller's own catalogue, in every moderation state — this is the vendor
 * dashboard's product table. An ADMIN may narrow it with `?vendorId=`.
 */
const findMyProducts = async (actor, query) => {
    const scope = await (0, vendor_1.vendorListScope)(actor, query.vendorId ? String(query.vendorId) : undefined);
    // vendorId is consumed by the scope; leaving it in would double-filter.
    const { vendorId: _ignored, ...rest } = query;
    const builder = new PrismaQueryBuilder_1.default(rest, { model: "Product" });
    const prismaArgs = builder
        .withDefaultFilter({ isDeleted: false, ...scope })
        .search(["name", "description"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
        images: { select: { id: true, url: true, isMain: true } },
        variants: product_1.liveVariants,
        category: { select: { id: true, name: true, slug: true, taxRate: true } },
        brand: { select: { id: true, name: true } },
        _count: { select: { orderItems: true } },
    })
        .build();
    const [products, meta] = await Promise.all([
        db_1.prisma.product.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.product),
    ]);
    return { meta, data: products };
};
/** Every product in any state, for the admin moderation queue. */
const findAllForAdmin = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query, { model: "Product" });
    const prismaArgs = builder
        .withDefaultFilter({ isDeleted: false })
        .search(["name", "description"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
        images: { select: { id: true, url: true, isMain: true } },
        vendor: { select: vendorCardSelect },
        category: { select: { id: true, name: true, taxRate: true } },
        brand: { select: { id: true, name: true } },
    })
        .build();
    const [products, meta] = await Promise.all([
        db_1.prisma.product.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.product),
    ]);
    return { meta, data: products };
};
/**
 * Public single-product read. Applies the visibility gates, so an unapproved
 * or hidden listing 404s for shoppers even if they know the id.
 */
const findById = async (id) => {
    const product = await db_1.prisma.product.findFirst({
        where: (0, vendor_1.publicProductFilter)({ id }),
        include: {
            variants: product_1.liveVariants,
            images: true,
            vendor: { select: vendor_1.publicVendorSelect },
        },
    });
    if (!product) {
        throw new customError_1.default(404, "Product not found");
    }
    return product;
};
/** Owner/admin single-product read, in any moderation state. */
const findMyProductById = async (actor, id) => {
    if (actor.role === prisma_client_1.Role.ADMIN) {
        const product = await db_1.prisma.product.findFirst({
            where: { id, isDeleted: false },
            include: {
                variants: { ...product_1.liveVariants, include: { size: true } },
                images: true,
                vendor: { select: vendorCardSelect },
            },
        });
        if (!product)
            throw new customError_1.default(404, "Product not found");
        return product;
    }
    const vendorId = await (0, vendor_1.resolveVendorScope)(actor);
    await (0, vendor_1.assertVendorOwnsProduct)(vendorId, id);
    return db_1.prisma.product.findUniqueOrThrow({
        where: { id },
        include: {
            variants: { ...product_1.liveVariants, include: { size: true } },
            images: true,
            vendor: { select: vendorCardSelect },
        },
    });
};
const findBySlug = async (slug) => {
    const product = await db_1.prisma.product.findFirst({
        where: (0, vendor_1.publicProductFilter)({ slug }),
        include: {
            variants: {
                ...product_1.liveVariants,
                include: {
                    size: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                }
            },
            images: true,
            brand: true,
            vendor: { select: vendor_1.publicVendorSelect },
        },
    });
    if (!product) {
        throw new customError_1.default(404, "Product not found");
    }
    return product;
};
const updateData = async (actor, id, payload) => {
    // `submitForReview` is a create-time flag; moderation state is changed
    // through /submit and /approve, never as a side effect of an edit.
    const { variants = [], images = [], submitForReview: _ignoredSubmitFlag, ...rest } = payload;
    // Ownership first: a vendor may only touch their own listing, and the
    // 404 (not 403) keeps another store's product ids unguessable.
    const isAdmin = actor.role === prisma_client_1.Role.ADMIN;
    const product = isAdmin
        ? await db_1.prisma.product.findFirst({
            where: { id, isDeleted: false },
            include: { variants: product_1.liveVariants, images: true, vendor: true },
        })
        : await (async () => {
            const vendorId = await (0, vendor_1.resolveVendorScope)(actor);
            await (0, vendor_1.assertVendorOwnsProduct)(vendorId, id);
            return db_1.prisma.product.findUnique({
                where: { id },
                include: { variants: product_1.liveVariants, images: true, vendor: true },
            });
        })();
    if (!product) {
        throw new customError_1.default(404, "Product not found!");
    }
    if (rest.name && rest.name !== product.name) {
        const duplicate = await db_1.prisma.product.findFirst({
            where: {
                vendorId: product.vendorId,
                name: rest.name,
                id: { not: id },
            },
            select: { id: true },
        });
        if (duplicate) {
            throw new customError_1.default(409, "You already have a product with this name in your store");
        }
    }
    const slug = rest.name
        ? await (0, slug_1.generateUniqueProductSlug)(rest.name, product.vendor.slug, id)
        : product.slug;
    // Collect existing IDs
    const existingVariantIds = product.variants.map((v) => v.id);
    const existingImageIds = product.images.map((i) => i.id);
    // Extract IDs from incoming payload
    const incomingVariantIds = variants
        .filter((v) => v.id)
        .map((v) => v.id);
    const incomingImageIds = images
        .filter((i) => i.id)
        .map((i) => i.id);
    // IDs to delete (those that exist in DB but not in request). An empty
    // images/variants array means "unchanged", not "delete everything".
    const variantIdsToDelete = variants.length
        ? existingVariantIds.filter((vid) => !incomingVariantIds.includes(vid))
        : [];
    const imageIdsToDelete = images.length
        ? existingImageIds.filter((iid) => !incomingImageIds.includes(iid))
        : [];
    // 1. Delete removed images from cloudinary
    const imagesToDelete = product.images.filter((img) => imageIdsToDelete.includes(img.id));
    await Promise.all(imagesToDelete.map((img) => (0, cloudinary_1.deleteFromCloudinary)(img.publicId)));
    // 2. Move new temp images to final folder
    const processedImages = await (0, product_1.promoteImages)(images);
    // 3. Decide whether this edit needs re-moderation.
    const changedMaterially = MATERIAL_FIELDS.some((field) => {
        if (field === "images")
            return images.length > 0;
        return (payload[field] !== undefined &&
            payload[field] !== product[field]);
    });
    const needsReReview = changedMaterially && product.status === prisma_client_1.ProductStatus.APPROVED;
    // Begin transaction to ensure atomicity
    const updatedProduct = await db_1.prisma.$transaction(async (tx) => {
        // Removed variants are SOFT deleted: `OrderItem.variantId` is
        // ON DELETE SET NULL, so dropping the row would detach every past
        // order line that sold it. Reads filter on `liveVariants`.
        if (variantIdsToDelete.length > 0) {
            await tx.productVariant.updateMany({
                where: { id: { in: variantIdsToDelete } },
                data: { isDeleted: true },
            });
        }
        if (imageIdsToDelete.length > 0) {
            await tx.productImage.deleteMany({
                where: { id: { in: imageIdsToDelete } },
            });
        }
        // Upsert (update existing or create new) variants
        for (const variant of variants) {
            if (variant.id) {
                await tx.productVariant.update({
                    where: { id: variant.id },
                    data: {
                        sizeId: variant.sizeId,
                        color: variant.color,
                        stock: variant.stock,
                        price: variant.price,
                    },
                });
            }
            else {
                await tx.productVariant.create({
                    data: {
                        productId: id,
                        sizeId: variant.sizeId,
                        color: variant.color,
                        stock: variant.stock,
                        price: variant.price,
                    },
                });
            }
        }
        // Upsert images
        for (const image of processedImages) {
            if (image.id) {
                await tx.productImage.update({
                    where: { id: image.id },
                    data: {
                        url: image.url,
                        isMain: image.isMain,
                    },
                });
            }
            else {
                await tx.productImage.create({
                    data: {
                        productId: id,
                        url: image.url,
                        publicId: image.publicId,
                        altText: image.altText,
                        isMain: image.isMain,
                    },
                });
            }
        }
        // Finally update main product info
        const updated = await tx.product.update({
            where: { id },
            data: {
                ...rest,
                slug,
                ...(needsReReview
                    ? {
                        status: prisma_client_1.ProductStatus.PENDING,
                        submittedAt: new Date(),
                        approvedAt: null,
                        rejectionReason: null,
                    }
                    : {}),
            },
            include: {
                variants: product_1.liveVariants,
                images: true,
                vendor: { select: vendorCardSelect },
            },
        });
        return updated;
    });
    return updatedProduct;
};
/** Vendor sends a DRAFT or REJECTED listing to the moderation queue. */
const submitForReview = async (actor, id) => {
    const product = actor.role === prisma_client_1.Role.ADMIN
        ? await db_1.prisma.product.findFirst({ where: { id, isDeleted: false } })
        : await (0, vendor_1.assertVendorOwnsProduct)(await (0, vendor_1.resolveVendorScope)(actor), id);
    if (!product) {
        throw new customError_1.default(404, "Product not found");
    }
    if (product.status === prisma_client_1.ProductStatus.PENDING) {
        throw new customError_1.default(400, "This product is already awaiting review");
    }
    if (product.status === prisma_client_1.ProductStatus.APPROVED) {
        throw new customError_1.default(400, "This product is already approved");
    }
    return db_1.prisma.product.update({
        where: { id },
        data: {
            status: prisma_client_1.ProductStatus.PENDING,
            submittedAt: new Date(),
            rejectionReason: null,
        },
    });
};
/** Vendor's own show/hide switch. Independent of admin moderation. */
const setPublished = async (actor, id, isPublished) => {
    const product = actor.role === prisma_client_1.Role.ADMIN
        ? await db_1.prisma.product.findFirst({ where: { id, isDeleted: false } })
        : await (0, vendor_1.assertVendorOwnsProduct)(await (0, vendor_1.resolveVendorScope)(actor), id);
    if (!product) {
        throw new customError_1.default(404, "Product not found");
    }
    if (isPublished && product.status !== prisma_client_1.ProductStatus.APPROVED) {
        throw new customError_1.default(400, "Only an approved product can be published. Submit it for review first.");
    }
    return db_1.prisma.product.update({
        where: { id },
        data: { isPublished },
    });
};
// ------------------------------------------------------------ admin moderation
const approveProduct = async (id) => {
    const product = await db_1.prisma.product.findFirst({
        where: { id, isDeleted: false },
    });
    if (!product) {
        throw new customError_1.default(404, "Product not found");
    }
    if (product.status === prisma_client_1.ProductStatus.APPROVED) {
        throw new customError_1.default(400, "This product is already approved");
    }
    return db_1.prisma.product.update({
        where: { id },
        data: {
            status: prisma_client_1.ProductStatus.APPROVED,
            approvedAt: new Date(),
            rejectionReason: null,
        },
    });
};
const rejectProduct = async (id, payload) => {
    const product = await db_1.prisma.product.findFirst({
        where: { id, isDeleted: false },
    });
    if (!product) {
        throw new customError_1.default(404, "Product not found");
    }
    return db_1.prisma.product.update({
        where: { id },
        data: {
            status: prisma_client_1.ProductStatus.REJECTED,
            rejectionReason: payload.reason,
            approvedAt: null,
            // A rejected listing must not stay on the storefront.
            isPublished: false,
        },
    });
};
const deleteData = async (actor, id) => {
    if (actor.role !== prisma_client_1.Role.ADMIN) {
        const vendorId = await (0, vendor_1.resolveVendorScope)(actor);
        await (0, vendor_1.assertVendorOwnsProduct)(vendorId, id);
    }
    else {
        await db_1.prisma.product.findUniqueOrThrow({ where: { id } });
    }
    const data = await db_1.prisma.product.update({
        where: { id },
        data: {
            isDeleted: true,
            isPublished: false,
        },
    });
    return data;
};
const newArrivalProducts = async () => {
    const products = await db_1.prisma.product.findMany({
        where: (0, vendor_1.publicProductFilter)(),
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
            images: true,
            variants: product_1.liveVariants,
            vendor: { select: vendorCardSelect },
        },
    });
    return products;
};
const relatedProducts = async (id) => {
    const product = await db_1.prisma.product.findFirstOrThrow({
        where: (0, vendor_1.publicProductFilter)({ id }),
        include: {
            category: true,
            brand: true,
        },
    });
    const referencePrice = Number(product.discountPrice ?? product.basePrice);
    const minPrice = referencePrice * 0.8;
    const maxPrice = referencePrice * 1.2;
    const products = await db_1.prisma.product.findMany({
        where: (0, vendor_1.publicProductFilter)({
            id: { not: id },
            AND: [
                {
                    OR: [
                        {
                            discountPrice: {
                                not: null,
                                gte: minPrice,
                                lte: maxPrice,
                            },
                        },
                        {
                            discountPrice: null,
                            basePrice: { gte: minPrice, lte: maxPrice },
                        },
                    ],
                },
            ],
        }),
        take: 10,
        include: {
            images: {
                select: { id: true, url: true, isMain: true },
            },
            vendor: { select: vendorCardSelect },
        },
    });
    return products;
};
/** Storefront: everything one store currently sells. */
const findByVendorSlug = async (slug, query) => {
    const vendor = await db_1.prisma.vendor.findFirst({
        where: { slug, status: "APPROVED", isDeleted: false },
        select: { id: true },
    });
    if (!vendor) {
        throw new customError_1.default(404, "Store not found");
    }
    const builder = new PrismaQueryBuilder_1.default(query, { model: "Product" });
    const prismaArgs = builder
        .withDefaultFilter((0, vendor_1.publicProductFilter)({ vendorId: vendor.id }))
        .search(["name", "description"])
        .filter()
        .paginate()
        .sort()
        .include({
        images: { select: { id: true, url: true, isMain: true } },
        variants: product_1.liveVariants,
        category: { select: { id: true, name: true, slug: true, taxRate: true } },
        brand: { select: { id: true, name: true } },
    })
        .build();
    const [products, meta] = await Promise.all([
        db_1.prisma.product.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.product),
    ]);
    return { meta, data: products };
};
exports.productServices = {
    createIntoDB,
    findAllFromDB,
    findFilterFacets,
    findById,
    findBySlug,
    updateData,
    deleteData,
    //
    findMyProducts,
    findMyProductById,
    submitForReview,
    setPublished,
    //
    findAllForAdmin,
    approveProduct,
    rejectProduct,
    //
    newArrivalProducts,
    bestSellingProducts,
    relatedProducts,
    findByVendorSlug,
};
