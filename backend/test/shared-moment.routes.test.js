import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { request } from "./helpers/http.js";

process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "root";
process.env.DB_PASSWORD ||= "rootpassword";
process.env.DB_NAME ||= "auth_app";
process.env.JWT_SECRET ||= "development_secret_with_enough_length";
process.env.NODE_ENV ||= "test";

const { createRequestLogger } = await import("../src/middleware/requestLogger.js");
const { createSharedMomentRouter } = await import("../src/routes/sharedMoment.routes.js");
const { createApp } = await import("../src/server.js");
const { sendError } = await import("../src/utils/http.js");

function createSilentApp(options = {}) {
  const silentLogger = {
    error() {},
    info() {},
    warn() {},
  };

  return createApp({
    errorLogger: silentLogger,
    requestLogger: createRequestLogger({ logger: silentLogger }),
    ...options,
  });
}

function createAuthMiddleware() {
  return (req, res, next) => {
    const userId = Number(req.get("X-Test-User-Id"));

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Bạn chưa đăng nhập.", "AUTH_REQUIRED");
    }

    req.user = {
      id: userId,
      name: `User ${userId}`,
      accountStatus: "active",
    };

    return next();
  };
}

function normalizeMoment(moment, userId) {
  const participant = moment.participants.find(
    (item) => Number(item.userId) === Number(userId)
  );

  if (!participant || participant.status === "declined") {
    return null;
  }

  return {
    id: moment.id,
    creatorId: moment.creatorId,
    title: moment.title,
    note: moment.note || "",
    mood: moment.mood || "",
    coverMediaUrl: "",
    createdAt: moment.createdAt,
    updatedAt: moment.updatedAt,
    creator: {
      id: moment.creatorId,
      name: `User ${moment.creatorId}`,
      avatarUrl: "",
    },
    myStatus: participant.status,
    participantCount: moment.participants.filter(
      (item) => item.status === "accepted"
    ).length,
    pendingCount: moment.participants.filter((item) => item.status === "pending")
      .length,
    itemCount: moment.items.length,
    latestItemAt: moment.items.at(-1)?.createdAt || null,
  };
}

function createMomentDetail(moment, userId) {
  const normalized = normalizeMoment(moment, userId);

  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    participants: moment.participants
      .filter((participant) => participant.status !== "declined")
      .map((participant, index) => ({
        id: index + 1,
        momentId: moment.id,
        userId: participant.userId,
        invitedById: participant.invitedById,
        status: participant.status,
        createdAt: moment.createdAt,
        respondedAt: participant.respondedAt || null,
        user: {
          id: participant.userId,
          name: `User ${participant.userId}`,
          avatarUrl: "",
        },
      })),
    items: moment.items,
  };
}

function createMomentTestApp() {
  const moments = [];
  const notifications = [];
  const now = () => new Date().toISOString();
  const friendships = new Map([
    [1, new Set([2])],
    [2, new Set([1])],
    [3, new Set()],
  ]);

  function getMoment(momentId) {
    return moments.find((moment) => Number(moment.id) === Number(momentId));
  }

  const sharedMomentRouter = createSharedMomentRouter({
    requireAuthMiddleware: createAuthMiddleware(),
    requireActiveAccountMiddleware: (req, res, next) => next(),
    createNotificationForUser: async (notification) => {
      notifications.push(notification);
      return notification;
    },
    resolveSharedMomentItem: async (input) => {
      if (input.itemType !== "note" || !String(input.content || "").trim()) {
        return {
          error: "Bạn cần nhập nội dung ghi chú.",
        };
      }

      return {
        value: {
          itemType: "note",
          content: String(input.content).trim(),
          postId: null,
          storyId: null,
          messageId: null,
          conversationId: null,
          mediaUrl: null,
          mediaType: null,
        },
      };
    },
    createSharedMoment: async ({
      creatorId,
      title,
      note = "",
      participantIds,
    }) => {
      const friendIds = friendships.get(Number(creatorId)) || new Set();

      if (!participantIds.every((id) => friendIds.has(Number(id)))) {
        return {
          error: "Bạn chỉ có thể mời bạn bè vào khoảnh khắc chung.",
        };
      }

      const createdAt = now();
      const moment = {
        id: moments.length + 1,
        creatorId,
        title,
        note,
        mood: "",
        createdAt,
        updatedAt: createdAt,
        participants: [
          {
            userId: creatorId,
            invitedById: creatorId,
            status: "accepted",
            respondedAt: createdAt,
          },
          ...participantIds.map((userId) => ({
            userId,
            invitedById: creatorId,
            status: "pending",
            respondedAt: null,
          })),
        ],
        items: [],
      };

      moments.push(moment);

      return {
        invitedUserIds: participantIds,
        moment: createMomentDetail(moment, creatorId),
      };
    },
    findSharedMomentsForUser: async ({ userId, status = "all" }) => {
      const visibleMoments = moments
        .map((moment) => normalizeMoment(moment, userId))
        .filter(Boolean)
        .filter((moment) => status === "all" || moment.myStatus === status);

      return {
        moments: visibleMoments,
        page: 1,
        limit: 20,
        total: visibleMoments.length,
        totalPages: 1,
      };
    },
    findSharedMomentByIdForUser: async (momentId, userId) => {
      const moment = getMoment(momentId);

      return moment ? createMomentDetail(moment, userId) : null;
    },
    respondToSharedMoment: async ({ momentId, userId, status }) => {
      if (!["accepted", "declined"].includes(status)) {
        return {
          error: "Trạng thái phản hồi không hợp lệ.",
        };
      }

      const moment = getMoment(momentId);
      const participant = moment?.participants.find(
        (item) => Number(item.userId) === Number(userId)
      );

      if (!participant || participant.status !== "pending") {
        return null;
      }

      participant.status = status;
      participant.respondedAt = now();
      moment.updatedAt = participant.respondedAt;

      if (status === "declined") {
        return {
          declined: true,
        };
      }

      return {
        moment: createMomentDetail(moment, userId),
      };
    },
    addSharedMomentItem: async ({ momentId, userId, item }) => {
      const moment = getMoment(momentId);
      const participant = moment?.participants.find(
        (entry) => Number(entry.userId) === Number(userId)
      );

      if (!participant || participant.status !== "accepted") {
        return null;
      }

      const createdAt = now();
      moment.items.push({
        id: moment.items.length + 1,
        momentId,
        itemType: item.itemType,
        content: item.content,
        postId: null,
        storyId: null,
        messageId: null,
        conversationId: null,
        mediaUrl: "",
        mediaType: "",
        createdById: userId,
        createdAt,
        createdBy: {
          id: userId,
          name: `User ${userId}`,
          avatarUrl: "",
        },
      });
      moment.updatedAt = createdAt;

      return {
        moment: createMomentDetail(moment, userId),
      };
    },
  });

  return {
    app: createSilentApp({
      sharedMomentRouter,
    }),
    notifications,
  };
}

function jsonRequestOptions(userId, body = {}) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-User-Id": String(userId),
    },
    body: JSON.stringify(body),
  };
}

describe("shared moment routes", () => {
  it("requires auth for list, detail, create, respond and add item", async () => {
    const { app } = createMomentTestApp();
    const requests = [
      request(app, "/api/moments"),
      request(app, "/api/moments/1"),
      request(app, "/api/moments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Trip", participantIds: [2] }),
      }),
      request(app, "/api/moments/1/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "accepted" }),
      }),
      request(app, "/api/moments/1/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemType: "note", content: "hello" }),
      }),
    ];

    const responses = await Promise.all(requests);

    for (const response of responses) {
      assert.equal(response.status, 401);
      assert.equal(response.body.code, "AUTH_REQUIRED");
    }
  });

  it("creates moments only with friends and sends invite notifications", async () => {
    const { app, notifications } = createMomentTestApp();

    const forbiddenResponse = await request(
      app,
      "/api/moments",
      jsonRequestOptions(1, {
        title: "Private trip",
        participantIds: [3],
      })
    );

    assert.equal(forbiddenResponse.status, 400);

    const response = await request(
      app,
      "/api/moments",
      jsonRequestOptions(1, {
        title: "Weekend",
        note: "Start here",
        participantIds: [2],
      })
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.moment.title, "Weekend");
    assert.equal(response.body.moment.myStatus, "accepted");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].recipientId, 2);
    assert.equal(notifications[0].type, "shared_moment_invite");
  });

  it("lets invitees see pending moments, accept and then add notes", async () => {
    const { app } = createMomentTestApp();

    await request(
      app,
      "/api/moments",
      jsonRequestOptions(1, {
        title: "Weekend",
        participantIds: [2],
      })
    );

    const pendingResponse = await request(app, "/api/moments?status=pending", {
      headers: {
        "X-Test-User-Id": "2",
      },
    });

    assert.equal(pendingResponse.status, 200);
    assert.equal(pendingResponse.body.moments.length, 1);
    assert.equal(pendingResponse.body.moments[0].myStatus, "pending");

    const acceptResponse = await request(
      app,
      "/api/moments/1/respond",
      jsonRequestOptions(2, {
        status: "accepted",
      })
    );

    assert.equal(acceptResponse.status, 200);
    assert.equal(acceptResponse.body.moment.myStatus, "accepted");

    const addItemResponse = await request(
      app,
      "/api/moments/1/items",
      jsonRequestOptions(2, {
        itemType: "note",
        content: "Great memory",
      })
    );

    assert.equal(addItemResponse.status, 201);
    assert.equal(addItemResponse.body.moment.items.length, 1);
    assert.equal(addItemResponse.body.moment.items[0].content, "Great memory");
  });

  it("hides declined moments and blocks users outside the moment", async () => {
    const { app } = createMomentTestApp();

    await request(
      app,
      "/api/moments",
      jsonRequestOptions(1, {
        title: "Weekend",
        participantIds: [2],
      })
    );

    const outsideDetailResponse = await request(app, "/api/moments/1", {
      headers: {
        "X-Test-User-Id": "3",
      },
    });
    const outsideAddResponse = await request(
      app,
      "/api/moments/1/items",
      jsonRequestOptions(3, {
        itemType: "note",
        content: "No access",
      })
    );

    assert.equal(outsideDetailResponse.status, 404);
    assert.equal(outsideAddResponse.status, 404);

    const declineResponse = await request(
      app,
      "/api/moments/1/respond",
      jsonRequestOptions(2, {
        status: "declined",
      })
    );

    assert.equal(declineResponse.status, 200);
    assert.equal(declineResponse.body.declined, true);

    const listResponse = await request(app, "/api/moments", {
      headers: {
        "X-Test-User-Id": "2",
      },
    });

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.moments.length, 0);
  });
});
