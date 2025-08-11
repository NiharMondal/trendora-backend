import { Router } from "express";
import { routesArray } from "./routes-array";

const router = Router();

routesArray.forEach((item) => router.use(item.path, item.element));

export const rootRouter = router;
