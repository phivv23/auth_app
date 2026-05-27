import UserProfile from "./UserProfile.jsx";
import { useAuth } from "../context/useAuth.js";

export default function Profile() {
  const { user } = useAuth();

  return <UserProfile profileUserId={user.id} />;
}
