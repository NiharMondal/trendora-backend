import { Router } from "express";
import { routesArray } from "./routes-array";

const rootRouter = Router();

routesArray.forEach((item) => rootRouter.use(item.path, item.element));

export default rootRouter;
