"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const app_1 = __importDefault(require("./app"));
const env_config_1 = require("./config/env-config");
function main() {
    app_1.default.listen(env_config_1.envConfig.port, () => {
        console.log("Server is running on port " + env_config_1.envConfig.port);
        console.log("Database connected");
    });
}
main();
