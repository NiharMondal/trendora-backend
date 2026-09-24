"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsServices = void 0;
const db_1 = require("../../config/db.js");
const env_config_1 = require("../../config/env-config.js");
const money_1 = require("../../helpers/money.js");
/**
 * The platform configuration an operator needs to see, READ-ONLY.
 *
 * Every value here comes from the environment, so changing one is a deploy,
 * not a click. Several of them are duplicated on the frontend (`TAX_RATE` must
 * equal `NEXT_PUBLIC_TAX_RATE`), which is exactly why they are not editable at
 * runtime. The per-row overrides that ARE editable (a category's tax rate, a
 * store's commercial terms) are summarised so the defaults are never read as
 * the whole story.
 *
 * No secret is returned: features are reported as on/off only.
 */
const getPlatformSettings = async () => {
    const defaults = {
        commissionRate: env_config_1.envConfig.platform_commission_rate,
        shippingFee: env_config_1.envConfig.shipping_cost,
        freeShippingThreshold: env_config_1.envConfig.free_shipping_threshold,
    };
    const [taxOverrides, stores] = await Promise.all([
        db_1.prisma.category.findMany({
            where: { isDeleted: false, taxRate: { not: null } },
            select: { id: true, name: true, taxRate: true },
            orderBy: { name: "asc" },
        }),
        db_1.prisma.vendor.findMany({
            where: { isDeleted: false },
            select: {
                id: true,
                storeName: true,
                status: true,
                commissionRate: true,
                shippingFee: true,
                freeShippingThreshold: true,
            },
            orderBy: { storeName: "asc" },
        }),
    ]);
    // A store whose terms were tuned away from the platform defaults.
    const customTerms = stores
        .map((store) => ({
        id: store.id,
        storeName: store.storeName,
        status: store.status,
        commissionRate: (0, money_1.toNumber)(store.commissionRate),
        shippingFee: (0, money_1.toNumber)(store.shippingFee),
        freeShippingThreshold: (0, money_1.toNumber)(store.freeShippingThreshold),
    }))
        .filter((store) => store.commissionRate !== defaults.commissionRate ||
        store.shippingFee !== defaults.shippingFee ||
        store.freeShippingThreshold !== defaults.freeShippingThreshold);
    return {
        pricing: {
            /** The platform tax rate, used for any category without its own. */
            taxRate: env_config_1.envConfig.tax_rate,
            /** Stamped onto a store when it is created; each store keeps its own after. */
            newStoreDefaults: defaults,
        },
        checkout: {
            checkoutSessionTtlMinutes: env_config_1.envConfig.checkout_session_ttl_minutes,
        },
        features: {
            stripePayments: Boolean(env_config_1.envConfig.stripe_secret_key),
            stripeWebhook: Boolean(env_config_1.envConfig.stripe_webhook_secret),
            cloudinary: Boolean(env_config_1.envConfig.cloudinary.cloud_name && env_config_1.envConfig.cloudinary.api_secret),
            email: Boolean(env_config_1.envConfig.emailUtils.email && env_config_1.envConfig.emailUtils.password),
            scheduler: env_config_1.envConfig.scheduler_enabled,
        },
        overrides: {
            categoryTaxRates: taxOverrides.map((category) => ({
                id: category.id,
                name: category.name,
                taxRate: (0, money_1.toNumber)(category.taxRate),
            })),
            storeTerms: customTerms,
            totalStores: stores.length,
        },
    };
};
exports.settingsServices = { getPlatformSettings };
