import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { register } from "./auth.controller.js";
const router = Router();
router.post("/register", asyncHandler(register));
export default router;
//# sourceMappingURL=auth.routes.js.map