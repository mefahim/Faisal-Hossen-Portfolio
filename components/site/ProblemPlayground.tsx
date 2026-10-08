"use client";

import { ArrowRight, Check, CircleDot } from "lucide-react";
import { useState } from "react";
import { problemStates as fileProblemStates } from "@/content/site";
import type { PublicSettings } from "@/lib/server/content/public";

export function ProblemPlayground({ problemStates = fileProblemStates }: { problemStates?: PublicSettings["problemStates"] }) {
  const [selectedId, setSelectedId] = useState(problemStates[0].id);
  const selected = problemStates.find((problem) => problem.id === selectedId) ?? problemStates[0];

  return (
    <div className="problem-playground">
      <div className="problem-options" role="tablist" aria-label="Choose a problem to explore">
        {problemStates.map((problem) => {
          const active = problem.id === selected.id;
          return (
            <button
              className={`problem-chip ${active ? "is-active" : ""}`}
              key={problem.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="problem-response"
              onClick={() => setSelectedId(problem.id)}
            >
              <CircleDot aria-hidden="true" size={14} />
              {problem.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="problem-response" id="problem-response" role="tabpanel" tabIndex={0}>
        <div className="response-kicker">
          <span className="eyebrow">A useful place to start</span>
          <span className="response-state"><Check aria-hidden="true" size={14} /> Selected</span>
        </div>
        <h3>{selected.label}</h3>
        <p className="response-diagnosis">{selected.diagnosis}</p>
        <div className="response-next">
          <div>
            <span className="eyebrow">Recommendation</span>
            <p>{selected.recommendation}</p>
          </div>
          <div>
            <span className="eyebrow">Next step</span>
            <p>{selected.nextStep}</p>
          </div>
        </div>
        <a className="inline-link" href="#contact">
          Talk through the problem <ArrowRight aria-hidden="true" size={16} />
        </a>
      </div>
    </div>
  );
}
