"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routesArray = void 0;
const address_route_1 = require("../modules/address/address.route.js");
const auth_route_1 = require("../modules/auth/auth.route.js");
const brand_route_1 = require("../modules/brand/brand.route.js");
const category_route_1 = require("../modules/category/category.route.js");
const cloudinary_route_1 = require("../modules/cloudinary/cloudinary.route.js");
const order_route_1 = require("../modules/order/order.route.js");
const payout_route_1 = require("../modules/payout/payout.route.js");
const image_route_1 = require("../modules/product-image/image.route.js");
const variant_route_1 = require("../modules/product-variant/variant.route.js");
const product_route_1 = require("../modules/product/product.route.js");
const refund_route_1 = require("../modules/refund/refund.route.js");
const review_route_1 = require("../modules/review/review.route.js");
const size_group_route_1 = require("../modules/size-group/size-group.route.js");
const size_route_1 = require("../modules/size/size.route.js");
const slide_route_1 = require("../modules/slide/slide.route.js");
const user_route_1 = require("../modules/user/user.route.js");
const vendor_review_route_1 = require("../modules/vendor-review/vendor-review.route.js");
const vendor_route_1 = require("../modules/vendor/vendor.route.js");
const wishlist_route_1 = require("../modules/wishlist/wishlist.route.js");
exports.routesArray = [
    { path: "/auth", element: auth_route_1.authRouter },
    { path: "/users", element: user_route_1.userRouter },
    { path: "/categories", element: category_route_1.categoryRouter },
    { path: "/brands", element: brand_route_1.brandRouter },
    { path: "/products", element: product_route_1.productRouter },
    { path: "/products", element: variant_route_1.variantRouter },
    { path: "/products", element: image_route_1.productImageRouter },
    { path: "/wishlists", element: wishlist_route_1.wishlistRouter },
    { path: "/reviews", element: review_route_1.reviewRouter },
    { path: "/address", element: address_route_1.addressRouter },
    { path: "/orders", element: order_route_1.orderRouter },
    // NOTE: the Stripe webhook is deliberately NOT registered here. It is
    // mounted at /webhook in app.ts, above express.json(), because signature
    // verification needs the raw body. Registering it under /api/v1 would
    // expose a second path whose body is already JSON-parsed, so every
    // signature check on it would fail.
    { path: "/size-groups", element: size_group_route_1.sizeGroupRouter },
    { path: "/sizes", element: size_route_1.sizeRouter },
    { path: "/cloudinary", element: cloudinary_route_1.cloudinaryRouter },
    // marketplace — stores, store ratings and vendor settlements
    { path: "/vendors", element: vendor_route_1.vendorRouter },
    { path: "/vendor-reviews", element: vendor_review_route_1.vendorReviewRouter },
    { path: "/payouts", element: payout_route_1.payoutRouter },
    { path: "/refunds", element: refund_route_1.refundRouter },
    // slide -> for showing slider data in frontend
    { path: "/slides", element: slide_route_1.slideRouter },
];
