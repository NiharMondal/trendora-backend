import { Request, Response, Router } from "express";
import CustomError from "../../utils/customError";
import { deleteFromCloudinary } from "../../utils/cloudinary";

const router = Router();

router.post("/delete-temp", async (req: Request, res: Response) => {
    const { publicId } = req.body;

    if (!publicId.includes("/temp/")) {
        throw new CustomError(400, "Not a temp image")
    };

    await deleteFromCloudinary(publicId);

    return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Temp image deleted successfully",
    })
})


export const cloudinaryRouter = router;