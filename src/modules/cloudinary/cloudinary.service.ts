import { deleteFromCloudinary } from "@/utils/cloudinary";
import CustomError from "@/utils/customError";

import { TDeleteTemp } from "./cloudinary.validation";

/**
 * Where the frontend's unsigned uploads land: `uploadToCloudinary` posts
 * `folder: "trendora/<folder>"` and every staging caller passes `temp/...`,
 * so a staged asset's publicId always starts with this.
 */
const TEMP_PREFIX = "trendora/temp/";

/**
 * This endpoint is unauthenticated — `deleteTempImage` on the frontend is a raw
 * `fetch` that sends no token, so it cannot simply be guarded on one side (see
 * `docs/FEATURE-GAPS.md` BE-04). **The prefix check is therefore the only thing
 * protecting live imagery**, which is why it is anchored rather than a
 * substring match: `includes("/temp/")` would also accept
 * `trendora/products/temp/x`, a perfectly ordinary final publicId.
 *
 * It also follows that a save must never persist a publicId still under this
 * prefix — such an image is live on the storefront with its publicId readable
 * from the `<img src>`. `assertPromoted` in `helpers/product.ts` enforces that.
 */
const deleteTempImage = async ({ publicId }: TDeleteTemp) => {
    if (!publicId.startsWith(TEMP_PREFIX)) {
        throw new CustomError(400, "Not a temp image");
    }

    await deleteFromCloudinary(publicId);
};

export const cloudinaryServices = { deleteTempImage };
