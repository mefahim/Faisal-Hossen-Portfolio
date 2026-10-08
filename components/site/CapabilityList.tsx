import { ArrowUpRight } from "lucide-react";
import { capabilities } from "@/content/site";

export function CapabilityList() {
  return (
    <div className="capability-list" aria-label="Fahim capabilities">
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
