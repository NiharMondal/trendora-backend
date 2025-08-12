import bcrypt from "bcrypt";

export const makePasswordHash = async (pass: string) => {
	const hashPass = await bcrypt.hash(pass, 10);
	return hashPass;
};
export const comparePassword = async (newPass: string, oldPass: string) => {
	const isValid = await bcrypt.compare(newPass, oldPass);
	return isValid;
};
