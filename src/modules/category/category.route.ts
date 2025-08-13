import { Router } from "express";
import { categoryControllers } from "./category.controller";

const router = Router();

router
	.route("/:id")
	.get(categoryControllers.findById)
	.patch(categoryControllers.updateData)
	.delete(categoryControllers.deleteData);

router
	.route("/")
	.post(categoryControllers.createIntoDB)
	.get(categoryControllers.findAllFromDB);

export const categoryRouter = router;
