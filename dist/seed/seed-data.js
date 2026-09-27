"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slides = exports.vendors = exports.users = exports.products = exports.categories = exports.brands = exports.sizeGroups = void 0;
const prisma_client_1 = require("../lib/prisma-client.js");
exports.sizeGroups = [
    { name: "Clothing", sizes: ["XS", "S", "M", "L", "XL", "2XL"] },
    { name: "Footwear", sizes: ["7", "8", "9", "10", "11", "12"] },
];
exports.brands = ["Levi's", "Nike", "Adidas", "Trendora Basics"];
/** Parents must appear before their children — the seeder inserts in order. */
exports.categories = [
    { name: "Clothing", slug: "clothing" },
    { name: "Footwear", slug: "footwear" },
    {
        name: "Jeans",
        slug: "jeans",
        parentSlug: "clothing",
        sizeGroup: "Clothing",
    },
    {
        name: "T-Shirts",
        slug: "t-shirts",
        parentSlug: "clothing",
        sizeGroup: "Clothing",
    },
    {
        name: "Sneakers",
        slug: "sneakers",
        parentSlug: "footwear",
        sizeGroup: "Footwear",
    },
];
exports.products = [
    {
        name: "Levi's 501 Original Fit Jeans",
        vendorSlug: "urban-threads",
        description: "The original blue jean since 1873. Crafted with a signature button fly and straight leg. A blank canvas for self-expression that has stayed true for over 140 years.",
        basePrice: 89,
        discountPrice: 69,
        stockQuantity: 300,
        gender: prisma_client_1.Gender.MEN,
        brand: "Levi's",
        categorySlug: "jeans",
        images: [
            {
                url: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&auto=format&fit=crop&q=60",
                altText: "Levi's 501 jeans folded on a light background",
                isMain: true,
            },
            {
                url: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=60",
                altText: "Stack of blue denim jeans",
            },
        ],
        variants: [
            { size: "S", color: "Black", stock: 30, price: 69 },
            { size: "M", color: "Black", stock: 35, price: 69 },
            { size: "XS", color: "Dark Blue", stock: 20, price: 69 },
            { size: "M", color: "Dark Blue", stock: 25, price: 69 },
            { size: "XL", color: "Dark Blue", stock: 30, price: 69 },
            { size: "M", color: "Light Blue", stock: 25, price: 69 },
            { size: "L", color: "Light Blue", stock: 15, price: 69 },
            { size: "2XL", color: "Light Blue", stock: 20, price: 69 },
        ],
    },
    {
        name: "Nike Air Max 270",
        vendorSlug: "sole-society",
        description: "The Nike Air Max 270 features a large Max Air unit in the heel for cushioning and comfort. Perfect for everyday wear.",
        basePrice: 150,
        discountPrice: 120,
        stockQuantity: 150,
        isFeatured: true,
        gender: prisma_client_1.Gender.UNISEX,
        brand: "Nike",
        categorySlug: "sneakers",
        images: [
            {
                url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=60",
                altText: "Red Nike Air Max sneaker on a plain background",
                isMain: true,
            },
            {
                url: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=60",
                altText: "Pair of Nike sneakers side by side",
            },
            {
                url: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=60",
                altText: "Nike sneaker photographed from above",
            },
        ],
        variants: [
            { size: "8", color: "Black", stock: 20, price: 120 },
            { size: "9", color: "Black", stock: 25, price: 120 },
            { size: "10", color: "Black", stock: 30, price: 120 },
            { size: "9", color: "Red", stock: 10, price: 125 },
            { size: "10", color: "Red", stock: 10, price: 125 },
            { size: "8", color: "White", stock: 15, price: 120 },
            { size: "9", color: "White", stock: 20, price: 120 },
            { size: "10", color: "White", stock: 20, price: 120 },
        ],
    },
    {
        name: "Adidas Ultraboost 23 Running Shoes",
        vendorSlug: "sole-society",
        description: "Energy-returning Boost cushioning. Adaptive Primeknit+ upper. Continental rubber outsole for superior grip. Perfect for running and everyday training.",
        basePrice: 190,
        stockQuantity: 180,
        gender: prisma_client_1.Gender.UNISEX,
        brand: "Adidas",
        categorySlug: "sneakers",
        images: [
            {
                url: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&auto=format&fit=crop&q=60",
                altText: "Adidas Ultraboost running shoe",
                isMain: true,
            },
            {
                url: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&auto=format&fit=crop&q=60",
                altText: "Running shoes on a concrete floor",
            },
        ],
        variants: [
            { size: "8", color: "Cloud White", stock: 15, price: 190 },
            { size: "9", color: "Cloud White", stock: 20, price: 190 },
            { size: "10", color: "Cloud White", stock: 15, price: 190 },
            { size: "8", color: "Core Black", stock: 20, price: 190 },
            { size: "9", color: "Core Black", stock: 25, price: 190 },
            { size: "10", color: "Core Black", stock: 20, price: 190 },
            { size: "9", color: "Solar Red", stock: 15, price: 190 },
            { size: "10", color: "Solar Red", stock: 10, price: 190 },
        ],
    },
    {
        name: "Classic T-Shirt",
        vendorSlug: "trendora-official",
        description: "A midweight cotton tee with a clean crew neck and a relaxed fit that holds its shape after washing. The staple layer for everything else in the wardrobe.",
        basePrice: 90.99,
        discountPrice: 80,
        stockQuantity: 118,
        gender: prisma_client_1.Gender.UNISEX,
        brand: "Trendora Basics",
        categorySlug: "t-shirts",
        images: [
            {
                url: "https://images.unsplash.com/photo-1621951753015-740c699ab970?w=800&auto=format&fit=crop&q=60",
                altText: "Plain white t-shirt on a hanger",
                isMain: true,
            },
            {
                url: "https://images.unsplash.com/photo-1714070700737-24acfe6b957c?w=800&auto=format&fit=crop&q=60",
                altText: "Folded cotton t-shirts",
            },
        ],
        variants: [
            { size: "M", color: "Red", stock: 80, price: 97.5 },
            { size: "L", color: "White", stock: 50, price: 90.99 },
            { size: "XL", color: "Gray", stock: 20, price: 110.7 },
        ],
    },
];
/** Dev credentials only — every account below shares SEED_PASSWORD. */
exports.users = [
    {
        name: "Trendora Admin",
        email: "admin@trendora.test",
        phone: "+8801700000001",
        role: prisma_client_1.Role.ADMIN,
    },
    {
        name: "Test Customer",
        email: "customer@trendora.test",
        phone: "+8801700000002",
        role: prisma_client_1.Role.CUSTOMER,
    },
    {
        name: "Ayesha Rahman",
        email: "vendor1@trendora.test",
        phone: "+8801700000003",
        role: prisma_client_1.Role.VENDOR,
    },
    {
        name: "Rafiq Islam",
        email: "vendor2@trendora.test",
        phone: "+8801700000004",
        role: prisma_client_1.Role.VENDOR,
    },
];
/**
 * Seeded storefronts.
 *
 * `trendora-official` is the store the multi-vendor migration created for the
 * pre-marketplace catalogue — it is upserted here so a fresh database matches
 * a migrated one. The other two exercise the parts of the system that only
 * appear with several sellers: per-vendor shipping thresholds, a cart that
 * splits across stores, and differing commission rates.
 *
 * `pending-store` stays PENDING on purpose so the admin moderation queue is
 * never empty in development.
 */
exports.vendors = [
    {
        storeName: "Trendora Official",
        slug: "trendora-official",
        ownerEmail: "admin@trendora.test",
        description: "The platform's own store. Holds every product that existed before Trendora became a marketplace.",
        businessEmail: "store@trendora.test",
        businessPhone: "+8801700000001",
        status: prisma_client_1.VendorStatus.APPROVED,
        commissionRate: 0,
        shippingFee: 100,
        freeShippingThreshold: 1000,
    },
    {
        storeName: "Urban Threads",
        slug: "urban-threads",
        ownerEmail: "vendor1@trendora.test",
        description: "Denim and everyday essentials, cut for real life. Family-run since 2014 and still packing every order by hand.",
        businessEmail: "hello@urbanthreads.test",
        businessPhone: "+8801700000003",
        status: prisma_client_1.VendorStatus.APPROVED,
        commissionRate: 0.1,
        shippingFee: 80,
        freeShippingThreshold: 800,
    },
    {
        storeName: "Sole Society",
        slug: "sole-society",
        ownerEmail: "vendor2@trendora.test",
        description: "Performance running and lifestyle sneakers, fitted properly. Free delivery once you cross a pair and a half.",
        businessEmail: "hello@solesociety.test",
        businessPhone: "+8801700000004",
        status: prisma_client_1.VendorStatus.APPROVED,
        // A negotiated rate — proof that commission is per store, not global.
        commissionRate: 0.12,
        shippingFee: 150,
        freeShippingThreshold: 2000,
    },
];
exports.slides = [
    {
        title: "New season denim",
        subtitle: "Levi's 501 and more, now up to 25% off",
        photoUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=1600&auto=format&fit=crop&q=60",
        url: "/categories/jeans",
        sortOrder: 1,
    },
    {
        title: "Built to run",
        subtitle: "Ultraboost and Air Max, ready when you are",
        photoUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=1600&auto=format&fit=crop&q=60",
        url: "/categories/sneakers",
        sortOrder: 2,
    },
    {
        title: "Everyday basics",
        subtitle: "The tees you reach for first",
        photoUrl: "https://images.unsplash.com/photo-1621951753015-740c699ab970?w=1600&auto=format&fit=crop&q=60",
        url: "/categories/t-shirts",
        sortOrder: 3,
    },
];
