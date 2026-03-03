import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";

import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";
import { sizeGroupControllers } from "./size-group.controller";
import { sizeGroupSchema } from "./size-group.validation";

const router = Router();

router
	.route("/:id")
	.get(sizeGroupControllers.findById)
	.patch(authGuard(Role.ADMIN), sizeGroupControllers.updateData)
	.delete(sizeGroupControllers.deleteData);

router
	.route("/")
	.post(validateRequest(sizeGroupSchema), sizeGroupControllers.createIntoDB)
	.get(sizeGroupControllers.findAllFromDB);

export const sizeGroupRouter = router;
