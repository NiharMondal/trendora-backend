"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.envConfig = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), ".env") });
exports.envConfig = {
    node_env: process.env.NODE_ENV,
    port: 5000,
    db_url: process.env.DATABASE_URL,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
    front_end_url: process.env.FRONT_END_URL,
    cloudinary: {
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.API_KEY,
        api_secret: process.env.API_SECRET,
    },
    emailUtils: {
        email: process.env.EMAIL,
        password: process.env.PASSWORD,
    },
};
