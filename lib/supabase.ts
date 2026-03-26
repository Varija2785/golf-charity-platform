import { createClient } from "@supabase/supabase-js";

let supabase: any;

if (typeof window !== "undefined") {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
} else {
  supabase = null;
}

export { supabase };
