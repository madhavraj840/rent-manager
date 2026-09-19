import { PrintBar } from "./print-bar";

// Printable pages: no app chrome. "Save as PDF" in the browser's print dialog gives the PDF (13 §1).
export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return (
    <div className="min-h-screen bg-bg print:bg-white">
      <PrintBar />
      <main className="mx-auto my-6 w-full max-w-3xl rounded-lg border border-line bg-surface p-8 text-fg print:m-0 print:max-w-none print:border-0 print:p-0 print:text-black">
        {children}
      </main>
    </div>
  );
}
