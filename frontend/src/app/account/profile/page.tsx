import { Suspense } from "react";
import ProfileTabs from "./ProfileTabs";

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileTabs />
    </Suspense>
  );
}
