const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:)\]}]+$/;

function splitTrailingPunctuation(url) {
  const match = url.match(TRAILING_PUNCTUATION_PATTERN);

  if (!match) {
    return {
      href: url,
      suffix: "",
    };
  }

  return {
    href: url.slice(0, -match[0].length),
    suffix: match[0],
  };
}

export default function LinkifiedText({ text = "" }) {
  const chunks = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0];
    const index = match.index || 0;

    if (index > lastIndex) {
      chunks.push(text.slice(lastIndex, index));
    }

    const { href, suffix } = splitTrailingPunctuation(rawUrl);

    chunks.push(
      <a key={`${href}-${index}`} href={href} target="_blank" rel="noreferrer">
        {href}
      </a>
    );

    if (suffix) {
      chunks.push(suffix);
    }

    lastIndex = index + rawUrl.length;
  }

  if (lastIndex < text.length) {
    chunks.push(text.slice(lastIndex));
  }

  return chunks.length > 0 ? chunks : text;
}
