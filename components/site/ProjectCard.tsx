import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/content/projects";

type ProjectCardProps = {
  project: Project;
  featured?: boolean;
};

export function ProjectCard({ project, featured = false }: ProjectCardProps) {
  return (
    <article className={`project-card${featured ? " project-card-featured" : ""}`}>
      <Link className="project-card-image" href={`/work/${project.slug}`} aria-label={`Read the ${project.title} case study`}>
        <Image
          src={project.image}
          alt={project.imageAlt}
          fill
          sizes={featured ? "(max-width: 800px) 100vw, 66vw" : "(max-width: 800px) 100vw, 33vw"}
          className="project-card-image-content"
        />
        <span className="project-card-index">{project.number}</span>
        <span className="project-card-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </Link>
      <div className="project-card-body">
        <div className="project-card-heading">
          <div>
            <p className="eyebrow">{project.category}</p>
            <h3><Link href={`/work/${project.slug}`}>{project.title}</Link></h3>
          </div>
          <span className="project-card-type">{project.type}</span>
        </div>
        <p className="project-card-summary">{project.summary}</p>
        <div className="project-tags" aria-label={`${project.title} focus areas`}>
          {project.focus.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <Link className="inline-link project-card-link" href={`/work/${project.slug}`}>
          <span>Read the project note</span><ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </article>
  );
}
