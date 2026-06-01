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
  if (files.length > postMediaMaxFiles) {
    return postMediaErrorMessage;
  }

  const invalidFile = files.find((file) => {
    if (!allowedPostMediaTypes.includes(file.type)) {
      return true;
    }

    const maxSize = file.type.startsWith("video/") ? videoMaxSize : imageMaxSize;

    return file.size > maxSize;
  });

  return invalidFile ? postMediaErrorMessage : "";
}

export function createPostMediaPreviews(files) {
  return files.map((file) => ({
    name: file.name,
    type: getPostMediaTypeFromFile(file),
    url: URL.createObjectURL(file),
  }));
}
