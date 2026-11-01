"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const app_1 = __importDefault(require("./app"));
const env_config_1 = require("./config/env-config");
const scheduler_1 = require("./scheduler");
function main() {
    app_1.default.listen(env_config_1.envConfig.port, () => {
        console.log("Server is running on port " + env_config_1.envConfig.port);
        console.log("Database connected");
        // Started after the server is listening, so a slow first sweep never
        // delays the port opening (a container health check would fail).
        (0, scheduler_1.startScheduler)();
    });
}
main();
