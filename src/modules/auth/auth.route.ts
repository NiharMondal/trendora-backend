import { Router } from "express";
import { authControllers } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { authSchema } from "./auth.validation";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router.post(
    "/register",
    validateRequest(authSchema.registerUser),
    authControllers.registerUser
);

router.post(
    "/login",
    validateRequest(authSchema.login),
    authControllers.loginUser
);

router.post(
    "/oauth-login",
    validateRequest(authSchema.oauthLogin),
    authControllers.oAuthLogin
);
router.post(
    "/change-password",
    authGuard(Role.CUSTOMER, Role.ADMIN),
    validateRequest(authSchema.changePassword),
    authControllers.changePassword
);

export const authRouter = router;
