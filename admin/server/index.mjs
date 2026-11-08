import { fileURLToPath } from "node:url";
import { createAdminServer } from "./app.mjs";
const server = createAdminServer({
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
  role: process.env.ADMIN_ROLE || "Super Admin",
  dataDir: fileURLToPath(new URL("../.data", import.meta.url)),
  secure: process.env.NODE_ENV === "production",
});
server.listen(Number(process.env.ADMIN_PORT || 3001), "127.0.0.1", () =>
  console.log("Admin API listening on loopback."),
);
