import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function useScrollReveal() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const revealElements = () => {
      const elements = new Set();

      document.querySelectorAll("section, article, .dashboard-stagger > *").forEach((element) => {
        elements.add(element);
      });

      document.querySelectorAll("main [class], #root [class]").forEach((element) => {
        const classes = element.className?.toString?.().toLowerCase() || "";
        if (classes.includes("card") && !element.closest(".dashboard-stagger > *")) {
          elements.add(element);
        }
      });

      return [...elements].filter((element) => !element.closest("[data-scroll-reveal='false']"));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("scroll-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );

    const scheduleReveal = () => {
      revealElements().forEach((element, index) => {
        if (!element.classList.contains("scroll-reveal")) {
          element.classList.add("scroll-reveal");
          element.style.setProperty("--scroll-reveal-delay", `${Math.min(index % 6, 5) * 55}ms`);
        }
        observer.observe(element);
      });
    };

    const frame = window.requestAnimationFrame(scheduleReveal);
    const mutationObserver = new MutationObserver(scheduleReveal);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [pathname]);
}
