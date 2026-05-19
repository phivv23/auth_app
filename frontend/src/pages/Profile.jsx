import { useState } from "react";
import { useAuth } from "../context/useAuth.js";
import AvatarUpload from "../components/AvatarUpload";

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();

  /**
   * Form update profile.
   * Giá trị ban đầu lấy từ user hiện tại.
   */
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    email: user.email,
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

  return (
    <section className="card">
      <h1>Profile</h1>
      <AvatarUpload />
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
  );
}
