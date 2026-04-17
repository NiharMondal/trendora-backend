export interface IAuth {
	name: string;
	email: string;
	password: string;
}

export interface IOAuth {
	name: string;
	email: string;
	provider: string;
	providerId: string;
	avatar?: string;
}

export interface IChangePassword  {
	oldPassword: string;
	newPassword: string;
}