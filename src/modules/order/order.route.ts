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
<<<<<<< HEAD
	orderControllers.markOrderStatus,
=======
	orderControllers.updateOrderStatus,
>>>>>>> 700117cbff09cc7708b0fc0ce371162fab75ca3d
);

router.get(
	"/my-orders",
	authGuard(Role.CUSTOMER),
	orderControllers.getMyOrders,
);
<<<<<<< HEAD

=======
router.route("/:orderId").get(orderControllers.getOrderById);
>>>>>>> 700117cbff09cc7708b0fc0ce371162fab75ca3d
router
	.route("/")
	.post(
		validateRequest(orderValidation.createOrderSchema),
		orderControllers.createOrder,
	)
	.get(orderControllers.findAllFromDB);

export const orderRouter = router;
