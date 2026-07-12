import { Suspense } from "react";
import { ShopClient } from "./ShopClient";

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopClient />
    </Suspense>
  );
}
