import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import type { Project } from "@/content/projects";

type CaseStudyProps = {
  project: Project;
  nextProject?: Project;
};

export function CaseStudy({ project, nextProject }: CaseStudyProps) {
  return (
    <main className="case-study-page">
      <section className="section-shell case-study-hero">
        <Link className="back-link" href="/work"><ArrowLeft aria-hidden="true" size={16} /> Back to selected work</Link>
        <div className="case-study-heading">
          <div>
            <p className="eyebrow">Project {project.number} / {project.category}</p>
            <h1>{project.title}</h1>
          </div>
          <p className="case-study-intro">{project.summary}</p>
        </div>
        <div className="case-study-meta" aria-label={`${project.title} project details`}>
          <div><span className="meta-label">Type</span><span>{project.type}</span></div>
          <div><span className="meta-label">Role</span><span>{project.role}</span></div>
          <div><span className="meta-label">Technology</span><span>{project.technology.join(" · ")}</span></div>
        </div>
        <div className="case-study-visual">
          <Image src={project.image} alt={project.imageAlt} fill priority sizes="(max-width: 800px) 100vw, 1240px" />
        </div>
        {project.externalUrl ? (
          <a className="external-project-link" href={project.externalUrl} target="_blank" rel="noreferrer">
            <span>{project.externalLabel}</span><ArrowUpRight aria-hidden="true" size={16} />
          </a>
        ) : (
          <p className="verified-note"><span className="status-dot" aria-hidden="true" /> No public live URL was supplied for this project.</p>
        )}
      </section>

      <section className="section-shell case-study-body" aria-label="Case study details">
        <div className="case-study-rail">
          <span className="eyebrow">The working note</span>
          <span className="rail-rule" aria-hidden="true" />
          <span className="rail-caption">A truthful account of the problem, choices, and delivered experience.</span>
        </div>
        <div className="case-study-content">
          <section className="case-study-section" aria-labelledby="challenge-title">
            <p className="eyebrow">01 / {project.challengeLabel}</p>
            <h2 id="challenge-title">The question was how to make the next step clearer.</h2>
            <p>{project.challenge}</p>
          </section>

          <section className="case-study-section case-study-solution" aria-labelledby="solution-title">
            <div>
              <p className="eyebrow">02 / {project.solutionLabel}</p>
              <h2 id="solution-title">The work made the experience easier to understand and use.</h2>
            </div>
            <ul className="solution-list">
              {project.solutions.map((solution) => (
                <li key={solution}><Check aria-hidden="true" size={16} /><span>{solution}</span></li>
              ))}
            </ul>
          </section>

          <section className="case-study-section case-study-approach" aria-labelledby="approach-title">
            <p className="eyebrow">03 / {project.approachLabel}</p>
            <h2 id="approach-title">A system that holds the important details.</h2>
            <p>{project.approach}</p>
          </section>

          <section className="case-study-change" aria-labelledby="change-title">
            <p className="eyebrow">04 / What changed in the experience</p>
            <h2 id="change-title">Less ambiguity. A more deliberate path through the work.</h2>
            <p>{project.experienceChange}</p>
          </section>
        </div>
      </section>

      <section className="section-shell case-study-next" aria-label="Next project">
        <p className="eyebrow">Continue exploring</p>
        {nextProject ? (
          <Link className="next-project-link" href={`/work/${nextProject.slug}`}>
            <span><small>Next project / {nextProject.number}</small>{nextProject.title}</span>
            <ArrowRight aria-hidden="true" size={28} strokeWidth={1.3} />
          </Link>
        ) : (
          <Link className="next-project-link" href="/work">
            <span><small>Back to the index</small>Selected work</span>
            <ArrowRight aria-hidden="true" size={28} strokeWidth={1.3} />
          </Link>
        )}
      </section>
    </main>
  );
}
