import { useState } from "react";
import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import AvatarUpload from "../components/AvatarUpload";
import CoverUpload from "../components/CoverUpload";
import { useAuth } from "../context/useAuth.js";

export default function Settings() {
  const { user, updateProfile, changePassword } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name: user.name,
    email: user.email,
    bio: user.bio || "",
    location: user.location || "",
    website: user.website || "",
  });

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
      setProfileMessage("Da cap nhat profile.");
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

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError("Mat khau xac nhan khong khop.");
      return;
    }

    setSavingPassword(true);

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordMessage("Da doi mat khau.");
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
  const currentCoverUrl = getFileUrl(user.coverUrl);

  return (
    <div className="profile-settings-page">
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
            <h1>Cai dat tai khoan</h1>
            <p>{user.email}</p>
          </div>
        </div>
      </section>

      <div className="profile-settings-layout">
        <aside className="profile-settings-sidebar">
          <section className="profile-panel">
            <h2>Profile</h2>
            <p className="muted">Cap nhat anh dai dien, anh bia va thong tin ca nhan.</p>
            <Link className="button secondary" to="/profile">
              Xem trang profile
            </Link>
          </section>

          <AvatarUpload />
          <CoverUpload />
        </aside>

        <section className="card profile-settings-card">
          <h1>Thong tin ca nhan</h1>

          <form onSubmit={handleUpdateProfile} className="form">
            <label>
              Ten
              <input
                name="name"
                value={profileForm.name}
                onChange={handleProfileChange}
                placeholder="Ten hien thi"
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

            <label>
              Bio
              <textarea
                name="bio"
                value={profileForm.bio}
                onChange={handleProfileChange}
                placeholder="Gioi thieu ngan ve ban"
                maxLength={500}
                rows={4}
              />
            </label>

            <label>
              Dia diem
              <input
                name="location"
                value={profileForm.location}
                onChange={handleProfileChange}
                placeholder="Ban dang o dau?"
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
              {savingProfile ? "Dang luu..." : "Luu thay doi"}
            </button>
          </form>

          <hr />

          <h2>Mat khau</h2>

          <form onSubmit={handleChangePassword} className="form">
            <label>
              Mat khau hien tai
              <input
                name="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Mat khau hien tai"
              />
            </label>

            <label>
              Mat khau moi
              <input
                name="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                placeholder="Mat khau moi"
              />
            </label>

            <label>
              Xac nhan mat khau moi
              <input
                name="confirmNewPassword"
                type="password"
                value={passwordForm.confirmNewPassword}
                onChange={handlePasswordChange}
                placeholder="Nhap lai mat khau moi"
              />
            </label>

            {passwordMessage && <p className="success">{passwordMessage}</p>}
            {passwordError && <p className="error">{passwordError}</p>}

            <button className="button danger" disabled={savingPassword}>
              {savingPassword ? "Dang doi mat khau..." : "Doi mat khau"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
