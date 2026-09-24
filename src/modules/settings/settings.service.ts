import { prisma } from "@/config/db";
import { envConfig } from "@/config/env-config";
import { toNumber } from "@/helpers/money";

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
        commissionRate: envConfig.platform_commission_rate,
        shippingFee: envConfig.shipping_cost,
        freeShippingThreshold: envConfig.free_shipping_threshold,
    };

    const [taxOverrides, stores] = await Promise.all([
        prisma.category.findMany({
            where: { isDeleted: false, taxRate: { not: null } },
            select: { id: true, name: true, taxRate: true },
            orderBy: { name: "asc" },
        }),
        prisma.vendor.findMany({
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
            commissionRate: toNumber(store.commissionRate),
            shippingFee: toNumber(store.shippingFee),
            freeShippingThreshold: toNumber(store.freeShippingThreshold),
        }))
        .filter(
            (store) =>
                store.commissionRate !== defaults.commissionRate ||
                store.shippingFee !== defaults.shippingFee ||
                store.freeShippingThreshold !== defaults.freeShippingThreshold,
        );

    return {
        pricing: {
            /** The platform tax rate, used for any category without its own. */
            taxRate: envConfig.tax_rate,
            /** Stamped onto a store when it is created; each store keeps its own after. */
            newStoreDefaults: defaults,
        },
        checkout: {
            checkoutSessionTtlMinutes: envConfig.checkout_session_ttl_minutes,
        },
        features: {
            stripePayments: Boolean(envConfig.stripe_secret_key),
            stripeWebhook: Boolean(envConfig.stripe_webhook_secret),
            cloudinary: Boolean(
                envConfig.cloudinary.cloud_name && envConfig.cloudinary.api_secret,
            ),
            email: Boolean(envConfig.emailUtils.email && envConfig.emailUtils.password),
            scheduler: envConfig.scheduler_enabled,
        },
        overrides: {
            categoryTaxRates: taxOverrides.map((category) => ({
                id: category.id,
                name: category.name,
                taxRate: toNumber(category.taxRate),
            })),
            storeTerms: customTerms,
            totalStores: stores.length,
        },
    };
};

export const settingsServices = { getPlatformSettings };
