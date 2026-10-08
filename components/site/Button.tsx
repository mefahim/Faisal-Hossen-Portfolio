import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "text";
  className?: string;
  onClick?: () => void;
};

export function Button({ href, children, variant = "primary", className = "", onClick }: ButtonProps) {
  const styles = {
    primary: "button button-primary",
    secondary: "button button-secondary",
    text: "button button-text",
  }[variant];

  return (
    <Link className={`${styles} ${className}`.trim()} href={href} onClick={onClick}>
      <span>{children}</span>
      <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
    </Link>
  );
}
