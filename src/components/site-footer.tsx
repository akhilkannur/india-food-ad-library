import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer shell">
      <p>
        <strong>F&amp;B Ad Library</strong> — a swipe file of 1,000+ Indian food &amp; beverage Meta ads for DTC
        and brand teams looking for hooks, formats and campaign inspiration. Updated weekly.
      </p>
      <nav aria-label="Footer">
        <Link href="/#collections">Browse by format</Link>
        {" · "}
        <Link href="/#all-ads">All ads</Link>
      </nav>
      <p>An ad research project by <a href="https://lisnagency.online" target="_blank" rel="noreferrer">LISN Agency</a>, a creative studio for D2C brands.</p>
      <p>Source creatives remain the property of their advertisers.</p>
      <p>Meta ad creative · source links included where available</p>
    </footer>
  );
}
