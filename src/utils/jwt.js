import jwt from "jsonwebtoken";
export const generateAccessToken = (userId, role) => {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is not configured");
    }
    const payload = {
        sub: userId,
        role
    };
    return jwt.sign(payload, secret, {
        expiresIn: "15m"
    });
};
//# sourceMappingURL=jwt.js.map