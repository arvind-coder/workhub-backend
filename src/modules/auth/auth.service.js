import bcrypt from "bcrypt";
import { UserModel } from "../users/user.model.js";
import { AppError } from "../../middlewares/app-error.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";
import { hashToken } from "../../utils/token-hash.js";
import jwt from "jsonwebtoken";
const toUser = (user) => {
    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
};
export const registerUser = async (name, email, password) => {
    const existingUser = await UserModel.findOne({
        email
    });
    if (existingUser) {
        throw new AppError("Email is already registered", 409);
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create({
        name,
        email,
        password: hashedPassword
    });
    return toUser(user);
};
export const loginUser = async (email, password) => {
    const userDocument = await UserModel.findOne({
        email
    }).select("+password");
    if (!userDocument) {
        throw new AppError("Invalid email or password", 401);
    }
    const isPasswordValid = await bcrypt.compare(password, userDocument.password);
    if (!isPasswordValid) {
        throw new AppError("Invalid email or password", 401);
    }
    const user = toUser(userDocument);
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);
    userDocument.refreshTokenHash = hashToken(refreshToken);
    await userDocument.save();
    return {
        user,
        accessToken,
        refreshToken
    };
};
export const refreshUserTokens = async (refreshToken) => {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not configured");
    }
    let decoded;
    try {
        const payload = jwt.verify(refreshToken, secret);
        if (typeof payload === "string" ||
            typeof payload.sub !== "string" ||
            !payload.sub) {
            throw new AppError("Invalid refresh token", 401);
        }
        decoded = payload;
    }
    catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError("Invalid or expired refresh token", 401);
    }
    const userDocument = await UserModel.findById(decoded.sub).select("+refreshTokenHash");
    if (!userDocument ||
        !userDocument.refreshTokenHash ||
        userDocument.refreshTokenHash !== hashToken(refreshToken)) {
        throw new AppError("Invalid or revoked refresh token", 401);
    }
    const user = toUser(userDocument);
    const newAccessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id, user.role);
    userDocument.refreshTokenHash = hashToken(newRefreshToken);
    await userDocument.save();
    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
    };
};
export const logoutUser = async (refreshToken) => {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not configured");
    }
    let decoded;
    try {
        const payload = jwt.verify(refreshToken, secret);
        if (typeof payload === "string" ||
            typeof payload.sub !== "string" ||
            !payload.sub) {
            throw new AppError("Invalid refresh token", 401);
        }
        decoded = payload;
    }
    catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError("Invalid or expired refresh token", 401);
    }
    const result = await UserModel.updateOne({
        _id: decoded.sub,
        refreshTokenHash: hashToken(refreshToken)
    }, {
        $unset: {
            refreshTokenHash: 1
        }
    });
    if (result.modifiedCount === 0) {
        throw new AppError("Invalid or revoked refresh token", 401);
    }
};
//# sourceMappingURL=auth.service.js.map