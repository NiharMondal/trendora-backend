"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.addressSchema = zod_1.default.object({
    fullName: zod_1.default.string({ error: "Name is required" }).trim(),
    email: zod_1.default.email().trim(),
    phone: zod_1.default.string({ error: "Phone number is required" }).trim(),
    street: zod_1.default.string({ error: "Street is required" }).trim(),
    city: zod_1.default.string({ error: "City name is required" }).trim(),
    state: zod_1.default.string().trim().optional(),
    postalCode: zod_1.default.string({ error: "Postal code is required" }).trim(),
    country: zod_1.default.string({ error: "Country name is required" }).trim(),
    isDefault: zod_1.default.boolean().optional()
});
