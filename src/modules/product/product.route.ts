import { Router } from "express";
import { productControllers } from "./product.controller";

const router = Router();

router.get("/by-slug/:slug", productControllers.findBySlug);

router
	.route("/:id")
	.get(productControllers.findById)
	.patch(productControllers.updateData)
	.delete(productControllers.deleteData);

router
	.route("/")
	.post(productControllers.createIntoDB)
	.get(productControllers.findAllFromDB);

export const productRouter = router;
