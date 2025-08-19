"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const generateAccessToken = (payload, secret) => {
    const token = jsonwebtoken_1.default.sign(payload, secret, { expiresIn: "2d" });
    return token;
};
exports.generateAccessToken = generateAccessToken;
