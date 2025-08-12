import { Router } from "express";
import { categoryControllers } from "./category.controller";

const router = Router();

router
	.route("/")
	.post(categoryControllers.createIntoDB)
	.get(categoryControllers.findAllFromDB);

export const categoryRouter = router;
