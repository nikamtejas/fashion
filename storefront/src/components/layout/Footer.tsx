export function Footer() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 text-sm sm:grid-cols-3 sm:px-6 md:grid-cols-4">
        <div>
          <h3 className="mb-3 font-semibold">Shop</h3>
          <ul className="space-y-2 text-black/60 dark:text-white/60">
            <li>New In</li>
            <li>Best Sellers</li>
            <li>Sale</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Help</h3>
          <ul className="space-y-2 text-black/60 dark:text-white/60">
            <li>Track Order</li>
            <li>Returns</li>
            <li>Contact Us</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Company</h3>
          <ul className="space-y-2 text-black/60 dark:text-white/60">
            <li>About</li>
            <li>Careers</li>
          </ul>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <h3 className="mb-3 font-semibold">FASHION.CO</h3>
          <p className="text-black/60 dark:text-white/60">
            Mobile-first fashion, shipped worldwide.
          </p>
        </div>
      </div>
      <div className="border-t border-black/10 px-4 py-4 text-center text-xs text-black/50 dark:border-white/10 dark:text-white/50">
        © {new Date().getFullYear()} FASHION.CO. All rights reserved.
      </div>
    </footer>
  );
}
