import { Router } from "express";
import { reviewControllers } from "./review.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { reviewValidation } from "./review.validation";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router.get(
	"/my-reviews",
	authGuard(Role.CUSTOMER),
	reviewControllers.findByUserId
);

router
	.route("/:id")
	.get(reviewControllers.findById)
	.patch(
		validateRequest(reviewValidation.updateReview),
		reviewControllers.updateData
	)
	.delete(reviewControllers.deleteData);

router
	.route("/")
	.post(
		validateRequest(reviewValidation.createReview),
		reviewControllers.createIntoDB
	)
	.get(reviewControllers.findAllFromDB);

export const reviewRouter = router;
