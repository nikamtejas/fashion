import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const VALUES = [
  {
    title: "Small ateliers, not mass factories",
    body: "Every piece is made in small batches with Indian ateliers we visit ourselves — no faceless overseas contract manufacturing.",
  },
  {
    title: "Honest pricing",
    body: "No fake \"70% off\" countdowns. The price you see reflects fabric, labour and a fair margin — nothing inflated to be discounted later.",
  },
  {
    title: "Built to last",
    body: "Fabric, fit and finish are checked before anything ships. We'd rather sell you one thing you wear for years than five you wear once.",
  },
];

export const metadata = {
  title: "Our Story — LuxeLoom",
  description: "Why LuxeLoom exists, and how we make what we sell.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Our Story</p>
      <h1 className="font-display mt-2 max-w-2xl text-4xl leading-tight sm:text-5xl">
        Made deliberately, for people who wear things twice.
      </h1>

      <div className="mt-12 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
          <Image
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&q=80"
            alt="LuxeLoom atelier"
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="space-y-5 text-sm leading-relaxed text-foreground/70">
          <p>
            LuxeLoom began with a simple frustration: fast fashion that falls apart, and luxury
            that&rsquo;s priced for someone else&rsquo;s life. We work with small Indian ateliers,
            price transparently, and photograph every piece the way it actually looks — not the
            way a filter wishes it did.
          </p>
          <p>
            Every garment on LuxeLoom is checked for fit, fabric and finish before it reaches your
            door — or your nearest store, whichever you trust more.
          </p>
          <p>
            We&rsquo;re a small team based in India, building a wardrobe brand around pieces meant
            to be worn for years, not seasons.
          </p>
        </div>
      </div>

      <div className="mt-20 grid gap-8 sm:grid-cols-3">
        {VALUES.map((v) => (
          <div key={v.title} className="rounded-2xl border border-border p-6">
            <h2 className="font-display text-lg">{v.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/60">{v.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-20 flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-10 text-center">
        <h2 className="font-display text-2xl">See it in person</h2>
        <p className="max-w-md text-sm text-foreground/60">
          Every piece online is also on the rack at one of our stores — try before you buy, or pick
          up an online order same day.
        </p>
        <Button asChild size="sm" magnetic={false}>
          <Link href="/stores">Find a store</Link>
        </Button>
      </div>
    </div>
  );
}
