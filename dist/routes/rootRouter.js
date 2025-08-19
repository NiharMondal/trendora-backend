"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const routes_array_1 = require("./routes-array");
const rootRouter = (0, express_1.Router)();
routes_array_1.routesArray.forEach((item) => rootRouter.use(item.path, item.element));
exports.default = rootRouter;
