"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routesArray = void 0;
const address_route_1 = require("../modules/address/address.route");
const auth_route_1 = require("../modules/auth/auth.route");
const category_route_1 = require("../modules/category/category.route");
const order_route_1 = require("../modules/order/order.route");
const variant_route_1 = require("../modules/product-variant/variant.route");
const product_route_1 = require("../modules/product/product.route");
const review_route_1 = require("../modules/review/review.route");
const user_route_1 = require("../modules/user/user.route");
const wishlist_route_1 = require("../modules/wishlist/wishlist.route");
exports.routesArray = [
    { path: "/auth", element: auth_route_1.authRouter },
    { path: "/users", element: user_route_1.userRouter },
    { path: "/categories", element: category_route_1.categoryRouter },
    { path: "/products", element: product_route_1.productRouter },
    { path: "/products", element: variant_route_1.variantRouter },
    { path: "/wishlists", element: wishlist_route_1.wishlistRouter },
    { path: "/reviews", element: review_route_1.reviewRouter },
    { path: "/address", element: address_route_1.addressRouter },
    { path: "/orders", element: order_route_1.orderRouter },
];
