const SOURCE_CONFIG = {
  post: {
    idKey: "postId",
    label: "Bài viết đang chọn",
  },
  story: {
    idKey: "storyId",
    label: "Story đang xem",
  },
  message: {
    idKey: "messageId",
    label: "Tin nhắn đang chọn",
  },
};

export function createSharedMomentSourceItem(itemType, id) {
  const config = SOURCE_CONFIG[itemType];
  const numericId = Number(id);

  if (!config || !Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  return {
    itemType,
    [config.idKey]: numericId,
  };
}

export function getSharedMomentSourceLabel(sourceItem) {
  return SOURCE_CONFIG[sourceItem?.itemType]?.label || "Nội dung đang chọn";
}

export function buildSharedMomentDeepLink(sourceItem, extras = {}) {
  const config = SOURCE_CONFIG[sourceItem?.itemType];

  if (!config || !sourceItem?.[config.idKey]) {
    return "/moments";
  }

  const params = new URLSearchParams({
    [config.idKey]: String(sourceItem[config.idKey]),
  });

  if (extras.conversationId) {
    params.set("conversationId", String(extras.conversationId));
  }

  return `/moments?${params.toString()}`;
}

export function isSameSharedMomentSource(item, sourceItem) {
  const config = SOURCE_CONFIG[sourceItem?.itemType];

  if (!config || item?.itemType !== sourceItem.itemType) {
    return false;
  }

  return Number(item?.[config.idKey]) === Number(sourceItem[config.idKey]);
}
