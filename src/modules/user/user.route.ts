import { Router } from "express";
import { userControllers } from "./user.controller";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router.get("/my-profile", authGuard(Role.ADMIN, Role.CUSTOMER), userControllers.myProfile)
router.get("/update-information", userControllers.updateData)
router.get("/", userControllers.getAllFromDB);

export const userRouter = router;
