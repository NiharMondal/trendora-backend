import { Router } from "express";
import { authControllers } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { authSchema } from "./auth.validation";

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
    authControllers.oauthLogin
);

export const authRouter = router;
