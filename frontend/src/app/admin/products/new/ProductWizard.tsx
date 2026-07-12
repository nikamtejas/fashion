"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Stepper } from "@/components/ui/Stepper";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { WizardProduct } from "./types";
import { DetailsStep } from "./DetailsStep";
import { ImagesStep } from "./ImagesStep";
import { PricingStep } from "./PricingStep";
import { ReviewStep } from "./ReviewStep";

const STEPS = [{ label: "Details" }, { label: "Images" }, { label: "Pricing" }, { label: "Review" }];

export function ProductWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const existingId = searchParams.get("id");

  const [step, setStep] = React.useState(0);
  const [product, setProduct] = React.useState<WizardProduct | null>(null);
  const [loading, setLoading] = React.useState(Boolean(existingId));

  const refreshProduct = React.useCallback(async (id: string) => {
    const data = await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${id}`);
    setProduct(data.product);
    return data.product;
  }, []);

  React.useEffect(() => {
    if (!existingId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    refreshProduct(existingId)
      .then((p) => {
        if (p.images.length > 0) setStep(1);
        if (p.pricing?.finalPrice) setStep(2);
      })
      .finally(() => setLoading(false));
  }, [existingId, refreshProduct]);

  function handleCreated(p: WizardProduct) {
    setProduct(p);
    router.replace(`/admin/products/new?id=${p._id}`);
    setStep(1);
  }

  async function handlePublish() {
    if (!product) return;
    try {
      const data = await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${product._id}/publish`, {
        method: "POST",
      });
      setProduct(data.product);
      toast({ title: "Published", description: `${data.product.name} is now live on the storefront.`, variant: "success" });
      router.push("/admin/products");
    } catch (err) {
      toast({ title: "Couldn't publish", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-foreground/50">Loading…</div>;

  return (
    <div>
      <h1 className="font-display text-2xl">{product ? `Editing: ${product.name}` : "New product"}</h1>
      <Stepper steps={STEPS} currentStep={step} className="my-8 max-w-2xl" />

      {step === 0 && <DetailsStep product={product} onSaved={product ? (p) => setProduct(p) : handleCreated} onNext={() => setStep(1)} />}
      {step === 1 && product && (
        <ImagesStep product={product} onProductChange={setProduct} onNext={() => setStep(2)} onBack={() => setStep(0)} />
      )}
      {step === 2 && product && (
        <PricingStep product={product} onProductChange={setProduct} onNext={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && product && (
        <ReviewStep product={product} onProductChange={setProduct} onPublish={handlePublish} onBack={() => setStep(2)} />
      )}
    </div>
  );
}
