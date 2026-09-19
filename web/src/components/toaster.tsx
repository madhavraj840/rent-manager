"use client";

import { useEffect, useState } from "react";

/** Show a short confirmation from anywhere: toast("Saved"). */
export const toast = (message: string) => window.dispatchEvent(new CustomEvent("app:toast", { detail: message }));

// One live region for the whole app, so messages survive the component that raised them.
export function Toaster() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 5000);
    };
    window.addEventListener("app:toast", show);
    return () => { window.removeEventListener("app:toast", show); clearTimeout(timer); };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {message && <p className="max-w-md rounded-md bg-fg px-4 py-2.5 text-sm text-bg">{message}</p>}
    </div>
  );
}
