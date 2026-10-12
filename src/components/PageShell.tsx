import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export function PageShell({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-anim]", {
        opacity: 0,
        y: 12,
        duration: 0.42,
        stagger: 0.05,
        ease: "power2.out",
        clearProps: "all",
      });
    },
    { scope },
  );

  return (
    <div ref={scope} className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div data-anim className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-5">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">{children}</div>
    </div>
  );
}
