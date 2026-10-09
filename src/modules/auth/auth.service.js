import bcrypt from "bcrypt";
import { UserModel } from "../users/user.model.js";
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
        throw new Error("Email is already registered");
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create({
        name,
        email,
        password: hashedPassword
    });
    return toUser(user);
};
//# sourceMappingURL=auth.service.js.map