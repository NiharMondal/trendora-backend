import { authRouter } from "../modules/auth/auth.route";
import { categoryRouter } from "../modules/category/category.route";
import { userRouter } from "../modules/user/user.route";

export const routesArray = [
	{ path: "/auth", element: authRouter },
	{ path: "/users", element: userRouter },
	{ path: "/categories", element: categoryRouter },
];
