import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getNotificationTarget,
  getNotificationText,
} from "./notificationDisplay.js";

describe("notification display", () => {
  it("formats shared moment notifications", () => {
    const invite = {
      type: "shared_moment_invite",
      actorName: "An",
      metadata: {
        momentId: 7,
        title: "Đà Lạt",
      },
    };

    assert.equal(getNotificationText(invite), 'An đã mời bạn vào "Đà Lạt"');
    assert.equal(getNotificationTarget(invite), "/moments?momentId=7");
  });
});
