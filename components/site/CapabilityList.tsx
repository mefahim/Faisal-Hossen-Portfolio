import { ArrowUpRight } from "lucide-react";
import { capabilities as fileCapabilities } from "@/content/site";
import type { PublicSettings } from "@/lib/server/content/public";

export function CapabilityList({ capabilities = fileCapabilities }: { capabilities?: PublicSettings["capabilities"] }) {
  return (
    <div className="capability-list" aria-label="Faisal Hossen capabilities">
      {capabilities.map((capability) => (
        <article className="capability-row" key={capability.name}>
          <span className="capability-mark">{capability.mark}</span>
          <div>
            <h3>{capability.name}</h3>
            <p>{capability.detail}</p>
          </div>
          <ArrowUpRight aria-hidden="true" size={18} className="capability-arrow" />
        </article>
      ))}
    </div>
  );
}
