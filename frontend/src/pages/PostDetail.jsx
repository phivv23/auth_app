import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { getPostById } from "../api/post.api.js";
import SocialPostCard from "../components/SocialPostCard.jsx";

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const postId = Number(id);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadPost() {
      try {
        setLoading(true);
        setError("");

        const data = await getPostById(postId);

        if (isActive) {
          setPost(data.post);
        }
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadPost();

    return () => {
      isActive = false;
    };
  }, [postId]);

  if (loading) {
    return <p>Đang tải bài viết...</p>;
  }

  if (error) {
    return (
      <section className="card">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="card">
        <p>Không tìm thấy bài viết.</p>
      </section>
    );
  }

  return (
    <SocialPostCard
      post={post}
      defaultCommentsOpen
      onPostUpdated={setPost}
      onPostDeleted={() => navigate("/posts")}
    />
  );
}
