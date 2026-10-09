import bcrypt from "bcrypt";
import { UserModel } from "../users/user.model.js";
import type { User } from "../users/user.types.js";
import { AppError } from "../../middlewares/app-error.js";

const toUser = (user: {
  _id: unknown;
  name: string;
  email: string;
  role: User["role"];
  createdAt: Date;
  updatedAt: Date;
}): User => {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

export const registerUser = async (
  name: string,
  email: string,
  password: string
): Promise<User> => {
  const existingUser = await UserModel.findOne({
    email
  });

 if (existingUser) {
  throw new AppError(
    "Email is already registered",
    409
  );
}

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await UserModel.create({
    name,
    email,
    password: hashedPassword
  });

  return toUser(user);
};