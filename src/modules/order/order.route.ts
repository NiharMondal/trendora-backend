import { Router } from "express";
import { orderControllers } from "./order.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { orderValidation } from "./order.validation";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router.patch(
	"/:orderId/status",
	validateRequest(orderValidation.updateOrderStatusSchema),
	orderControllers.markOrderStatus
);

router.get("/my-orders", authGuard(Role.CUSTOMER), orderControllers.getMyOrder);

router
	.route("/")
	.post(
		validateRequest(orderValidation.createOrderSchema),
		orderControllers.createOrder
	)
	.get(orderControllers.findAllFromDB);

export const orderRouter = router;
