import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { login, logout, refresh, register } from "./auth.controller.js";
const router = Router();
router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
export default router;
//# sourceMappingURL=auth.routes.js.map