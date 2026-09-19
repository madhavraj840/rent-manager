"use client";

import { Printer } from "lucide-react";

export function PrintBar() {
  return (
    <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 print:hidden">
      <span className="text-sm text-fg-2">Use Print, then “Save as PDF”, to get a PDF you can share.</span>
      <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-hover">
        <Printer size={16} aria-hidden /> Print
      </button>
    </div>
  );
}
