export type UserRole =
  | "ADMIN"
  | "PROJECT_MANAGER"
  | "MEMBER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}