import { Router } from "express";
import { orderControllers } from "./order.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { orderValidation } from "./order.validation";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

/**
 * Fulfilment is per VENDOR ORDER, so the status route targets a vendorOrderId.
 * The old `PATCH /orders/:orderId/status` is gone: with several vendors on one
 * order there is no single status to set, and it was unauthenticated.
 */

// -------------------------------------------------------------------- customer
router.get(
	"/my-orders",
	authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
	orderControllers.getMyOrders,
);

// ---------------------------------------------------------------------- vendor
router.get(
	"/vendor/my-orders",
	authGuard(Role.VENDOR, Role.ADMIN),
	orderControllers.getMyVendorOrders,
);

router.get(
	"/vendor/my-orders/:vendorOrderId",
	authGuard(Role.VENDOR, Role.ADMIN),
	orderControllers.getVendorOrderById,
);

router.patch(
	"/vendor-orders/:vendorOrderId/status",
	authGuard(Role.VENDOR, Role.ADMIN),
	validateRequest(orderValidation.updateVendorOrderStatusSchema),
	orderControllers.updateVendorOrderStatus,
);

// ----------------------------------------------------------------------- admin
router.get(
	"/analytics",
	authGuard(Role.ADMIN),
	orderControllers.getDashboardAnalytics,
);

// ------------------------------------------------------------------- shared
router
	.route("/:orderId")
	.get(
		// Authorisation is by relationship inside the service: the buyer, an
		// admin, or a vendor with a slice of this order.
		authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
		orderControllers.getOrderById,
	);

router
	.route("/")
	.post(
		authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
		validateRequest(orderValidation.createOrderSchema),
		orderControllers.createOrder,
	)
	.get(authGuard(Role.ADMIN), orderControllers.findAllFromDB);

export const orderRouter = router;
