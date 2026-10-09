import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { login, register } from "./auth.controller.js";
const router = Router();
router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
export default router;
//# sourceMappingURL=auth.routes.js.map