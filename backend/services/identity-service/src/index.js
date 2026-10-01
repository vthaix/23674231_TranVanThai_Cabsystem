const express = require("express");
const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase } = require("./db/postgres");
const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const SERVICE_NAME = process.env.SERVICE_NAME || "identity-service";

registerHealthRoutes(app, SERVICE_NAME);
checkDatabase()
    .then(() => {
        console.log("identity-service database connected");
    })
    .catch((err) => {
        console.error("identity-service database connection failed:", err.message);
    });
app.listen(PORT, "0.0.0.0", () => {
    console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});