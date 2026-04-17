import { Router } from "express";
import { addressControllers } from "./address.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { addressSchema } from "./address.validation";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router.get(
    "/my-address",
    authGuard(Role.CUSTOMER),
    addressControllers.findMyAddress
);

router
    .route("/:id")
    .get(addressControllers.findById)
    .patch(validateRequest(addressSchema), addressControllers.updateData)
    .delete(addressControllers.deleteData);

router
    .route("/")
    .get(addressControllers.findAllFromDB)
    .post(
        authGuard(Role.CUSTOMER),
        validateRequest(addressSchema),
        addressControllers.createIntoDB
    );

export const addressRouter = router;
