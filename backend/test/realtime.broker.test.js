import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  addRealtimeClient,
  getRealtimeClientCount,
  isRealtimeUserOnline,
  publishRealtimeEvent,
  REALTIME_ALL_EVENTS,
  REALTIME_MESSAGE_EVENTS,
  REALTIME_NOTIFICATION_EVENTS,
  resetRealtimeBrokerForTest,
  setRealtimeLastSeenUpdaterForTest,
} from "../src/realtime/broker.js";

function createMockResponse() {
  return {
    writes: [],
    write(payload) {
      this.writes.push(payload);
    },
  };
}

afterEach(() => {
  resetRealtimeBrokerForTest();
});

describe("realtime broker", () => {
  it("publishes message and notification events through one client registry", () => {
    setRealtimeLastSeenUpdaterForTest(async () => {});

    const unifiedResponse = createMockResponse();
    const removeClient = addRealtimeClient(7, unifiedResponse, {
      events: REALTIME_ALL_EVENTS,
      trackPresence: true,
    });

    assert.equal(getRealtimeClientCount(7), 1);
    assert.equal(isRealtimeUserOnline(7), true);

    unifiedResponse.writes.length = 0;
    publishRealtimeEvent(7, "message", { id: 1 });
    publishRealtimeEvent(7, "notification", { id: 2 });

    assert.match(unifiedResponse.writes[0], /event: message/);
    assert.match(unifiedResponse.writes[0], /"id":1/);
    assert.match(unifiedResponse.writes[1], /event: notification/);
    assert.match(unifiedResponse.writes[1], /"id":2/);

    removeClient();

    assert.equal(getRealtimeClientCount(7), 0);
    assert.equal(isRealtimeUserOnline(7), false);
  });

  it("keeps legacy stream event filters isolated", () => {
    setRealtimeLastSeenUpdaterForTest(async () => {});

    const messageResponse = createMockResponse();
    const notificationResponse = createMockResponse();

    const removeMessageClient = addRealtimeClient(8, messageResponse, {
      events: REALTIME_MESSAGE_EVENTS,
      trackPresence: true,
    });
    const removeNotificationClient = addRealtimeClient(8, notificationResponse, {
      events: REALTIME_NOTIFICATION_EVENTS,
      trackPresence: false,
    });

    messageResponse.writes.length = 0;
    notificationResponse.writes.length = 0;
    publishRealtimeEvent(8, "message", { id: "message-only" });
    publishRealtimeEvent(8, "notification", { id: "notification-only" });

    assert.equal(messageResponse.writes.length, 1);
    assert.match(messageResponse.writes[0], /event: message/);
    assert.equal(notificationResponse.writes.length, 1);
    assert.match(notificationResponse.writes[0], /event: notification/);

    removeMessageClient();
    removeNotificationClient();
  });
});
