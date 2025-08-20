import { Router } from "express";
import { orderControllers } from "./order.controller";

const router = Router();

router.patch("/:orderId/status", orderControllers.markOrderStatus);
router.post("/", orderControllers.createOrder);

export const orderRouter = router;
