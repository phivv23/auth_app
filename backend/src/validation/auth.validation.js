const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALIDATION_ERROR_CODE = "VALIDATION_ERROR";
const PROFILE_PRIVACY_VALUES = ["public", "followers", "friends", "only_me"];

function hasInputValue(value) {
  return value !== undefined && value !== null && String(value).length > 0;
}

function buildValidationError(fields, fallbackMessage = "Dữ liệu không hợp lệ.") {
  return {
    message: Object.values(fields)[0] || fallbackMessage,
    code: VALIDATION_ERROR_CODE,
    fields,
  };
}

function validationSuccess(value) {
  return {
    value,
    error: null,
  };
}

function validationFailure(fields, fallbackMessage) {
  return {
    value: null,
    error: buildValidationError(fields, fallbackMessage),
  };
}

export function isValidEmail(email) {
  return EMAIL_PATTERN.test(email);
}

export function validateRegisterInput(input = {}) {
  const fields = {};

  const hasName = hasInputValue(input.name);
  const hasEmail = hasInputValue(input.email);
  const hasPassword = hasInputValue(input.password);

  const name = hasName ? String(input.name).trim() : "";
  const email = hasEmail ? String(input.email).trim().toLowerCase() : "";
  const password = hasPassword ? String(input.password) : "";

  if (!hasName) {
    fields.name = "Name là bắt buộc.";
  } else if (name.length < 2) {
    fields.name = "Name phải có ít nhất 2 ký tự.";
  }

  if (!hasEmail) {
    fields.email = "Email là bắt buộc.";
  } else if (!isValidEmail(email)) {
    fields.email = "Email không hợp lệ.";
  }

  if (!hasPassword) {
    fields.password = "Password là bắt buộc.";
  } else if (password.length < 6) {
    fields.password = "Password phải có ít nhất 6 ký tự.";
  }

  if (Object.keys(fields).length > 0) {
    return validationFailure(fields, "Name, email và password là bắt buộc.");
  }

  return validationSuccess({
    name,
    email,
    password,
  });
}

export function validateLoginInput(input = {}) {
  const fields = {};

  const hasEmail = hasInputValue(input.email);
  const hasPassword = hasInputValue(input.password);

  const email = hasEmail ? String(input.email).trim().toLowerCase() : "";
  const password = hasPassword ? String(input.password) : "";

  if (!hasEmail) {
    fields.email = "Email là bắt buộc.";
  } else if (!isValidEmail(email)) {
    fields.email = "Email không hợp lệ.";
  }

  if (!hasPassword) {
    fields.password = "Password là bắt buộc.";
  }

  if (Object.keys(fields).length > 0) {
    return validationFailure(fields, "Email và password là bắt buộc.");
  }

  return validationSuccess({
    email,
    password,
  });
}

function normalizeOptionalText(value, maxLength, fieldName) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return {
      value: null,
      error: null,
    };
  }

  if (normalizedValue.length > maxLength) {
    return {
      value: null,
      error: `${fieldName} không được vượt quá ${maxLength} ký tự.`,
    };
  }

  return {
    value: normalizedValue,
    error: null,
  };
}

function normalizeWebsite(value) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return {
      value: null,
      error: null,
    };
  }

  if (normalizedValue.length > 255) {
    return {
      value: null,
      error: "Website không được vượt quá 255 ký tự.",
    };
  }

  const urlWithProtocol = /^https?:\/\//i.test(normalizedValue)
    ? normalizedValue
    : `https://${normalizedValue}`;

  try {
    const url = new URL(urlWithProtocol);

    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
      return {
        value: null,
        error: "Website phải là URL http hoặc https hợp lệ.",
      };
    }

    return {
      value: url.toString(),
      error: null,
    };
  } catch {
    return {
      value: null,
      error: "Website không hợp lệ.",
    };
  }
}

export function validateProfileInput(input = {}) {
  const fields = {};

  const hasName = hasInputValue(input.name);
  const hasEmail = hasInputValue(input.email);

  const name = hasName ? String(input.name).trim() : "";
  const email = hasEmail ? String(input.email).trim().toLowerCase() : "";

  if (!hasName) {
    fields.name = "Name là bắt buộc.";
  } else if (name.length < 2) {
    fields.name = "Name phải có ít nhất 2 ký tự.";
  }

  if (!hasEmail) {
    fields.email = "Email là bắt buộc.";
  } else if (!isValidEmail(email)) {
    fields.email = "Email không hợp lệ.";
  }

  const bio = normalizeOptionalText(input.bio, 500, "Bio");
  const location = normalizeOptionalText(input.location, 100, "Location");
  const website = normalizeWebsite(input.website);
  const profilePrivacy = String(input.profilePrivacy || "public").trim();

  if (bio.error) {
    fields.bio = bio.error;
  }

  if (location.error) {
    fields.location = location.error;
  }

  if (website.error) {
    fields.website = website.error;
  }

  if (!PROFILE_PRIVACY_VALUES.includes(profilePrivacy)) {
    fields.profilePrivacy = "Quyền riêng tư profile không hợp lệ.";
  }

  if (Object.keys(fields).length > 0) {
    return validationFailure(fields, "Name và email là bắt buộc.");
  }

  return validationSuccess({
    name,
    email,
    bio: bio.value,
    location: location.value,
    website: website.value,
    profilePrivacy,
  });
}

export function validatePasswordChangeInput(input = {}) {
  const fields = {};

  const hasCurrentPassword = hasInputValue(input.currentPassword);
  const hasNewPassword = hasInputValue(input.newPassword);

  const currentPassword = hasCurrentPassword ? String(input.currentPassword) : "";
  const newPassword = hasNewPassword ? String(input.newPassword) : "";

  if (!hasCurrentPassword) {
    fields.currentPassword = "Password hiện tại là bắt buộc.";
  }

  if (!hasNewPassword) {
    fields.newPassword = "Password mới là bắt buộc.";
  } else if (newPassword.length < 6) {
    fields.newPassword = "Password mới phải có ít nhất 6 ký tự.";
  } else if (hasCurrentPassword && currentPassword === newPassword) {
    fields.newPassword = "Password mới không được giống password hiện tại.";
  }

  if (Object.keys(fields).length > 0) {
    return validationFailure(
      fields,
      "Password hiện tại và password mới là bắt buộc."
    );
  }

  return validationSuccess({
    currentPassword,
    newPassword,
  });
}
