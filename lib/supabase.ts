import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }
  
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (url && key) {
      supabaseInstance = createClient(url, key);
    }
  }
  
  return supabaseInstance;
}

// For client-side usage - gets created on first import in browser
export const supabase = getSupabaseClient();

// Hook for React components that need to wait for client hydration
export function useSupabase() {
  const [client, setClient] = useState<SupabaseClient | null>(supabase);
  
  useEffect(() => {
    if (!client && typeof window !== "undefined") {
      setClient(getSupabaseClient());
    }
  }, [client]);
  
  return client;
}
