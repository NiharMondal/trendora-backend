import { v2 as cloudinary } from 'cloudinary'
import { envConfig } from '../config/env-config'

cloudinary.config({
    cloud_name: envConfig.cloudinary.cloud_name,
    api_key: envConfig.cloudinary.api_key,
    api_secret: envConfig.cloudinary.api_secret
})

/**
 * Moves an image from temp folder to final folder.
 * Returns the new public_id and secure_url.
 */
export const moveFromTemp = async(tempPublicId:string): Promise<{ publicId: string; url: string }>=> {
    const finalPublicId = tempPublicId.replace("/temp", "/");

    const result = await cloudinary.uploader.rename(tempPublicId, finalPublicId, {
        overwrite:true
    });

    return {
        publicId: result?.public_id,
        url: result?.secure_url
    }
}

/**
 * Deletes an image by its public_id from Cloudinary.
 */
export const deleteFromCloudinary = async (publicId: string) => {
    return cloudinary.uploader.destroy(publicId);
};