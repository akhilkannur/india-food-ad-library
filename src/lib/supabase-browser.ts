import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hvdkljbvlixpucrqjpqg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UYe9zKdadgRcKRo5HnoWeA_8UVG2Uxl";

export const supabaseBrowser = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
