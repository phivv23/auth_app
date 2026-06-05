import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const avatarUploadDir = path.resolve(__dirname, "../../uploads/avatars");
export const coverUploadDir = path.resolve(__dirname, "../../uploads/covers");
export const postUploadDir = path.resolve(__dirname, "../../uploads/posts");
export const storyUploadDir = path.resolve(__dirname, "../../uploads/stories");
export const messageUploadDir = path.resolve(
  __dirname,
  "../../uploads/messages"
);

fs.mkdirSync(avatarUploadDir, { recursive: true });
fs.mkdirSync(coverUploadDir, { recursive: true });
fs.mkdirSync(postUploadDir, { recursive: true });
fs.mkdirSync(storyUploadDir, { recursive: true });
fs.mkdirSync(messageUploadDir, { recursive: true });

export const UPLOAD_SIZE_LIMITS = {
  avatar: 2 * 1024 * 1024,
  cover: 5 * 1024 * 1024,
  post: 50 * 1024 * 1024,
  story: 50 * 1024 * 1024,
  message: 50 * 1024 * 1024,
};

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const STORY_MEDIA_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
export const POST_MEDIA_MIME_TYPES = STORY_MEDIA_MIME_TYPES;
export const MESSAGE_MEDIA_MIME_TYPES = [
  ...STORY_MEDIA_MIME_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
];

export const MIME_EXTENSION_MAP = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx",
  ],
  ["application/vnd.ms-excel", ".xls"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsx",
  ],
  ["application/vnd.ms-powerpoint", ".ppt"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".pptx",
  ],
  ["application/zip", ".zip"],
  ["application/x-zip-compressed", ".zip"],
  ["text/plain", ".txt"],
]);

export function isAllowedMimeType(mimetype, allowlist) {
  return allowlist.includes(mimetype);
}

export function getSafeUploadExtension(mimetype) {
  return MIME_EXTENSION_MAP.get(mimetype) || "";
}

export function sanitizeUploadDisplayName(originalName = "") {
  const basename = path.posix.basename(
    String(originalName || "").replace(/\\/g, "/")
  );
  const normalizedName = basename
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .replace(/[<>:"/\\|?*]/g, "_")
    .trim();

  return normalizedName.slice(0, 180);
}

export function createUploadFilename({
  prefix,
  mimetype,
  randomId = randomUUID,
}) {
  const safePrefix = String(prefix || "upload").replace(/[^a-z0-9-]/gi, "-");
  const extension = getSafeUploadExtension(mimetype);

  return `${safePrefix}-${randomId()}${extension}`;
}

function imageFileFilter(req, file, cb) {
  if (!isAllowedMimeType(file.mimetype, IMAGE_MIME_TYPES)) {
    return cb(new Error("Chỉ cho phép upload ảnh JPG, PNG hoặc WEBP"));
  }

  cb(null, true);
}

function storyMediaFileFilter(req, file, cb) {
  if (!isAllowedMimeType(file.mimetype, STORY_MEDIA_MIME_TYPES)) {
    return cb(
      new Error("Chỉ cho phép upload story JPG, PNG, WEBP, MP4, WEBM hoặc MOV")
    );
  }

  cb(null, true);
}

function postMediaFileFilter(req, file, cb) {
  if (!isAllowedMimeType(file.mimetype, POST_MEDIA_MIME_TYPES)) {
    return cb(
      new Error("Chỉ cho phép upload bài viết JPG, PNG, WEBP, MP4, WEBM hoặc MOV")
    );
  }

  cb(null, true);
}

function messageMediaFileFilter(req, file, cb) {
  if (!isAllowedMimeType(file.mimetype, MESSAGE_MEDIA_MIME_TYPES)) {
    return cb(
      new Error("Chỉ cho phép gửi ảnh, video, PDF, Office, TXT hoặc ZIP")
    );
  }

  cb(null, true);
}

function createImageStorage({ uploadDir, prefix }) {
  return multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadDir);
    },

    filename(req, file, cb) {
      const filename = createUploadFilename({
        prefix,
        mimetype: file.mimetype,
      });

      cb(null, filename);
    },
  });
}

export const uploadAvatar = multer({
  storage: createImageStorage({
    uploadDir: avatarUploadDir,
    prefix: "avatar",
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: UPLOAD_SIZE_LIMITS.avatar,
  },
});

export const uploadCover = multer({
  storage: createImageStorage({
    uploadDir: coverUploadDir,
    prefix: "cover",
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: UPLOAD_SIZE_LIMITS.cover,
  },
});

export const uploadPostImage = multer({
  storage: createImageStorage({
    uploadDir: postUploadDir,
    prefix: "post",
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: UPLOAD_SIZE_LIMITS.post,
  },
});

export const uploadPostMedia = multer({
  storage: createImageStorage({
    uploadDir: postUploadDir,
    prefix: "post",
  }),
  fileFilter: postMediaFileFilter,
  limits: {
    fileSize: UPLOAD_SIZE_LIMITS.post,
  },
});

export const uploadStoryMedia = multer({
  storage: createImageStorage({
    uploadDir: storyUploadDir,
    prefix: "story",
  }),
  fileFilter: storyMediaFileFilter,
  limits: {
    fileSize: UPLOAD_SIZE_LIMITS.story,
  },
});

export const uploadMessageMedia = multer({
  storage: createImageStorage({
    uploadDir: messageUploadDir,
    prefix: "message",
  }),
  fileFilter: messageMediaFileFilter,
  limits: {
    fileSize: UPLOAD_SIZE_LIMITS.message,
  },
});
