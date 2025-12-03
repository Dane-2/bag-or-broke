import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

const hasValidCredentials = supabaseUrl && supabaseKey && 
  supabaseUrl.startsWith('http') && 
  supabaseKey.length > 20; // Basic validation

if (!hasValidCredentials) {
  console.warn("⚠️ Missing or invalid Supabase environment variables. Multiplayer features will not work. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY");
}

// Create a mock client that prevents all WebSocket connections
const createMockClient = () => {
  const mockChannel = {
    on: () => mockChannel,
    subscribe: () => {},
  };
  
  return {
    from: () => ({
      select: () => ({ 
        eq: () => ({ data: null, error: { message: "Supabase not configured" } }),
        order: () => ({ data: null, error: { message: "Supabase not configured" } }),
        maybeSingle: () => ({ data: null, error: { message: "Supabase not configured" } }),
      }),
      insert: () => ({ 
        select: () => ({ 
          single: () => ({ data: null, error: { message: "Supabase not configured" } }),
        }),
      }),
      update: () => ({ 
        eq: () => ({ data: null, error: { message: "Supabase not configured" } }),
      }),
      delete: () => ({ 
        eq: () => ({ data: null, error: { message: "Supabase not configured" } }),
      }),
    }),
    channel: () => mockChannel,
    removeChannel: () => {},
    // Add realtime property to prevent initialization
    realtime: {
      setAuth: () => {},
      disconnect: () => {},
    },
  };
};

// Only create real client if we have valid credentials
// Don't disconnect realtime - let it work normally when credentials are valid
export const supabase = hasValidCredentials
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
      realtime: {
        params: {
          apikey: supabaseKey,
        },
      },
    })
  : createMockClient();

// Export flag to check if Supabase is properly configured
export const isSupabaseConfigured = hasValidCredentials;

