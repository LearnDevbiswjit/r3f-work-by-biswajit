import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import SplitText from "gsap/SplitText";
gsap.registerPlugin(SplitText);

export default function GsapOverlay() {
  const sectionsConfig = [
    { start: 0.0, duration: 0.8, stagger: 0.06 },
    { start: 0.15, duration: 0.75, stagger: 0.05 },
    { start: 0.35, duration: 0.75, stagger: 0.045 },
    { start: 0.55, duration: 0.85, stagger: 0.06 }
  ];

  const sections = useRef([]);
  const splits = useRef([]);
  const tls = useRef([]);
  const currentIndex = useRef(-1);
  const rafRef = useRef(null);
  const overlayStarted = useRef(false);

  useEffect(() => {
    sectionsConfig.forEach((cfg, i) => {
      const sec = sections.current[i];
      if (!sec) return;

      const headline =
        sec.querySelector(".headline") || sec.querySelector("h1,h2");
      if (!headline) return;

      const split = new SplitText(headline, { type: "words" });
      splits.current[i] = split;

      gsap.set(split.words, { yPercent: 100, opacity: 0 });
      gsap.set(sec, { opacity: i === 0 ? 1 : 0 }); // 🔥 opacity only

      const tl = gsap.timeline({ paused: true });
      tl.to(split.words, {
        yPercent: 0,
        opacity: 1,
        duration: cfg.duration,
        stagger: cfg.stagger,
        ease: "power3.out"
      });

      tls.current[i] = tl;
    });

    function loop() {
      if (!overlayStarted.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const progress = Math.max(
        0,
        Math.min(
          1,
          typeof window._springScrollOffset === "number"
            ? window._springScrollOffset
            : 0
        )
      );

      let idx = sectionsConfig.length - 1;
      for (let i = 0; i < sectionsConfig.length; i++) {
        if (progress < sectionsConfig[i].start) {
          idx = Math.max(0, i - 1);
          break;
        }
      }

      if (idx !== currentIndex.current) {
        const prev = currentIndex.current;
        currentIndex.current = idx;

        if (prev >= 0) {
          gsap.to(sections.current[prev], {
            opacity: 0,
            duration: 0.3,
            ease: "power1.out"
          });
        }

        gsap.set(sections.current[idx], { opacity: 1 });
        gsap.set(splits.current[idx].words, { yPercent: 100, opacity: 0 });
        tls.current[idx]?.play(0);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    const start = () => {
      overlayStarted.current = true;
      currentIndex.current = -1;
    };

    window.addEventListener("APP_LOADER_DONE", start, { once: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      splits.current.forEach(s => s?.revert());
      tls.current.forEach(t => t?.kill());
    };
  }, []);

  const sectionBase =
    "absolute inset-0 h-screen w-screen px-[10vw] text-white pointer-events-none";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none"
      }}
    >
      {/* SECTION 0 */}
      <section ref={el => (sections.current[0] = el)} className={sectionBase}>
        <div className="flex items-end pb-[8vh] h-full">
          <h1 className="text-[clamp(40px,8vw,120px)] leading-[0.9] headline">
            Limitless ideas <br />
            <span className="font-[200]">begin here.</span>
          </h1>
        </div>
      </section>

      {/* SECTION 1 */}
      <section ref={el => (sections.current[1] = el)} className={sectionBase}>
        <div className="flex justify-center items-center h-full text-center">
          <h2 className="text-[clamp(28px,5vw,72px)] headline">
            Turn pages into stories
          </h2>
        </div>
      </section>

      {/* SECTION 2 */}
      <section ref={el => (sections.current[2] = el)} className={sectionBase}>
        <div className="flex items-center h-full">
          <h2 className="text-[clamp(28px,5vw,72px)] headline">
            Three.js &amp; GLSL
          </h2>
        </div>
      </section>

      {/* SECTION 3 */}
      <section ref={el => (sections.current[3] = el)} className={sectionBase}>
        <div className="flex items-end pb-[8vh] h-full">
          <h2 className="text-[clamp(36px,7vw,100px)] headline">
            Not just a website — <br />
            <span className="italic">a living interface.</span>
          </h2>
        </div>
      </section>
    </div>
  );
}
