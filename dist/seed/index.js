"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const env_config_1 = require("../config/env-config");
const db_1 = require("../config/db");
const password_1 = require("../helpers/password");
const slug_1 = require("../helpers/slug");
const prisma_1 = require("../../generated/prisma");
const seed_data_1 = require("./seed-data");
/**
 * Idempotent development seed. Every step upserts or looks up before writing,
 * so running it repeatedly converges on the same data instead of failing on a
 * unique constraint. Nothing is ever deleted — an existing order that
 * references a seeded variant stays valid.
 *
 * Run with `pnpm seed` (or `pnpm exec prisma db seed`).
 */
async function seedSizes() {
    // key: `${groupName}:${sizeName}` -> Size.id
    const sizeIds = new Map();
    for (const group of seed_data_1.sizeGroups) {
        const sizeGroup = await db_1.prisma.sizeGroup.upsert({
            where: { name: group.name },
            update: { isDeleted: false },
            create: { name: group.name },
        });
        for (const name of group.sizes) {
            // Size.name is not unique — it is only unique within its group.
            const existing = await db_1.prisma.size.findFirst({
                where: { name, sizeGroupId: sizeGroup.id },
            });
            const size = existing ??
                (await db_1.prisma.size.create({
                    data: { name, sizeGroupId: sizeGroup.id },
                }));
            sizeIds.set(`${group.name}:${name}`, size.id);
        }
    }
    console.log(`  sizes:       ${sizeIds.size} across ${seed_data_1.sizeGroups.length} groups`);
    return sizeIds;
}
async function seedBrands() {
    const brandIds = new Map();
    for (const name of seed_data_1.brands) {
        const brand = await db_1.prisma.brand.upsert({
            where: { name },
            update: { isDeleted: false },
            create: { name },
        });
        brandIds.set(name, brand.id);
    }
    console.log(`  brands:      ${brandIds.size}`);
    return brandIds;
}
async function seedCategories() {
    const categoryIds = new Map();
    for (const category of seed_data_1.categories) {
        const sizeGroup = category.sizeGroup
            ? await db_1.prisma.sizeGroup.findUnique({
                where: { name: category.sizeGroup },
            })
            : null;
        // Parents are listed before children in seed-data, so this is resolved.
        const parentId = category.parentSlug
            ? categoryIds.get(category.parentSlug)
            : null;
        const data = {
            name: category.name,
            parentId: parentId ?? null,
            sizeGroupId: sizeGroup?.id ?? null,
        };
        const row = await db_1.prisma.category.upsert({
            where: { slug: category.slug },
            update: { ...data, isDeleted: false },
            create: { ...data, slug: category.slug },
        });
        categoryIds.set(category.slug, row.id);
    }
    console.log(`  categories:  ${categoryIds.size}`);
    return categoryIds;
}
async function seedProducts(brandIds, categoryIds, sizeIds, vendorIds) {
    let variantCount = 0;
    let imageCount = 0;
    for (const product of seed_data_1.products) {
        const brandId = brandIds.get(product.brand);
        const categoryId = categoryIds.get(product.categorySlug);
        const vendorId = vendorIds.get(product.vendorSlug);
        if (!brandId || !categoryId) {
            throw new Error(`Seed data for "${product.name}" points at an unknown brand or category`);
        }
        if (!vendorId) {
            throw new Error(`Seed data for "${product.name}" points at unknown store "${product.vendorSlug}"`);
        }
        // Slug is generated the same way the product service does it, so seeded
        // rows are indistinguishable from ones created through the API.
        const slug = (0, slug_1.generateSlug)(product.name);
        const data = {
            name: product.name,
            description: product.description,
            basePrice: product.basePrice,
            discountPrice: product.discountPrice ?? null,
            stockQuantity: product.stockQuantity,
            isFeatured: product.isFeatured ?? false,
            isPublished: true,
            gender: product.gender,
            brandId,
            categoryId,
            vendorId,
            // Seeded listings are pre-moderated, otherwise the storefront
            // would render nothing (publicProductFilter requires APPROVED).
            status: prisma_1.ProductStatus.APPROVED,
            approvedAt: new Date(),
            submittedAt: new Date(),
        };
        const row = await db_1.prisma.product.upsert({
            where: { slug },
            update: { ...data, isDeleted: false },
            create: { ...data, slug },
        });
        for (const [index, image] of product.images.entries()) {
            const existing = await db_1.prisma.productImage.findFirst({
                where: { productId: row.id, url: image.url },
            });
            if (existing)
                continue;
            await db_1.prisma.productImage.create({
                data: {
                    productId: row.id,
                    url: image.url,
                    // Seeded images live on Unsplash rather than Cloudinary; the
                    // publicId is a stable placeholder so the column stays non-null.
                    publicId: `seed/products/${slug}-${index + 1}`,
                    altText: image.altText,
                    isMain: image.isMain ?? false,
                },
            });
            imageCount++;
        }
        const sizeGroupName = seed_data_1.categories.find((c) => c.slug === product.categorySlug)?.sizeGroup ??
            "";
        for (const variant of product.variants) {
            const sizeId = sizeIds.get(`${sizeGroupName}:${variant.size}`);
            if (!sizeId) {
                throw new Error(`Size "${variant.size}" is not in the "${sizeGroupName}" size group (product: ${product.name})`);
            }
            const existing = await db_1.prisma.productVariant.findFirst({
                where: { productId: row.id, sizeId, color: variant.color },
            });
            if (existing) {
                await db_1.prisma.productVariant.update({
                    where: { id: existing.id },
                    data: {
                        stock: variant.stock,
                        price: variant.price,
                        isDeleted: false,
                    },
                });
                continue;
            }
            await db_1.prisma.productVariant.create({
                data: {
                    productId: row.id,
                    sizeId,
                    color: variant.color,
                    stock: variant.stock,
                    price: variant.price,
                },
            });
            variantCount++;
        }
    }
    console.log(`  products:    ${seed_data_1.products.length} (+${variantCount} new variants, +${imageCount} new images)`);
}
async function seedUsers() {
    const password = await (0, password_1.makePasswordHash)(env_config_1.envConfig.seed_password);
    // key: email -> User.id
    const userIds = new Map();
    for (const user of seed_data_1.users) {
        const existing = await db_1.prisma.auth.findUnique({
            where: { email: user.email },
        });
        if (existing) {
            await db_1.prisma.auth.update({
                where: { email: user.email },
                data: { password, role: user.role },
            });
            userIds.set(user.email, existing.userId);
            continue;
        }
        const created = await db_1.prisma.user.create({
            data: {
                name: user.name,
                phone: user.phone,
                auth: {
                    create: {
                        email: user.email,
                        password,
                        role: user.role,
                    },
                },
            },
        });
        userIds.set(user.email, created.id);
    }
    console.log(`  users:       ${seed_data_1.users.length}`);
    return userIds;
}
async function seedVendors(userIds) {
    // key: vendor slug -> Vendor.id
    const vendorIds = new Map();
    for (const vendor of seed_data_1.vendors) {
        const ownerId = userIds.get(vendor.ownerEmail);
        if (!ownerId) {
            throw new Error(`Seed vendor "${vendor.storeName}" points at unknown owner ${vendor.ownerEmail}`);
        }
        const data = {
            storeName: vendor.storeName,
            description: vendor.description,
            businessEmail: vendor.businessEmail,
            businessPhone: vendor.businessPhone,
            status: vendor.status,
            commissionRate: vendor.commissionRate,
            shippingFee: vendor.shippingFee,
            freeShippingThreshold: vendor.freeShippingThreshold,
            approvedAt: vendor.status === "APPROVED" ? new Date() : null,
        };
        // Upsert on slug so re-running converges on the store the multi-vendor
        // migration may already have created.
        const row = await db_1.prisma.vendor.upsert({
            where: { slug: vendor.slug },
            update: { ...data, isDeleted: false },
            create: { ...data, slug: vendor.slug, ownerId },
        });
        vendorIds.set(vendor.slug, row.id);
    }
    console.log(`  vendors:     ${vendorIds.size}`);
    return vendorIds;
}
async function seedSlides() {
    for (const slide of seed_data_1.slides) {
        await db_1.prisma.slide.upsert({
            where: { title: slide.title },
            update: { ...slide, isDeleted: false, isActive: true },
            create: slide,
        });
    }
    console.log(`  slides:      ${seed_data_1.slides.length}`);
}
async function main() {
    console.log("Seeding Trendora…");
    const sizeIds = await seedSizes();
    const brandIds = await seedBrands();
    const categoryIds = await seedCategories();
    // Users before vendors (a store needs an owner) and vendors before
    // products (a listing needs a store).
    const userIds = await seedUsers();
    const vendorIds = await seedVendors(userIds);
    await seedProducts(brandIds, categoryIds, sizeIds, vendorIds);
    await seedSlides();
    console.log("\nDone. Sign in with:");
    for (const user of seed_data_1.users) {
        console.log(`  ${user.role.padEnd(8)} ${user.email} / ${env_config_1.envConfig.seed_password}`);
    }
    console.log("\nStorefronts:");
    for (const vendor of seed_data_1.vendors) {
        console.log(`  ${vendor.status.padEnd(8)} /vendors/${vendor.slug}  (${vendor.storeName}, ${vendor.commissionRate * 100}% commission)`);
    }
}
main()
    .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await db_1.prisma.$disconnect();
});
