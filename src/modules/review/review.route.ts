import { Router } from "express";
import { reviewControllers } from "./review.controller";
import { validateRequest } from "@/middleware/validateRequest";
import { reviewValidation } from "./review.validation";
import { authGuard } from "@/middleware/authGuard";
import { Role } from "@/lib/prisma-client";

const router = Router();

const anySignedInUser = authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN);

router.get("/my-reviews", anySignedInUser, reviewControllers.findByUserId);
router.get(
	"/product/:productId",
	reviewControllers.findAllReviewsByProductId
);
router
	.route("/:id")
	.get(reviewControllers.findById)
	.patch(
		anySignedInUser,
		validateRequest(reviewValidation.updateReview),
		reviewControllers.updateData
	)
	.delete(anySignedInUser, reviewControllers.deleteData);

router
	.route("/")
	.post(
		// authGuard first: authenticate before spending work on validation.
		anySignedInUser,
		validateRequest(reviewValidation.createReview),
		reviewControllers.createIntoDB
	)
	.get(reviewControllers.findAllFromDB);

export const reviewRouter = router;
