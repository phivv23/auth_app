import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getPostById, updatePost } from "../api/post.api.js";
import { useAuth } from "../context/useAuth.js";
import { getFileUrl } from "../api/client.js";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const postId = Number(id);

  const [form, setForm] = useState({
    title: "",
    content: "",
    privacy: "public",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [post, setPost] = useState(null);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    async function loadPost() {
      try {
        setLoading(true);
        setError("");

        const data = await getPostById(postId);
        const loadedPost = data.post;

        if (!user || user.id !== loadedPost.userId) {
          setError("Bạn không có quyền sửa bài viết này.");
          return;
        }

        setForm({
          title: loadedPost.title || "",
          content: loadedPost.content || "",
          privacy: loadedPost.privacy || "public",
        });
        setPost(loadedPost);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [postId, user]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function resetSelectedImages() {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setImages([]);
    setPreviews([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files || []);

    setError("");

    if (selectedFiles.length === 0) {
      resetSelectedImages();
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !allowedImageTypes.includes(file.type) || file.size > 5 * 1024 * 1024
    );

    if (selectedFiles.length > 10 || invalidFile) {
      setError("Chỉ được chọn tối đa 10 ảnh JPG, PNG hoặc WEBP, mỗi ảnh tối đa 5MB.");
      resetSelectedImages();
      return;
    }

    resetSelectedImages();
    setImages(selectedFiles);
    setPreviews(
      selectedFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      }))
    );
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const hasMedia = images.length > 0 || Boolean(post?.media?.length);

    if (!form.content.trim() && !hasMedia) {
      setError("Bài viết cần có nội dung hoặc ảnh.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const formData = new FormData();

      formData.append("title", form.title);
      formData.append("content", form.content);
      formData.append("privacy", form.privacy);

      images.forEach((image) => {
        formData.append("media", image);
      });

      const data = await updatePost(postId, formData);

      navigate(`/posts/${data.post.id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p>Đang tải bài viết...</p>;
  }

  const canEdit = post && user && user.id === post.userId;

  return (
    <section className="card">
      <h1>Sửa bài viết</h1>

      {error && <p className="error">{error}</p>}

      {canEdit && (
        <form onSubmit={handleSubmit} className="form">
          <label>
            Title
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Tiêu đề bài viết (không bắt buộc)"
            />
          </label>

          <label>
            Content
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              placeholder="Bạn đang nghĩ gì?"
              rows={10}
            />
          </label>

          <label>
            Quyền xem
            <select name="privacy" value={form.privacy} onChange={handleChange}>
              <option value="public">Công khai</option>
              <option value="followers">Người theo dõi</option>
              <option value="friends">Bạn bè</option>
              <option value="only_me">Chỉ mình tôi</option>
            </select>
          </label>

          <div className="form-group">
            <label>Ảnh bài viết</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageChange}
            />
          </div>

          {previews.length > 0 ? (
            <div className="composer-media-grid">
              {previews.map((preview) => (
                <img key={preview.url} src={preview.url} alt={preview.name} />
              ))}
            </div>
          ) : post?.media?.length ? (
            <div className="composer-media-grid">
              {post.media.map((item) => (
                <img
                  key={item.url}
                  src={getFileUrl(item.url)}
                  alt={post.title || "Ảnh bài viết"}
                />
              ))}
            </div>
          ) : null}

          {images.length > 0 && (
            <button type="button" className="link-button" onClick={resetSelectedImages}>
              Xóa ảnh mới chọn
            </button>
          )}

          <button className="button" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      )}
    </section>
  );
}
