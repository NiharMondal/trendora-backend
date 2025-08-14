import jwt from "jsonwebtoken";

export const generateAccessToken = (payload: object, secret: string) => {
	const token = jwt.sign(payload, secret, { expiresIn: "2d" });

	return token;
};
