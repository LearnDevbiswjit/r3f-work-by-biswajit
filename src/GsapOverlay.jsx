// src/component/GsapOverlay.jsx
import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import SplitText from "gsap/SplitText";

gsap.registerPlugin(SplitText);

export default function GsapOverlay() {
  const sectionsConfig = [
    { start: 0.0, end: 0.04, duration: 0.9, stagger: 0.015, hideDuration: 0.25 },
    { start: 0.11, end: 0.35, duration: 0.85, stagger: 0.012, hideDuration: 0.18 },
    { start: 0.45, end: 0.65, duration: 0.85, stagger: 0.012, hideDuration: 0.18 },
    { start: 0.7, end: 1.2, duration: 0.95, stagger: 0.015, hideDuration: 0.18 }
  ];

  const SECTION_COUNT = sectionsConfig.length;

  const sections = useRef([]);
  const splits = useRef([]);
  const tls = useRef([]);
  const active = useRef(new Array(SECTION_COUNT).fill(false));
  const rafRef = useRef(null);
  const overlayStarted = useRef(false);

  useEffect(() => {
    for (let i = 0; i < SECTION_COUNT; i++) {
      const sec = sections.current[i];
      const cfg = sectionsConfig[i];
      if (!sec || !cfg) continue;

      const headline = sec.querySelector(".headline") || sec.querySelector("h1,h2");
      if (!headline) continue;

      /* ---------- SPLIT BY CHARS ---------- */
      const split = new SplitText(headline, {
        type: "chars",
        charsClass: "char"
      });

      splits.current[i] = split;

      gsap.set(split.chars, {
        yPercent: 120,
        autoAlpha: 0
      });
      gsap.set(sec, { autoAlpha: 0 });

      const tl = gsap.timeline({ paused: true });

      tl.to(split.chars, {
        yPercent: 0,
        autoAlpha: 1,
        duration: cfg.duration,
        stagger: cfg.stagger,
        ease: "power3.out"
      });

      tl.eventCallback("onReverseComplete", () => {
        gsap.set(sec, { autoAlpha: 0 });
      });

      tls.current[i] = tl;
    }

    function loop() {
      if (!overlayStarted.current || window.__OVERLAY_LOCKED__) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const p =
        typeof window !== "undefined" &&
        typeof window._springScrollOffset === "number"
          ? window._springScrollOffset
          : 0;

      const progress = Math.max(0, Math.min(1, p));

      for (let i = 0; i < SECTION_COUNT; i++) {
        const cfg = sectionsConfig[i];
        const inRange = progress >= cfg.start && progress <= cfg.end;
        const wasActive = active.current[i];

        if (inRange && !wasActive) {
          active.current[i] = true;
          gsap.set(sections.current[i], { autoAlpha: 1 });

          const sp = splits.current[i];
          if (sp) {
            gsap.set(sp.chars, { yPercent: 120, autoAlpha: 0 });
          }

          tls.current[i]?.play(0);
        }

        if (!inRange && wasActive) {
          active.current[i] = false;
          tls.current[i]?.reverse();
          gsap.to(sections.current[i], {
            autoAlpha: 0,
            duration: cfg.hideDuration,
            ease: "power1.in"
          });
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    /* ---------- start after loader ---------- */
    const startAfterLoader = () => {
      overlayStarted.current = true;
      const sec0 = sections.current[0];

      if (sec0 && tls.current[0]) {
        gsap.set(sec0, { autoAlpha: 1 });
        const sp = splits.current[0];
        if (sp) gsap.set(sp.chars, { yPercent: 120, autoAlpha: 0 });
        tls.current[0].play(0);
      }
    };

    window.addEventListener("APP_LOADER_DONE", startAfterLoader, { once: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("APP_LOADER_DONE", startAfterLoader);

      tls.current.forEach((t) => t?.kill());
      splits.current.forEach((s) => s?.revert());
    };
  }, []);

  const baseClass =
    "absolute inset-0 h-screen w-full  pointer-events-none px-[10vw]";

  return (
    <div className="z-40 fixed inset-0 pointer-events-none">
      {/* SECTION 0 */}
      <section
        ref={(el) => (sections.current[0] = el)}
        className={`${baseClass} flex items-end pb-[8vh]`}
      >
        <div className="max-w-[90%]">
          <h1
            className="font-anton text-purple-300 headline"
            style={{ fontSize: "clamp(40px,6vw,120px)" }}
          >
            Limitless ideas <br />
            <span className="font-[200]">begin here.</span>
          </h1>
        </div>
      </section>

      {/* SECTION 1 */}
      <section
        ref={(el) => (sections.current[1] = el)}
        className={`${baseClass} flex flex-col items-center justify-center text-center`}
      >
        <h2
          className="headline headingText"
          style={{ fontSize: "clamp(28px,5vw,72px)" }}
        >
          Turn simple pages into stories <br />
          <span className="font-[200] italic">you feel, not just scroll.</span>
        </h2>
      </section>

      {/* SECTION 2 */}
      <section
        ref={(el) => (sections.current[2] = el)}
        className={`${baseClass} flex flex-col items-center justify-center text-center`}
      >
        <h2
          className="headline headingText"
          style={{ fontSize: "clamp(28px,5vw,72px)" }}
        >
          Three.js, React &amp; GLSL <br />
          <span className="font-[200] italic">moving in perfect sync.</span>
        </h2>
      </section>

      {/* SECTION 3 */}
      <section
        ref={(el) => (sections.current[3] = el)}
        className={`${baseClass} flex items-end pb-[8vh]`}
      >
        <h2
          className="headline headingText"
          style={{ fontSize: "clamp(40px,7vw,110px)" }}
        >
          Not just a website — <br />
          <span className="font-[200] italic">a living interface.</span>
        </h2>
      </section>
    </div>
  );
}
