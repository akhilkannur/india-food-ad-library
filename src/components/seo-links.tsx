import Link from "next/link";

export type SeoLinkGroup = {
  title: string;
  links: Array<{ href: string; label: string }>;
};

/** Server-rendered link groups so crawlers can reach every landing page. */
export function SeoLinks({ heading, groups }: { heading?: string; groups: SeoLinkGroup[] }) {
  const visible = groups.filter((group) => group.links.length);
  if (!visible.length) return null;
  return (
    <section className="seo-links" aria-label={heading || "Browse more ads"}>
      {heading && <h2>{heading}</h2>}
      <div className="seo-links__groups">
        {visible.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </section>
  );
}
