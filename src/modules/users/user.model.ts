import { Schema, model } from "mongoose";
import type { UserRole } from "./user.types.js";

interface UserDocument {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  refreshTokenHash?: string;
}

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },

    role: {
      type: String,
      enum: [
        "ADMIN",
        "PROJECT_MANAGER",
        "MEMBER"
      ],
      default: "MEMBER"
    },
    refreshTokenHash: {
      type: String,
      select: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({
  email: 1
});

export const UserModel = model<UserDocument>(
  "User",
  userSchema
);