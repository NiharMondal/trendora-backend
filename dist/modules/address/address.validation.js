"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressValidation = exports.updateAddress = void 0;
const zod_1 = __importDefault(require("zod"));
const createAddress = zod_1.default.object({
    userId: zod_1.default
        .string({ error: "User ID is required" })
        .nonempty({ error: "User ID can not be empty" }),
    fullName: zod_1.default.string({ error: "Name is required" }),
    phone: zod_1.default.string({ error: "Phone number is required" }),
    street: zod_1.default.string({ error: "Street is required" }),
    city: zod_1.default.string({ error: "City name is required" }),
    state: zod_1.default.string({ error: "State name is required" }).optional(),
    postalCode: zod_1.default.string({ error: "Postal code is required" }),
    country: zod_1.default.string({ error: "Country name is required" }),
});
exports.updateAddress = createAddress.partial();
exports.addressValidation = { createAddress, updateAddress: exports.updateAddress };
