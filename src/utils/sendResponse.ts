import { Response } from "express";
type TMeta = {
	currentPage: number;
	totalPages: number;
	totalDocs: number;
};
type TResponseData<T> = {
	statusCode: number;
	message: string;
	meta?: TMeta;
	data: T;
};
export const sendResponse = <T>(res: Response, obj: TResponseData<T>) => {
	res.status(obj.statusCode).json({
		success: true,
		message: obj.message,
		meta: obj.meta,
		result: obj.data,
	});
};
