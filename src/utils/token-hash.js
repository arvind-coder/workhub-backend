import { createHash } from "node:crypto";
export const hashToken = (token) => {
    return createHash("sha256")
        .update(token)
        .digest("hex");
};
//# sourceMappingURL=token-hash.js.map