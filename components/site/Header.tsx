import { getPublishedNavigation, getPublishedSettings } from "@/lib/server/content/public";
import { HeaderInteractive } from "./HeaderInteractive";

export async function Header() {
  const [settings, links] = await Promise.all([getPublishedSettings(), getPublishedNavigation("header")]);
  return <HeaderInteractive links={links} siteName={settings.site.name} />;
}
