import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth.js";
import { getFileUrl } from "../api/client";

export default function AvatarUpload() {
  const { user, uploadAvatar } = useAuth();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];

    setError("");
    setSuccess("");

    if (!selectedFile) {
      setFile(null);
      setPreviewUrl("");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP");
      setFile(null);
      setPreviewUrl("");
      return;
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setError("Ảnh tối đa 2MB");
      setFile(null);
      setPreviewUrl("");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
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
      setFile(null);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentAvatar = previewUrl || getFileUrl(user?.avatarUrl);

  return (
    <section className="card">
      <h2>Avatar</h2>

      <div className="avatar-box">
        {currentAvatar ? (
          <img className="avatar-preview" src={currentAvatar} alt="Avatar" />
        ) : (
          <div className="avatar-placeholder">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Chọn avatar</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
          />
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Đang upload..." : "Upload avatar"}
        </button>
      </form>
    </section>
  );
}
