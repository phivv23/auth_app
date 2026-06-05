const ABSOLUTE_POST_URL_PATTERN =
  /https?:\/\/[^\s<>"']*\/posts\/(\d+)(?:[?#][^\s<>"']*)?/i;
const RELATIVE_POST_URL_PATTERN = /(?:^|\s)(\/posts\/(\d+)(?:[?#][^\s<>"']*)?)/i;

export function extractSharedPostId(text = "") {
  const absoluteMatch = String(text).match(ABSOLUTE_POST_URL_PATTERN);

  if (absoluteMatch?.[1]) {
    return Number(absoluteMatch[1]);
  }

  const relativeMatch = String(text).match(RELATIVE_POST_URL_PATTERN);

  if (relativeMatch?.[2]) {
    return Number(relativeMatch[2]);
  }

  return null;
}

export function stripSharedPostUrl(text = "") {
  return String(text)
    .replace(ABSOLUTE_POST_URL_PATTERN, "")
    .replace(RELATIVE_POST_URL_PATTERN, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
