import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Supabase sign-in (cloud mode only). The session lives in HttpOnly cookies set by @supabase/ssr.

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Acts as the signed-in person (their cookies). Used for sign-in and to read who is signed in. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(url(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server components can't set cookies; proxy.ts refreshes the session there instead.
        try { for (const { name, value, options } of list) store.set(name, value, options); } catch {}
      },
    },
  });
}

/** Full-access client with the secret key: file storage and admin tasks. Server only, never sent to a browser. */
export const supabaseAdmin = () =>
  createClient(url(), process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

/** The signed-in person, checked against Supabase's signing keys; null when signed out. */
export const authUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const { data } = await (await supabaseServer()).auth.getClaims();
  const c = data?.claims;
  return c?.sub ? { id: c.sub, email: String(c.email ?? "") } : null;
});
