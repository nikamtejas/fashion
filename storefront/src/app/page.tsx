import { listProducts } from "@/lib/products";
import { ProductCard } from "@/components/products/ProductCard";

export default async function Home() {
  const { items } = await listProducts({ limit: 24 });

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/50 dark:text-white/50">
          Coming soon
        </p>
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">
          The catalog is on its way.
        </h1>
        <p className="mt-4 max-w-md text-base text-black/60 dark:text-white/60 sm:text-lg">
          We&apos;re putting together the collection. Create an account so you&apos;re ready
          the moment it drops.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">New In</h1>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 4} />
        ))}
      </div>
    </div>
  );
}
