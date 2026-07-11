const MESSAGES = [
  "Free shipping on orders above ₹2,999",
  "New Drops every Friday",
  "In-store pickup available at 3 LuxeLoom stores",
  "EMI options available at checkout",
];

export function AnnouncementMarquee() {
  const items = [...MESSAGES, ...MESSAGES];
  return (
    <div className="overflow-hidden border-b border-border bg-ink py-2 text-ivory dark:bg-charcoal">
      <div className="flex w-max animate-marquee gap-12 text-xs font-medium uppercase tracking-widest">
        {items.map((msg, i) => (
          <span key={i} className="flex items-center gap-12">
            {msg}
            <span aria-hidden className="text-sienna">
              ✺
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
