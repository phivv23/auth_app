import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getSharedMoments,
  respondToSharedMoment,
} from "../api/moment.api.js";
import { formatRelativeTime } from "../utils/time.js";

function getInitial(value) {
  return value?.charAt(0)?.toUpperCase() || "K";
}

function getMomentStatusText(moment) {
  if (moment.myStatus === "pending") {
    return "Lời mời";
  }

  return `${moment.participantCount || 1} người · ${moment.itemCount || 0} nội dung`;
}

function MomentCover({ moment }) {
  const coverUrl = getFileUrl(moment.coverMediaUrl);

  if (coverUrl) {
    return <img src={coverUrl} alt="" loading="lazy" />;
  }

  return <span>{getInitial(moment.title)}</span>;
}

function MomentCard({ moment, responding, onRespond }) {
  return (
    <article
      className={
        moment.myStatus === "pending"
          ? "feed-moment-card pending"
          : "feed-moment-card"
      }
    >
      <Link
        className="feed-moment-card-main"
        to={`/moments?momentId=${moment.id}`}
        aria-label={`Mở khoảnh khắc ${moment.title}`}
      >
        <span className="feed-moment-cover">
          <MomentCover moment={moment} />
        </span>

        <span className="feed-moment-body">
          <strong>{moment.title}</strong>
          <small>{getMomentStatusText(moment)}</small>
          <em>{formatRelativeTime(moment.updatedAt)}</em>
        </span>
      </Link>

      {moment.myStatus === "pending" && (
        <div className="feed-moment-actions">
          <button
            type="button"
            disabled={Boolean(responding)}
            onClick={() => onRespond(moment.id, "accepted")}
          >
            {responding === "accepted" ? "Đang nhận..." : "Nhận"}
          </button>
          <button
            type="button"
            disabled={Boolean(responding)}
            onClick={() => onRespond(moment.id, "declined")}
          >
            Từ chối
          </button>
        </div>
      )}
    </article>
  );
}

export default function SharedMomentsFeedStrip({ onNotice }) {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [respondingById, setRespondingById] = useState({});

  const prioritizedMoments = useMemo(() => {
    return [...moments].sort((firstMoment, secondMoment) => {
      if (firstMoment.myStatus === "pending" && secondMoment.myStatus !== "pending") {
        return -1;
      }

      if (firstMoment.myStatus !== "pending" && secondMoment.myStatus === "pending") {
        return 1;
      }

      return (
        new Date(secondMoment.updatedAt).getTime() -
        new Date(firstMoment.updatedAt).getTime()
      );
    });
  }, [moments]);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadMoments() {
      try {
        setLoading(true);
        setError("");

        const data = await getSharedMoments({
          limit: 8,
          signal: controller.signal,
        });

        if (isActive) {
          setMoments(data.moments || []);
        }
      } catch (error) {
        if (isActive && error.name !== "AbortError") {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadMoments();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  async function handleRespond(momentId, status) {
    try {
      setRespondingById((currentState) => ({
        ...currentState,
        [momentId]: status,
      }));
      setError("");

      const data = await respondToSharedMoment(momentId, status);

      setMoments((currentMoments) => {
        if (status === "declined") {
          return currentMoments.filter(
            (moment) => Number(moment.id) !== Number(momentId)
          );
        }

        return currentMoments.map((moment) =>
          Number(moment.id) === Number(momentId)
            ? {
                ...moment,
                ...data.moment,
              }
            : moment
        );
      });
      onNotice?.(
        status === "accepted"
          ? "Đã tham gia khoảnh khắc chung."
          : "Đã từ chối lời mời khoảnh khắc."
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setRespondingById((currentState) => {
        const nextState = { ...currentState };
        delete nextState[momentId];
        return nextState;
      });
    }
  }

  return (
    <section className="feed-moments-strip" aria-label="Khoảnh Khắc Chung">
      <div className="feed-moments-header">
        <div>
          <h2>Khoảnh Khắc Chung</h2>
          {prioritizedMoments.some((moment) => moment.myStatus === "pending") && (
            <span>Lời mời mới</span>
          )}
        </div>
        <Link to="/moments">Xem tất cả</Link>
      </div>

      <div className="feed-moments-row">
        <Link className="feed-moment-create-card" to="/moments">
          <span aria-hidden="true">+</span>
          <strong>Tạo khoảnh khắc</strong>
        </Link>

        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <span
              key={index}
              className="feed-moment-card skeleton"
              aria-hidden="true"
            />
          ))
        ) : prioritizedMoments.length === 0 ? (
          <div className="feed-moment-empty">
            <strong>Chưa có khoảnh khắc chung.</strong>
            <Link to="/moments">Bắt đầu</Link>
          </div>
        ) : (
          prioritizedMoments.map((moment) => (
            <MomentCard
              key={moment.id}
              moment={moment}
              responding={respondingById[moment.id]}
              onRespond={handleRespond}
            />
          ))
        )}
      </div>

      {error && (
        <div className="feed-moments-error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              setLoading(true);
              getSharedMoments({ limit: 8 })
                .then((data) => setMoments(data.moments || []))
                .catch((error) => setError(error.message))
                .finally(() => setLoading(false));
            }}
          >
            Thử lại
          </button>
        </div>
      )}
    </section>
  );
}
