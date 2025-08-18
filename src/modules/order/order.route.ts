import { Router } from "express";
import { orderControllers } from "./order.controller";

const router = Router();

router.post("/", orderControllers.createOrder);

export const orderRouter = router;
