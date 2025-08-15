import { Router } from "express";
import { addressControllers } from "./address.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { addressValidation } from "./address.validation";

const router = Router();

router.get("/my-address", addressControllers.findAddressByUserId);

router
	.route("/:id")
	.get(addressControllers.findById)
	.patch(addressControllers.updateData)
	.delete(addressControllers.deleteData);

router
	.route("/")
	.post(
		validateRequest(addressValidation.createAddress),
		addressControllers.createIntoDB
	);

export const addressRouter = router;
