import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { getFileUrl } from "../api/client.js";
import AvatarUpload from "../components/AvatarUpload";
import CoverUpload from "../components/CoverUpload";
import { useAuth } from "../context/useAuth.js";

const privacyOptions = [
  {
    value: "public",
    title: "Công khai",
    description:
      "Mọi người có thể xem trang cá nhân và bài viết công khai của bạn.",
  },
  {
    value: "followers",
    title: "Người theo dõi",
    description:
      "Chỉ người đang theo dõi bạn và bạn bè có thể xem đầy đủ trang cá nhân.",
  },
  {
    value: "friends",
    title: "Bạn bè",
    description:
      "Chỉ bạn bè được xem thông tin trang cá nhân và danh sách nội dung.",
  },
  {
    value: "only_me",
    title: "Chỉ mình tôi",
    description:
      "Ẩn trang cá nhân với người khác, phù hợp khi bạn muốn tạm nghỉ.",
  },
];

const settingSections = [
  { id: "overview", label: "Tổng quan", icon: "T" },
  { id: "personal", label: "Thông tin cá nhân", icon: "C" },
  { id: "privacy", label: "Quyền riêng tư", icon: "R" },
  { id: "security", label: "Mật khẩu và bảo mật", icon: "B" },
  { id: "account", label: "Tài khoản", icon: "A" },
];

function getPrivacyLabel(value) {
  return (
    privacyOptions.find((option) => option.value === value)?.title ||
    "Công khai"
  );
}

function getAccountStatusLabel(status) {
  if (status === "suspended") {
    return "Đang bị giới hạn";
  }

  if (status === "banned") {
    return "Bị cấm đăng nhập";
  }

  return "Đang hoạt động";
}

function buildProfileForm(user) {
  return {
    name: user.name,
    email: user.email,
    bio: user.bio || "",
    location: user.location || "",
    website: user.website || "",
    profilePrivacy: user.profilePrivacy || "public",
  };
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, updateProfile, changePassword, logout } = useAuth();

  const [profileForm, setProfileForm] = useState(() => buildProfileForm(user));

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [quickActionSaving, setQuickActionSaving] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  function handleProfileChange(event) {
    const { name, value } = event.target;

    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function goToSection(sectionId) {
    setActiveSection(sectionId);
    document.getElementById(`settings-${sectionId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;

    setPasswordForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleUpdateProfile(event) {
    event.preventDefault();

    setProfileMessage("");
    setProfileError("");
    setSavingProfile(true);

    try {
      const updatedUser = await updateProfile(profileForm);
      setProfileForm(buildProfileForm(updatedUser));
      setProfileMessage("Đã cập nhật thông tin tài khoản.");
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveProfileWithPrivacy(profilePrivacy, message) {
    setProfileMessage("");
    setProfileError("");
    setQuickActionSaving(profilePrivacy);

    try {
      const updatedForm = {
        ...profileForm,
        profilePrivacy,
      };

      const updatedUser = await updateProfile(updatedForm);
      setProfileForm(buildProfileForm(updatedUser));
      setProfileMessage(message);
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setQuickActionSaving("");
    }
  }

  async function handlePrivacySubmit(event) {
    event.preventDefault();
    await saveProfileWithPrivacy(
      profileForm.profilePrivacy,
      "Đã cập nhật quyền riêng tư trang cá nhân."
    );
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSavingPassword(true);

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordMessage("Đã đổi mật khẩu.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logout();
      navigate("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  const currentAvatarUrl = getFileUrl(user.avatarUrl);
  const currentCoverUrl = getFileUrl(user.coverUrl);
  const currentPrivacy = profileForm.profilePrivacy;
  const isProfileLocked = currentPrivacy === "only_me";
  const accountStatus = user.accountStatus || "active";
  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("vi-VN")
    : "Chưa rõ";

  return (
    <div className="profile-settings-page account-settings-page">
      <section className="profile-editor-hero">
        <div className="profile-editor-cover" aria-hidden="true">
          {currentCoverUrl && (
            <img className="profile-cover-image" src={currentCoverUrl} alt="" />
          )}
        </div>

        <div className="profile-editor-summary">
          {currentAvatarUrl ? (
            <img
              className="profile-editor-avatar"
              src={currentAvatarUrl}
              alt={user.name}
            />
          ) : (
            <div className="profile-editor-avatar profile-avatar-fallback">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}

          <div>
            <h1>Trung tâm tài khoản</h1>
            <p>
              {user.email} · {getAccountStatusLabel(accountStatus)}
            </p>
          </div>
        </div>
      </section>

      <div className="profile-settings-layout">
        <aside className="profile-settings-sidebar account-settings-sidebar">
          <section className="profile-panel settings-menu-panel">
            <div className="settings-user-card">
              {currentAvatarUrl ? (
                <img src={currentAvatarUrl} alt={user.name} />
              ) : (
                <span>{user.name?.charAt(0)?.toUpperCase() || "U"}</span>
              )}
              <div>
                <strong>{user.name}</strong>
                <small>{getPrivacyLabel(currentPrivacy)}</small>
              </div>
            </div>

            <nav className="settings-section-nav" aria-label="Cài đặt tài khoản">
              {settingSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={activeSection === section.id ? "active" : ""}
                  onClick={() => goToSection(section.id)}
                >
                  <span aria-hidden="true">{section.icon}</span>
                  {section.label}
                </button>
              ))}
            </nav>
          </section>

          <AvatarUpload />
          <CoverUpload />
        </aside>

        <div className="account-settings-content">
          <section
            id="settings-overview"
            className="profile-panel account-settings-section"
          >
            <div className="settings-section-header">
              <div>
                <span className="settings-kicker">Tổng quan</span>
                <h2>Tài khoản của bạn</h2>
              </div>
              <span className={`account-status-pill ${accountStatus}`}>
                {getAccountStatusLabel(accountStatus)}
              </span>
            </div>

            <div className="settings-overview-list">
              <div>
                <span>Email đăng nhập</span>
                <strong>{user.email}</strong>
              </div>
              <div>
                <span>Quyền riêng tư hiện tại</span>
                <strong>{getPrivacyLabel(currentPrivacy)}</strong>
              </div>
              <div>
                <span>Ngày tham gia</span>
                <strong>{joinedDate}</strong>
              </div>
            </div>

            <div className="settings-quick-actions">
              <Link className="button" to="/profile">
                Xem trang cá nhân
              </Link>
              <Link className="button secondary" to="/messages">
                Mở tin nhắn
              </Link>
              <Link className="button secondary" to="/reports">
                Báo cáo của tôi
              </Link>
            </div>
          </section>

          <section
            id="settings-personal"
            className="profile-panel account-settings-section"
          >
            <div className="settings-section-header">
              <div>
                <span className="settings-kicker">Thông tin cá nhân</span>
                <h2>Tên, email và giới thiệu</h2>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="form settings-form">
              <div className="settings-form-grid">
                <label>
                  Tên hiển thị
                  <input
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileChange}
                    placeholder="Tên hiển thị"
                  />
                </label>

                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    value={profileForm.email}
                    onChange={handleProfileChange}
                    placeholder="Email"
                  />
                </label>
              </div>

              <label>
                Giới thiệu
                <textarea
                  name="bio"
                  value={profileForm.bio}
                  onChange={handleProfileChange}
                  placeholder="Giới thiệu ngắn về bạn"
                  maxLength={500}
                  rows={4}
                />
              </label>

              <div className="settings-form-grid">
                <label>
                  Địa điểm
                  <input
                    name="location"
                    value={profileForm.location}
                    onChange={handleProfileChange}
                    placeholder="Bạn đang ở đâu?"
                    maxLength={100}
                  />
                </label>

                <label>
                  Website
                  <input
                    name="website"
                    value={profileForm.website}
                    onChange={handleProfileChange}
                    placeholder="https://example.com"
                    maxLength={255}
                  />
                </label>
              </div>

              {profileMessage && <p className="success">{profileMessage}</p>}
              {profileError && <p className="error">{profileError}</p>}

              <div className="settings-form-actions">
                <button className="button" disabled={savingProfile}>
                  {savingProfile ? "Đang lưu..." : "Lưu thông tin"}
                </button>
              </div>
            </form>
          </section>

          <section
            id="settings-privacy"
            className="profile-panel account-settings-section"
          >
            <div className="settings-section-header">
              <div>
                <span className="settings-kicker">Quyền riêng tư</span>
                <h2>Ai có thể xem trang cá nhân của bạn</h2>
              </div>
              <strong>{getPrivacyLabel(currentPrivacy)}</strong>
            </div>

            <form
              onSubmit={handlePrivacySubmit}
              className="settings-privacy-form"
            >
              <div className="privacy-option-grid">
                {privacyOptions.map((option) => (
                  <label
                    key={option.value}
                    className={
                      currentPrivacy === option.value
                        ? "privacy-option active"
                        : "privacy-option"
                    }
                  >
                    <input
                      type="radio"
                      name="profilePrivacy"
                      value={option.value}
                      checked={currentPrivacy === option.value}
                      onChange={handleProfileChange}
                    />
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>

              {profileMessage && <p className="success">{profileMessage}</p>}
              {profileError && <p className="error">{profileError}</p>}

              <div className="settings-form-actions">
                <button className="button" disabled={Boolean(quickActionSaving)}>
                  {quickActionSaving ? "Đang lưu..." : "Lưu quyền riêng tư"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={Boolean(quickActionSaving)}
                  onClick={() =>
                    saveProfileWithPrivacy(
                      isProfileLocked ? "public" : "only_me",
                      isProfileLocked
                        ? "Đã mở lại trang cá nhân công khai."
                        : "Đã ẩn trang cá nhân với người khác."
                    )
                  }
                >
                  {isProfileLocked ? "Mở lại trang cá nhân" : "Ẩn trang cá nhân"}
                </button>
              </div>
            </form>
          </section>

          <section
            id="settings-security"
            className="profile-panel account-settings-section"
          >
            <div className="settings-section-header">
              <div>
                <span className="settings-kicker">Mật khẩu và bảo mật</span>
                <h2>Đăng nhập và mật khẩu</h2>
              </div>
            </div>

            <div className="settings-security-grid">
              <form onSubmit={handleChangePassword} className="form settings-form">
                <label>
                  Mật khẩu hiện tại
                  <input
                    name="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                    placeholder="Mật khẩu hiện tại"
                    autoComplete="current-password"
                  />
                </label>

                <label>
                  Mật khẩu mới
                  <input
                    name="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Mật khẩu mới"
                    autoComplete="new-password"
                  />
                </label>

                <label>
                  Xác nhận mật khẩu mới
                  <input
                    name="confirmNewPassword"
                    type="password"
                    value={passwordForm.confirmNewPassword}
                    onChange={handlePasswordChange}
                    placeholder="Nhập lại mật khẩu mới"
                    autoComplete="new-password"
                  />
                </label>

                {passwordMessage && <p className="success">{passwordMessage}</p>}
                {passwordError && <p className="error">{passwordError}</p>}

                <div className="settings-form-actions">
                  <button className="button danger" disabled={savingPassword}>
                    {savingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
                  </button>
                </div>
              </form>

              <div className="settings-session-panel">
                <h3>Phiên đăng nhập hiện tại</h3>
                <dl>
                  <div>
                    <dt>Tài khoản</dt>
                    <dd>{user.email}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>{getAccountStatusLabel(accountStatus)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="button secondary"
                  disabled={loggingOut}
                  onClick={handleLogout}
                >
                  {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                </button>
              </div>
            </div>
          </section>

          <section
            id="settings-account"
            className="profile-panel account-settings-section"
          >
            <div className="settings-section-header">
              <div>
                <span className="settings-kicker">Tài khoản</span>
                <h2>Quản lý nội dung và hiển thị</h2>
              </div>
            </div>

            <div className="settings-account-actions">
              <Link to="/my-posts">
                <strong>Bài viết của tôi</strong>
                <span>Xem và chỉnh sửa nội dung bạn đã đăng.</span>
              </Link>
              <Link to="/saved">
                <strong>Mục đã lưu</strong>
                <span>Quản lý những bài viết bạn đã lưu.</span>
              </Link>
              <Link to="/reports">
                <strong>Báo cáo của tôi</strong>
                <span>Theo dõi các báo cáo đã gửi cho đội ngũ quản trị.</span>
              </Link>
            </div>

            {profileMessage && <p className="success">{profileMessage}</p>}
            {profileError && <p className="error">{profileError}</p>}

            <div className="settings-danger-panel">
              <div>
                <h3>
                  {isProfileLocked
                    ? "Trang cá nhân đang ẩn"
                    : "Ẩn trang cá nhân tạm thời"}
                </h3>
                <p>
                  Chuyển trang cá nhân về "Chỉ mình tôi" để giảm hiển thị với
                  người khác mà không làm mất tài khoản.
                </p>
              </div>
              <button
                type="button"
                className={isProfileLocked ? "button" : "button danger"}
                disabled={Boolean(quickActionSaving)}
                onClick={() =>
                  saveProfileWithPrivacy(
                    isProfileLocked ? "public" : "only_me",
                    isProfileLocked
                      ? "Đã mở lại trang cá nhân công khai."
                      : "Đã ẩn trang cá nhân với người khác."
                  )
                }
              >
                {isProfileLocked ? "Mở lại trang cá nhân" : "Ẩn trang cá nhân"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
