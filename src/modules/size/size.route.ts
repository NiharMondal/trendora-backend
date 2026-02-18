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
	.patch(authGuard(Role.ADMIN), sizeControllers.updateData)
	.delete(sizeControllers.deleteData);

router
	.route("/")
	.post(validateRequest(sizeSchema), sizeControllers.createIntoDB)
	.get(sizeControllers.findAllFromDB);

export const sizeGroupRouter = router;
