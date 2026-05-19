import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

/**
 * GET /api/protected/secret
 *
 * Route này chỉ user đã login mới gọi được.
 */
router.get("/secret", requireAuth, (req, res) => {
  return res.json({
    message: `Xin chào ${req.user.name}, bạn đã gọi protected API thành công.`,
    user: req.user,
  });
});

export default router;