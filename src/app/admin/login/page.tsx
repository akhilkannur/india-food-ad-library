import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/login-form";
import { hasAdminCredentials } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="login-page">
      <SiteHeader admin />
      <section className="login-card">
        <div>
          <h1>Admin sign in</h1>
          <p>Review and publish incoming ad records.</p>
        </div>
        <LoginForm configured={hasAdminCredentials} />
      </section>
      <footer className="site-footer shell"><p>Private moderation area</p></footer>
    </main>
  );
}
