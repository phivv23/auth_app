import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import {
  addRealtimeClient,
  REALTIME_ALL_EVENTS,
} from "../realtime/broker.js";

const router = Router();

router.get("/stream", requireAuth, (req, res) => {
  res.set({
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
  });
  res.flushHeaders?.();

  res.write("event: connected\ndata: {}\n\n");

  const removeClient = addRealtimeClient(req.user.id, res, {
    events: REALTIME_ALL_EVENTS,
    trackPresence: true,
  });
  const heartbeatId = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeatId);
    removeClient();
  });
});

export default router;
