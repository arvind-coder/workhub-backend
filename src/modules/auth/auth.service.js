import bcrypt from "bcrypt";
import { UserModel } from "../users/user.model.js";
import { AppError } from "../../middlewares/app-error.js";
import { generateAccessToken } from "../../utils/jwt.js";
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
    return {
        user,
        accessToken
    };
};
//# sourceMappingURL=auth.service.js.map