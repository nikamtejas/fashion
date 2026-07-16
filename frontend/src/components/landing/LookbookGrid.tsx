import Image from "next/image";

const LOOKS = [
  { image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80", caption: "Street style, reimagined" },
  { image: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=900&q=80", caption: "Golden hour layering" },
  { image: "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=900&q=80", caption: "Café off-duty" },
  { image: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=900&q=80", caption: "Evening in the city" },
  { image: "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=900&q=80", caption: "Weekend market run" },
  { image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=80", caption: "Studio essentials" },
];

export function LookbookGrid() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Lookbook</p>
        <h2 className="font-display mt-2 text-3xl sm:text-4xl">Styled for real days</h2>

        <div className="mt-10 columns-2 gap-4 sm:columns-3">
          {LOOKS.map((look, i) => (
            <div key={i} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl">
              <Image
                src={look.image}
                alt={look.caption}
                width={600}
                height={i % 2 === 0 ? 750 : 500}
                sizes="(min-width: 640px) 33vw, 50vw"
                className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink/60 via-transparent to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-sm text-ivory">{look.caption}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
