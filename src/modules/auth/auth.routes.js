import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { getMe, login, logout, refresh, register } from "./auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
const router = Router();
router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", authMiddleware, asyncHandler(getMe));
export default router;
//# sourceMappingURL=auth.routes.js.map