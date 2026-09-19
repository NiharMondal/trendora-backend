"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromCloudinary = exports.moveFromTemp = void 0;
const cloudinary_1 = require("cloudinary");
const env_config_1 = require("../config/env-config");
cloudinary_1.v2.config({
    cloud_name: env_config_1.envConfig.cloudinary.cloud_name,
    api_key: env_config_1.envConfig.cloudinary.api_key,
    api_secret: env_config_1.envConfig.cloudinary.api_secret
});
/**
 * Moves an image from temp folder to final folder.
 * Returns the new public_id and secure_url.
 */
const moveFromTemp = async (tempPublicId) => {
    const finalPublicId = tempPublicId.replace("/temp", "/");
    const result = await cloudinary_1.v2.uploader.rename(tempPublicId, finalPublicId, {
        overwrite: true
    });
    return {
        publicId: result?.public_id,
        url: result?.secure_url
    };
};
exports.moveFromTemp = moveFromTemp;
/**
 * Deletes an image by its public_id from Cloudinary.
 */
const deleteFromCloudinary = async (publicId) => {
    return cloudinary_1.v2.uploader.destroy(publicId);
};
exports.deleteFromCloudinary = deleteFromCloudinary;
