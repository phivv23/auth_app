export const postMediaAccept =
  "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";

export const postMediaMaxFiles = 10;

export const postMediaErrorMessage =
  "Chỉ được chọn tối đa 10 file. Ảnh JPG, PNG, WEBP tối đa 5MB; video MP4, WEBM, MOV tối đa 50MB.";

const allowedPostMediaTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const imageMaxSize = 5 * 1024 * 1024;
const videoMaxSize = 50 * 1024 * 1024;

export function getPostMediaTypeFromFile(file) {
  return file?.type?.startsWith("video/") ? "video" : "image";
}

export function isVideoMedia(media) {
  return media?.type === "video" || media?.mediaType === "video";
}

export function validatePostMediaFiles(files) {
  return getPostMediaFileErrors(files).length > 0 ? postMediaErrorMessage : "";
}

export function getPostMediaFileErrors(files) {
  const errors = [];

  if (files.length > postMediaMaxFiles) {
    errors.push({
      name: "Số lượng file",
      message: `Chỉ được chọn tối đa ${postMediaMaxFiles} file.`,
    });
  }

  files.forEach((file) => {
    if (!allowedPostMediaTypes.includes(file.type)) {
      errors.push({
        name: file.name || "File không tên",
        message: "Định dạng này chưa được hỗ trợ.",
      });
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? videoMaxSize : imageMaxSize;

    if (file.size > maxSize) {
      errors.push({
        name: file.name || "File không tên",
        message: `Dung lượng vượt giới hạn ${isVideo ? "50MB" : "5MB"}.`,
      });
    }
  });

  return errors;
}

export function createPostMediaPreviews(files) {
  return files.map((file) => ({
    name: file.name,
    type: getPostMediaTypeFromFile(file),
    url: URL.createObjectURL(file),
  }));
}
