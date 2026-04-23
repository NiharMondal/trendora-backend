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
	orderControllers.updateOrderStatus,
);

router.get(
	"/my-orders",
	authGuard(Role.CUSTOMER),
	orderControllers.getMyOrders,
);
router.route("/:orderId").get(orderControllers.getOrderById);
router
	.route("/")
	.post(
		authGuard(Role.CUSTOMER),
		validateRequest(orderValidation.createOrderSchema),
		orderControllers.createOrder,
	)
	.get(orderControllers.findAllFromDB);

export const orderRouter = router;
