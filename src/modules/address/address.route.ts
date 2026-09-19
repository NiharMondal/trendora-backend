import { Router } from "express";
import { addressControllers } from "./address.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { addressSchema } from "./address.validation";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router.get(
    "/my-address",
    // A VENDOR is also a shopper — every buyer-facing route accepts all three
    // roles, otherwise approving a seller would break their own checkout.
    authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
    addressControllers.findMyAddress
);

router
    .route("/:id")
    .get(
        authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
        addressControllers.findById,
    )
    .patch(
        authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
        validateRequest(addressSchema),
        addressControllers.updateData,
    )
    .delete(
        authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
        addressControllers.deleteData,
    );

router
    .route("/")
    .get(authGuard(Role.ADMIN), addressControllers.findAllFromDB)
    .post(
        authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
        validateRequest(addressSchema),
        addressControllers.createIntoDB
    );

export const addressRouter = router;
