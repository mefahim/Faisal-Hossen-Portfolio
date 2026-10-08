type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "right";
};

export function SectionHeading({ eyebrow, title, body, align = "left" }: SectionHeadingProps) {
  return (
    <div className={`section-heading section-heading-${align}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {body ? <p className="section-heading-body">{body}</p> : null}
    </div>
  );
}
