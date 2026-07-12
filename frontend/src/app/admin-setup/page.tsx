import { Suspense } from "react";
import AdminSetupForm from "./AdminSetupForm";

export default function AdminSetupPage() {
  return (
    <Suspense fallback={null}>
      <AdminSetupForm />
    </Suspense>
  );
}
