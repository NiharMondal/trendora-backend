export interface IAuth {
	name: string;
	email: string;
	password: string;
}

export interface IOAuth {
	name: string;
	email: string;
	provider: "GOOGLE" | "FACEBOOK";
	providerId: string;
	avatar?: string;
}
