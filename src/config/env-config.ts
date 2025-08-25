import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export const envConfig = {
	node_env: process.env.NODE_ENV,
	port: 5000,
	db_url: process.env.DATABASE_URL,
	access_token_secret: process.env.ACCESS_TOKEN_SECRET,
	front_end_url: process.env.FRONTEND_URL,
	stripe_secret_key: process.env.STRIPE_SECRET_KEY,
	stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
	ssl: {
		api: process.env.SSL_COMMERZ_API,
		storeId: process.env.SSL_STORE_ID,
		storePass: process.env.SSL_STORE_PASSWORD,
	},
	cloudinary: {
		cloud_name: process.env.CLOUD_NAME,
		api_key: process.env.API_KEY,
		api_secret: process.env.API_SECRET,
	},
	emailUtils: {
		email: process.env.EMAIL,
		password: process.env.PASSWORD,
	},
};
