"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.comparePassword = exports.makePasswordHash = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const makePasswordHash = async (pass) => {
    const hashPass = await bcrypt_1.default.hash(pass, 10);
    return hashPass;
};
exports.makePasswordHash = makePasswordHash;
const comparePassword = async (newPass, oldPass) => {
    const isValid = await bcrypt_1.default.compare(newPass, oldPass);
    return isValid;
};
exports.comparePassword = comparePassword;
