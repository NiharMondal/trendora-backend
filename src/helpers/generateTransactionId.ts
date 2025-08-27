export const generateTransactionId = (prefix: string = "pi") => {
	const randomStr = Array.from(crypto.getRandomValues(new Uint8Array(16)))
		.map((b) => b.toString(36))
		.join("")
		.slice(0, 22);
	return `${prefix}_${randomStr}`;
};
