import { Request, Response } from "express";

import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";

import { productImageServices } from "./image.service";

/** The authenticated caller, in the shape the vendor scoping helpers expect. */
const actorOf = (req: Request) => ({
	id: req.user.id as string,
	role: req.user.role as string,
});

/**
 * Adding or removing imagery re-opens moderation on an approved listing, so say
 * so — otherwise a vendor watches their live product quietly drop back to
 * Pending with no explanation.
 */
const reviewNotice = (sentBackForReview: boolean) =>
	sentBackForReview
		? " Your listing has gone back for review because its images changed."
		: "";

const findByProductId = asyncHandler(async (req: Request, res: Response) => {
	const productId = req.params.productId;

	const data = await productImageServices.findByProductId(productId);

	sendResponse(res, {
		statusCode: 200,
		message: "Product images fetched successfully",
		data: data,
	});
});

const addImages = asyncHandler(async (req: Request, res: Response) => {
	const { images, sentBackForReview } = await productImageServices.addImages(
		actorOf(req),
		req.params.productId,
		req.body,
	);

	sendResponse(res, {
		statusCode: 201,
		message: `Images added successfully.${reviewNotice(sentBackForReview)}`,
		data: images,
	});
});

const updateImage = asyncHandler(async (req: Request, res: Response) => {
	const data = await productImageServices.updateImage(
		actorOf(req),
		req.params.productId,
		req.params.imageId,
		req.body,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Image updated successfully",
		data: data,
	});
});

const deleteImage = asyncHandler(async (req: Request, res: Response) => {
	const { images, sentBackForReview } =
		await productImageServices.deleteImage(
			actorOf(req),
			req.params.productId,
			req.params.imageId,
		);

	sendResponse(res, {
		statusCode: 200,
		message: `Image removed successfully.${reviewNotice(sentBackForReview)}`,
		data: images,
	});
});

export const productImageController = {
	findByProductId,
	addImages,
	updateImage,
	deleteImage,
};
