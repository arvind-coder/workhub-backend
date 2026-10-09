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
export const generateRefreshToken = (userId, role) => {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not configured");
    }
    return jwt.sign({
        sub: userId,
        role
    }, secret, {
        expiresIn: "7d"
    });
};
//# sourceMappingURL=jwt.js.map