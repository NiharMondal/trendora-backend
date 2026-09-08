"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routesArray = void 0;
const address_route_1 = require("../modules/address/address.route");
const auth_route_1 = require("../modules/auth/auth.route");
const brand_route_1 = require("../modules/brand/brand.route");
const category_route_1 = require("../modules/category/category.route");
const cloudinary_route_1 = require("../modules/cloudinary/cloudinary.route");
const order_route_1 = require("../modules/order/order.route");
const payment_route_1 = require("../modules/payment/payment.route");
const payout_route_1 = require("../modules/payout/payout.route");
const image_route_1 = require("../modules/product-image/image.route");
const variant_route_1 = require("../modules/product-variant/variant.route");
const product_route_1 = require("../modules/product/product.route");
const review_route_1 = require("../modules/review/review.route");
const size_group_route_1 = require("../modules/size-group/size-group.route");
const size_route_1 = require("../modules/size/size.route");
const slide_route_1 = require("../modules/slide/slide.route");
const user_route_1 = require("../modules/user/user.route");
const vendor_review_route_1 = require("../modules/vendor-review/vendor-review.route");
const vendor_route_1 = require("../modules/vendor/vendor.route");
const wishlist_route_1 = require("../modules/wishlist/wishlist.route");
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
    { path: "/payments", element: payment_route_1.paymentRouter },
    { path: "/size-groups", element: size_group_route_1.sizeGroupRouter },
    { path: "/sizes", element: size_route_1.sizeRouter },
    { path: "/cloudinary", element: cloudinary_route_1.cloudinaryRouter },
    // marketplace — stores, store ratings and vendor settlements
    { path: "/vendors", element: vendor_route_1.vendorRouter },
    { path: "/vendor-reviews", element: vendor_review_route_1.vendorReviewRouter },
    { path: "/payouts", element: payout_route_1.payoutRouter },
    // slide -> for showing slider data in frontend
    { path: "/slides", element: slide_route_1.slideRouter },
];
