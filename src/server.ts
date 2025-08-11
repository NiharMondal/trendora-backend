import app from "./app";
import { envConfig } from "./config/env-config";

function main() {
	app.listen(envConfig.port, () => {
		console.log("Server is running on port " + envConfig.port);
	});
}

main();
