import { useState } from "react";
import { useAuth } from "../context/useAuth.js";
import AvatarUpload from "../components/AvatarUpload";
import { getFileUrl } from "../api/client.js";

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();

  /**
   * Form update profile.
   * Giá trị ban đầu lấy từ user hiện tại.
   */
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    email: user.email,
    bio: user.bio || "",
    location: user.location || "",
    website: user.website || "",
  });

  /**
   * Form đổi password.
   */
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

  function handleProfileChange(event) {
    const { name, value } = event.target;

    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
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
      await updateProfile(profileForm);

      setProfileMessage("Cập nhật profile thành công.");
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    /**
     * Validate confirm password ở frontend để UX tốt hơn.
     * Backend vẫn phải validate chính, không được chỉ tin frontend.
     */
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError("Confirm password không khớp.");
      return;
    }

    setSavingPassword(true);

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordMessage("Đổi password thành công.");

      /**
       * Reset password form sau khi đổi thành công.
       */
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

  const currentAvatarUrl = getFileUrl(user.avatarUrl);

  return (
    <div className="profile-settings-page">
      <section className="profile-editor-hero">
        <div className="profile-editor-cover" aria-hidden="true" />

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
            <h1>{user.name}</h1>
            <p>{user.email}</p>
          </div>
        </div>
      </section>

      <div className="profile-settings-layout">
        <aside className="profile-settings-sidebar">
          <AvatarUpload />
        </aside>

        <section className="card profile-settings-card">
      <h1>Profile</h1>
      <p>Trang này cho phép user cập nhật thông tin cá nhân và đổi password.</p>

      <div className="user-box">
        <p>
          <strong>ID:</strong> {user.id}
        </p>

        <p>
          <strong>Name hiện tại:</strong> {user.name}
        </p>

        <p>
          <strong>Email hiện tại:</strong> {user.email}
        </p>

        {user.bio && (
          <p>
            <strong>Bio:</strong> {user.bio}
          </p>
        )}

        {user.location && (
          <p>
            <strong>Location:</strong> {user.location}
          </p>
        )}

        {user.website && (
          <p>
            <strong>Website:</strong>{" "}
            <a href={user.website} target="_blank" rel="noreferrer">
              {user.website}
            </a>
          </p>
        )}
      </div>

      <hr />

      <h2>Update Profile</h2>

      <form onSubmit={handleUpdateProfile} className="form">
        <label>
          Name
          <input
            name="name"
            value={profileForm.name}
            onChange={handleProfileChange}
            placeholder="Tên mới"
          />
        </label>

        <label>
          Email
          <input
            name="email"
            type="email"
            value={profileForm.email}
            onChange={handleProfileChange}
            placeholder="Email mới"
          />
        </label>

        <label>
          Bio
          <textarea
            name="bio"
            value={profileForm.bio}
            onChange={handleProfileChange}
            placeholder="Giới thiệu ngắn về bạn"
            maxLength={500}
            rows={4}
          />
        </label>

        <label>
          Location
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

        {profileMessage && <p className="success">{profileMessage}</p>}
        {profileError && <p className="error">{profileError}</p>}

        <button className="button" disabled={savingProfile}>
          {savingProfile ? "Đang lưu..." : "Lưu profile"}
        </button>
      </form>

      <hr />

      <h2>Change Password</h2>

      <form onSubmit={handleChangePassword} className="form">
        <label>
          Current Password
          <input
            name="currentPassword"
            type="password"
            value={passwordForm.currentPassword}
            onChange={handlePasswordChange}
            placeholder="Password hiện tại"
          />
        </label>

        <label>
          New Password
          <input
            name="newPassword"
            type="password"
            value={passwordForm.newPassword}
            onChange={handlePasswordChange}
            placeholder="Password mới"
          />
        </label>

        <label>
          Confirm New Password
          <input
            name="confirmNewPassword"
            type="password"
            value={passwordForm.confirmNewPassword}
            onChange={handlePasswordChange}
            placeholder="Nhập lại password mới"
          />
        </label>

        {passwordMessage && <p className="success">{passwordMessage}</p>}
        {passwordError && <p className="error">{passwordError}</p>}

        <button className="button danger" disabled={savingPassword}>
          {savingPassword ? "Đang đổi password..." : "Đổi password"}
        </button>
      </form>
        </section>
      </div>
    </div>
  );
}
