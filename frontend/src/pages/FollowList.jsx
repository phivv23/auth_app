import { useParams } from "react-router";

import FollowListPanel from "../components/FollowListPanel";

export default function FollowList({ type }) {
  const { id } = useParams();

  return (
    <div className="container">
      <FollowListPanel userId={id} type={type} />
    </div>
  );
}
