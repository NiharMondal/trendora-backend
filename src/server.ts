/* eslint-disable no-console */
import app from "./app";
import { envConfig } from "./config/env-config";
import { startScheduler } from "./scheduler";

function main() {
    app.listen(envConfig.port, () => {
        console.log("Server is running on port " + envConfig.port);
        console.log("Database connected")

        // Started after the server is listening, so a slow first sweep never
        // delays the port opening (a container health check would fail).
        startScheduler();
    });
}
main();
