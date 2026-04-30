import jwt from "jsonwebtoken";

export const generateAccessToken = (payload: object, secret: string):string => {
	const token = jwt.sign(payload, secret, { expiresIn: "15m" });

	return token;
};
export const generateRefreshToken = (payload: object, secret: string):string => {
	const token = jwt.sign(payload, secret, { expiresIn: "30d" });

	return token;
};
