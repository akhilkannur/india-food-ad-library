import { redirect } from "next/navigation";
import { ReviewQueue } from "@/components/review-queue";
import { SiteHeader } from "@/components/site-header";
import { isAdminAuthenticated } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { getAds } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const ads = await getAds();

  return (
    <>
      <SiteHeader admin />
      <main className="admin-shell">
        <header className="admin-heading">
          <h1>Review queue</h1>
          <p>Approve only records with a valid source, legible creative and useful classification. Approved ads appear in the public library immediately.</p>
        </header>
        <ReviewQueue initialAds={ads} demoMode={isDemoMode} />
      </main>
    </>
  );
}
