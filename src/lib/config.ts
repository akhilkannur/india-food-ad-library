export const hasDatabase = Boolean(
  process.env["NEXT_PUBLIC_SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"],
);

export const hasAdminCredentials = Boolean(
  process.env["ADMIN_EMAIL"] && process.env["ADMIN_PASSWORD"] && process.env["AUTH_SECRET"],
);

export const isDemoMode = !hasDatabase;
