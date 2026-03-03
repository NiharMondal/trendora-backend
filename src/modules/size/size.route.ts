import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";

import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";
import { sizeControllers } from "./size.controller";
import { sizeSchema } from "./size.validation";

const router = Router();

router
	.route("/:id")
	.get(sizeControllers.findById)
	.patch(
		// authGuard(Role.ADMIN),
		validateRequest(sizeSchema),
		sizeControllers.updateData,
	)
	.delete(authGuard(Role.ADMIN), sizeControllers.deleteData);

router
	.route("/")
	.post(
		authGuard(Role.ADMIN),
		validateRequest(sizeSchema),
		sizeControllers.createIntoDB,
	)
	.get(sizeControllers.findAllFromDB);

export const sizeRouter = router;
