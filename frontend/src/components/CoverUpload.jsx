import { useEffect, useState } from "react";
import { getFileUrl } from "../api/client";
import { useAuth } from "../context/useAuth.js";

export default function CoverUpload() {
  const { user, uploadCover } = useAuth();

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

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Ảnh bìa tối đa 5MB");
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
      setError("Vui lòng chọn ảnh bìa trước khi upload");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await uploadCover(file);

      setSuccess("Upload ảnh bìa thành công");
      setFile(null);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentCover = previewUrl || getFileUrl(user?.coverUrl);

  return (
    <section className="card">
      <h2>Ảnh bìa</h2>

      <div className="cover-upload-box">
        {currentCover ? (
          <img className="cover-upload-preview" src={currentCover} alt="Ảnh bìa" />
        ) : (
          <div className="cover-upload-placeholder">Ảnh bìa</div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Chọn ảnh bìa</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
          />
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Đang upload..." : "Upload ảnh bìa"}
        </button>
      </form>
    </section>
  );
}
