import Link from "next/link";
import Image from "next/image";

const TILES = [
  {
    label: "Women",
    href: "/shop?category=women",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80",
    span: "md:col-span-3 md:row-span-2",
  },
  {
    label: "Men",
    href: "/shop?category=men",
    image: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=1200&q=80",
    span: "md:col-span-3 md:row-span-2",
  },
  {
    label: "Accessories",
    href: "/shop?category=accessories",
    image: "https://images.unsplash.com/photo-1524532787116-e70228437bbe?w=900&q=80",
    span: "md:col-span-2 md:row-span-1",
  },
  {
    label: "Footwear",
    href: "/shop?category=footwear",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900&q=80",
    span: "md:col-span-2 md:row-span-1",
  },
];

export function CategoryTiles() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Shop by Category</p>
        <h2 className="font-display mt-2 text-3xl sm:text-4xl">Find your edit</h2>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[180px]">
          {TILES.map((tile) => (
            <Link
              key={tile.label}
              href={tile.href}
              className={`group relative overflow-hidden rounded-2xl ${tile.span}`}
            >
              <Image
                src={tile.image}
                alt={tile.label}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <span className="font-display absolute bottom-5 left-5 text-2xl text-ivory">{tile.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
