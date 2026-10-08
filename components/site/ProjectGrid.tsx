import type { Project } from "@/content/projects";
import { ProjectCard } from "./ProjectCard";

type ProjectGridProps = {
  projects: Project[];
  className?: string;
};

export function ProjectGrid({ projects, className = "" }: ProjectGridProps) {
  return (
    <div className={`project-grid ${className}`.trim()}>
      {projects.map((project, index) => (
        <ProjectCard key={project.slug} project={project} featured={index === 0} />
      ))}
    </div>
  );
}
