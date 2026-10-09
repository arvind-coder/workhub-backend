import bcrypt from "bcrypt";
import { UserModel } from "../users/user.model.js";
import type { User } from "../users/user.types.js";
import { AppError } from "../../middlewares/app-error.js";
import { generateAccessToken } from "../../utils/jwt.js";

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

export const loginUser = async (
  email: string,
  password: string
): Promise<{ user: User; accessToken: string }> => {
  const userDocument = await UserModel.findOne({
    email
  }).select("+password");

  if (!userDocument) {
    throw new AppError(
      "Invalid email or password",
      401
    );
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    userDocument.password
  );

  if (!isPasswordValid) {
    throw new AppError(
      "Invalid email or password",
      401
    );
  }

  const user = toUser(userDocument);

  const accessToken = generateAccessToken(
    user.id,
    user.role
  );

  return {
    user,
    accessToken
  };
};