import type { Hook } from "@hono/zod-validator";

export const validationHook: Hook<any, any, any> = (result) => {
    if (!result.success) {
        throw result.error;
    }
};
