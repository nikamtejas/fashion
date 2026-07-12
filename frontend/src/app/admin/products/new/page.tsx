import { Suspense } from "react";
import { ProductWizard } from "./ProductWizard";

export default function NewProductPage() {
  return (
    <Suspense fallback={null}>
      <ProductWizard />
    </Suspense>
  );
}
