// Shown on every page: the prototype's honesty notice (synthetic data, not a legal record).
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-card px-4 py-5 text-sm text-ink-soft">
      <div className="mx-auto max-w-3xl space-y-1">
        <p>
          সব তথ্য কাল্পনিক (সিনথেটিক)। এটি ঝুঁকি যাচাই, আইনি মালিকানার রায় নয়। সাহায্যের জন্য ১৬১২২ নম্বরে
          কল করুন।
        </p>
        <p lang="en">
          All data is synthetic. This is a risk check on records, not a legal ruling on ownership.
          For help, call 16122.
        </p>
      </div>
    </footer>
  );
}
