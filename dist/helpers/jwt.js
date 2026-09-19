"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const generateAccessToken = (payload, secret) => {
    const token = jsonwebtoken_1.default.sign(payload, secret, { expiresIn: "20m" });
    return token;
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload, secret) => {
    const token = jsonwebtoken_1.default.sign(payload, secret, { expiresIn: "30d" });
    return token;
};
exports.generateRefreshToken = generateRefreshToken;
