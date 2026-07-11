import Image from "next/image";

export function BrandStory() {
  return (
    <section className="py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
          <Image
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&q=80"
            alt="LuxeLoom atelier"
            fill
            className="object-cover"
          />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Our Story</p>
          <h2 className="font-display mt-2 max-w-md text-3xl leading-tight sm:text-4xl">
            Made deliberately, for people who wear things twice.
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/60">
            LuxeLoom began with a simple frustration: fast fashion that falls apart, and luxury
            that&rsquo;s priced for someone else&rsquo;s life. We work with small Indian ateliers,
            price transparently, and photograph every piece the way it actually looks — not the
            way a filter wishes it did.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground/60">
            Every garment on LuxeLoom is checked for fit, fabric and finish before it reaches your
            door — or your nearest store, whichever you trust more.
          </p>
        </div>
      </div>
    </section>
  );
}
