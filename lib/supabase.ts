import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

// Create a mock that satisfies SupabaseClient type for SSR/build
const createMockClient = (): any => {
  const mockChain: any = {
    select: () => mockChain,
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
    eq: () => mockChain,
    in: () => Promise.resolve({ data: null, error: null }),
    order: () => mockChain,
    limit: () => mockChain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    gt: () => mockChain,
    gte: () => mockChain,
    lt: () => mockChain,
    lte: () => mockChain,
    neq: () => mockChain,
    is: () => mockChain,
    like: () => mockChain,
    ilike: () => mockChain,
    cs: () => mockChain,
    cd: () => mockChain,
    ov: () => mockChain,
    sl: () => mockChain,
    sr: () => mockChain,
    nxl: () => mockChain,
    nxr: () => mockChain,
    adj: () => mockChain,
    match: () => mockChain,
    not: () => mockChain,
    or: () => mockChain,
    and: () => mockChain,
    filter: () => mockChain,
    range: () => mockChain,
    then: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
  };

  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      signUp: () => Promise.resolve({ data: null, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      updateUser: () => Promise.resolve({ data: null, error: null }),
    },
    from: () => mockChain,
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        download: () => Promise.resolve({ data: null, error: null }),
        remove: () => Promise.resolve({ data: null, error: null }),
        list: () => Promise.resolve({ data: null, error: null }),
      }),
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
      subscribe: () => {},
    }),
    removeChannel: () => {},
  };
};

let supabaseInstance: SupabaseClient | null = null;
let mockInstance: any = null;

function getSupabaseClient(): SupabaseClient | any {
  // Return mock during SSR/build
  if (typeof window === "undefined") {
    if (!mockInstance) {
      mockInstance = createMockClient();
    }
    return mockInstance;
  }
  
  // Return real client in browser
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    
    if (url && key) {
      supabaseInstance = createClient(url, key);
    } else {
      // Fallback to mock if env vars missing
      if (!mockInstance) {
        mockInstance = createMockClient();
      }
      return mockInstance;
    }
  }
  
  return supabaseInstance;
}

// Export singleton - always returns a usable object
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
