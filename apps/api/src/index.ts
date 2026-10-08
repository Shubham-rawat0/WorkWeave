import {app} from "./app"
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });
const port=process.env.PORT
export default {
    port: port,
    fetch: app.fetch,
};