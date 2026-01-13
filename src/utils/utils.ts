import { z } from "zod";

/** Common reusable validators */
export const uuidSchema = z.uuid({ version: "v4" });

export const decimalSchema = z
    .number()
    .positive()
    .refine((val) => Number(val.toFixed(2)) === val, {
        message: "Must have at most 2 decimal places",
    });

export const capitalizeFirstLetter = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1);
