import { addressRouter } from "../modules/address/address.route";
import { authRouter } from "../modules/auth/auth.route";
import { brandRouter } from "../modules/brand/brand.route";
import { categoryRouter } from "../modules/category/category.route";
import { orderRouter } from "../modules/order/order.route";
import { paymentRouter } from "../modules/payment/payment.route";
import { productImageRouter } from "../modules/product-image/image.route";
import { variantRouter } from "../modules/product-variant/variant.route";
import { productRouter } from "../modules/product/product.route";
import { reviewRouter } from "../modules/review/review.route";
import { userRouter } from "../modules/user/user.route";
import { wishlistRouter } from "../modules/wishlist/wishlist.route";

export const routesArray = [
    { path: "/auth", element: authRouter },
    { path: "/users", element: userRouter },
    { path: "/categories", element: categoryRouter },
    { path: "/brands", element: brandRouter },
    { path: "/products", element: productRouter },
    { path: "/products", element: variantRouter },
    { path: "/products", element: productImageRouter },
    { path: "/wishlists", element: wishlistRouter },
    { path: "/reviews", element: reviewRouter },
    { path: "/address", element: addressRouter },
    { path: "/orders", element: orderRouter },
    { path: "/payments", element: paymentRouter },
];
