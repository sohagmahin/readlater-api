import "dotenv/config";
import {z} from "zod";

const schema = z.object({
    PORT : z.coerce.number().default(3000),
});

export const env= schema.parse(process.env);