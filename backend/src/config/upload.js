import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const avatarUploadDir = path.resolve(__dirname, "../../uploads/avatars");
const coverUploadDir = path.resolve(__dirname, "../../uploads/covers");
const postUploadDir = path.resolve(__dirname, "../../uploads/posts");
const storyUploadDir = path.resolve(__dirname, "../../uploads/stories");

fs.mkdirSync(avatarUploadDir, { recursive: true });
fs.mkdirSync(coverUploadDir, { recursive: true });
fs.mkdirSync(postUploadDir, { recursive: true });
fs.mkdirSync(storyUploadDir, { recursive: true });

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedStoryMimeTypes = [
  ...allowedMimeTypes,
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const allowedPostMimeTypes = allowedStoryMimeTypes;

function imageFileFilter(req, file, cb) {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Chỉ cho phép upload ảnh JPG, PNG hoặc WEBP"));
  }

  cb(null, true);
}

function storyMediaFileFilter(req, file, cb) {
  if (!allowedStoryMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error("Chỉ cho phép upload story JPG, PNG, WEBP, MP4, WEBM hoặc MOV")
    );
  }

  cb(null, true);
}

function postMediaFileFilter(req, file, cb) {
  if (!allowedPostMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error("Chỉ cho phép upload bài viết JPG, PNG, WEBP, MP4, WEBM hoặc MOV")
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
      const ext = path.extname(file.originalname).toLowerCase();

      const filename = `${prefix}-${req.user.id}-${Date.now()}${ext}`;

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
    fileSize: 2 * 1024 * 1024,
  },
});

export const uploadCover = multer({
  storage: createImageStorage({
    uploadDir: coverUploadDir,
    prefix: "cover",
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadPostImage = multer({
  storage: createImageStorage({
    uploadDir: postUploadDir,
    prefix: "post",
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadPostMedia = multer({
  storage: createImageStorage({
    uploadDir: postUploadDir,
    prefix: "post",
  }),
  fileFilter: postMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

export const uploadStoryMedia = multer({
  storage: createImageStorage({
    uploadDir: storyUploadDir,
    prefix: "story",
  }),
  fileFilter: storyMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
