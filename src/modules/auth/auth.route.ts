import { Router } from "express";
import { authControllers } from "./auth.controller";

const router = Router();

router.post("/register", authControllers.registerUser);
router.post("/login", authControllers.loginUser);

export const authRouter = router;
