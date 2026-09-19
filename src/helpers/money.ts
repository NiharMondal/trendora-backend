import { Prisma } from "../../generated/prisma";

/**
 * Money helpers.
 *
 * Prices are Prisma `Decimal` in the database but plain numbers in the pricing
 * pipeline, so every conversion funnels through here instead of scattering
 * `parseFloat(x.toString())` around. Every derived money value is rounded to
 * two decimals at the point it is computed — never at the end — so the stored
 * per-vendor amounts always sum to the stored order total to the cent.
 */

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/** Rounds to 2 decimal places, guarding the usual float-representation edge. */
export const round2 = (value: number): number =>
    Math.round((value + Number.EPSILON) * 100) / 100;

/** Prisma Decimal (or anything numeric-ish) -> number. Null/undefined -> 0. */
export const toNumber = (value: DecimalLike): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    return parseFloat(value.toString());
};

/** Sums a list of money values, rounding once at the end. */
export const sumMoney = (values: number[]): number =>
    round2(values.reduce((total, value) => total + value, 0));
