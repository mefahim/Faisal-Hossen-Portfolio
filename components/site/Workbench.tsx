import Image from "next/image";
import { ArrowDownRight, ScanLine } from "lucide-react";

const signals = [
  { number: "01", label: "Frame the problem", position: "signal-one" },
  { number: "02", label: "Find the useful next step", position: "signal-two" },
  { number: "03", label: "Build for real people", position: "signal-three" },
];

export function Workbench() {
  return (
    <div className="workbench" aria-label="Faisal Hossen workbench: a visual summary of his problem-solving approach">
      <div className="workbench-topline">
        <span className="status-dot" aria-hidden="true" />
        <span>Workbench / thinking in public</span>
        <span className="workbench-id">HQ—001</span>
      </div>
      <div className="workbench-grid">
        <div className="workbench-photo-wrap">
          <Image
            className="workbench-photo"
            src="/assets/faisal-workbench.jpg"
            alt="Faisal Hossen standing outdoors in a navy shirt"
            fill
            sizes="(max-width: 768px) 88vw, 39vw"
            priority
          />
          <span className="photo-caption">Real person. Real curiosity.</span>
        </div>
        <div className="workbench-notes">
          <div className="workbench-note-head">
            <ScanLine aria-hidden="true" size={18} />
            <span>How a problem becomes a product</span>
          </div>
          <p className="workbench-note-title">Less noise. Better decisions.</p>
          <div className="signal-list">
            {signals.map((signal) => (
              <div className={`signal ${signal.position}`} key={signal.number}>
                <span className="signal-number">{signal.number}</span>
                <span>{signal.label}</span>
              </div>
            ))}
          </div>
          <div className="workbench-footer">
            <span>Design + build</span>
            <ArrowDownRight aria-hidden="true" size={19} />
          </div>
        </div>
      </div>
    </div>
  );
}
