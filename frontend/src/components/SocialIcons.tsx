export const SOCIAL_LINKS = [
  {
    href: "https://www.raimonvibe.eu/",
    label: "Website",
    iconClass: "icon solid fa-globe",
  },
  {
    href: "https://x.com/raimonvibe/",
    label: "X",
    iconClass: "icon brands fa-x-twitter",
  },
  {
    href: "https://www.youtube.com/channel/UCDGDNuYb2b2Ets9CYCNVbuA/videos/",
    label: "YouTube",
    iconClass: "icon brands fa-youtube",
  },
  {
    href: "https://www.tiktok.com/@raimonvibe/",
    label: "TikTok",
    iconClass: "icon brands fa-tiktok",
  },
  {
    href: "https://www.instagram.com/raimonvibe/",
    label: "Instagram",
    iconClass: "icon brands fa-instagram",
  },
  {
    href: "https://medium.com/@raimonvibe/",
    label: "Medium",
    iconClass: "icon brands fa-medium-m",
  },
  {
    href: "https://github.com/raimonvibe/",
    label: "GitHub",
    iconClass: "icon brands fa-github",
  },
  {
    href: "https://www.linkedin.com/in/raimonvibe/",
    label: "LinkedIn",
    iconClass: "icon brands fa-linkedin-in",
  },
  {
    href: "https://www.facebook.com/profile.php?id=61563450007849",
    label: "Facebook",
    iconClass: "icon brands fa-facebook-f",
  },
] as const;

export function SocialIcons() {
  return (
    <ul className="social-icons" aria-label="Social links">
      {SOCIAL_LINKS.map(({ href, label, iconClass }) => (
        <li key={href}>
          <a
            href={href}
            className={iconClass}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
          >
            <span className="label">{label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
