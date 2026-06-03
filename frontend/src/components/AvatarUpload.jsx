import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/useAuth.js";
import { getFileUrl } from "../api/client";

const allowedAvatarTypes = ["image/jpeg", "image/png", "image/webp"];
const maxAvatarSize = 2 * 1024 * 1024;

function formatFileSize(size) {
  if (!Number.isFinite(size)) {
    return "";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function AvatarUpload() {
  const { user, uploadAvatar } = useAuth();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function clearSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(null);
    setPreviewUrl("");
    setDragging(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function applySelectedFile(selectedFile) {
    setError("");
    setSuccess("");

    if (!selectedFile) {
      clearSelectedFile();
      return;
    }

    if (!allowedAvatarTypes.includes(selectedFile.type)) {
      setError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP");
      clearSelectedFile();
      return;
    }

    if (selectedFile.size > maxAvatarSize) {
      setError("Ảnh tối đa 2MB");
      clearSelectedFile();
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }

  function handleFileChange(event) {
    applySelectedFile(event.target.files?.[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    applySelectedFile(event.dataTransfer.files?.[0]);
  }

  function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(true);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setDragging(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setError("Vui lòng chọn ảnh trước khi upload");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await uploadAvatar(file);

      setSuccess("Upload avatar thành công");
      clearSelectedFile();
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentAvatar = previewUrl || getFileUrl(user?.avatarUrl);
  const fallbackInitial = user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <section className="card avatar-upload-card">
      <div className="avatar-upload-header">
        <div>
          <h2>Avatar</h2>
          <p>Ảnh vuông, rõ mặt giúp profile dễ nhận ra hơn.</p>
        </div>

        {previewUrl && <span>Đang xem trước</span>}
      </div>

      <form className="avatar-upload-form" onSubmit={handleSubmit}>
        <label
          className={`avatar-dropzone ${dragging ? "is-dragging" : ""}`.trim()}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="avatar-ring" aria-hidden="true">
            {currentAvatar ? (
              <img className="avatar-preview" src={currentAvatar} alt="" />
            ) : (
              <span className="avatar-placeholder">{fallbackInitial}</span>
            )}
          </span>

          <span className="avatar-upload-copy">
            <strong>{file ? file.name : "Chọn hoặc kéo ảnh vào đây"}</strong>
            <small>
              {file
                ? `${formatFileSize(file.size)} · JPG, PNG hoặc WEBP`
                : "JPG, PNG hoặc WEBP · tối đa 2MB"}
            </small>
          </span>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={submitting}
          />
        </label>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <div className="avatar-upload-actions">
          <button
            className="button"
            type="submit"
            disabled={!file || submitting}
          >
            {submitting ? "Đang lưu..." : "Lưu avatar"}
          </button>

          <button
            className="button secondary"
            type="button"
            onClick={clearSelectedFile}
            disabled={!file || submitting}
          >
            Hủy chọn
          </button>
        </div>
      </form>
    </section>
  );
}
