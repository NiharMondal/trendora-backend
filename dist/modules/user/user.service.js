"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userServices = void 0;
const db_1 = require("../../config/db");
const getAllFromDB = async () => {
    const users = db_1.prisma.user.findMany();
    return users;
};
exports.userServices = { getAllFromDB };
