import { Router } from "express";
import { orderControllers } from "./order.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { orderValidation } from "./order.validation";

const router = Router();

router.patch(
	"/:orderId/status",
	validateRequest(orderValidation.updateOrderStatusSchema),
	orderControllers.markOrderStatus
);

router
	.route("/")
	.post(
		validateRequest(orderValidation.createOrderSchema),
		orderControllers.createOrder
	)
	.get(orderControllers.findAllFromDB);

export const orderRouter = router;
