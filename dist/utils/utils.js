"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalizeFirstLetter = exports.decimalSchema = void 0;
const zod_1 = require("zod");
/** Common reusable validators */
exports.decimalSchema = zod_1.z
    .number()
    .positive()
    .refine((val) => Number(val.toFixed(2)) === val, {
    message: "Must have at most 2 decimal places",
});
const capitalizeFirstLetter = (value) => value.charAt(0).toUpperCase() + value.slice(1);
exports.capitalizeFirstLetter = capitalizeFirstLetter;
