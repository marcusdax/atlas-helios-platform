import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface HeroSectionProps {
  className?: string;
}

const HeroSection = ({ className = '' }: HeroSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const emblemRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const microRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      if (!emblemRef.current || !logoRef.current || !headlineRef.current || !subheadRef.current || !ctaRef.current || !microRef.current) return;

      // Auto-play entrance animation on load
      const loadTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      loadTl
        .fromTo(
          emblemRef.current,
          { scale: 0.75, rotate: -15, opacity: 0 },
          { scale: 1, rotate: 45, opacity: 1, duration: 0.9 }
        )
        .fromTo(
          logoRef.current,
          { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: 0.6 },
          '-=0.65'
        )
        .fromTo(
          headlineRef.current,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
          '-=0.45'
        )
        .fromTo(
          [subheadRef.current, ctaRef.current, microRef.current],
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.08 },
          '-=0.4'
        );

      // Scroll-driven exit animation
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
          onLeaveBack: () => {
            // Reset all elements when scrolling back to top
            gsap.set([emblemRef.current, logoRef.current, headlineRef.current, subheadRef.current, ctaRef.current, microRef.current], {
              opacity: 1, x: 0, y: 0, scale: 1
            });
          }
        },
      });

      // ENTRANCE (0-30%): Hold position (already animated on load)
      // SETTLE (30-70%): Hold position
      // EXIT (70-100%): Elements exit
      scrollTl
        .fromTo(
          emblemRef.current,
          { x: 0, scale: 1, opacity: 1 },
          { x: '-22vw', scale: 0.82, opacity: 0.25, ease: 'power2.in' },
          0.7
        )
        .fromTo(
          [headlineRef.current, subheadRef.current, ctaRef.current, microRef.current],
          { y: 0, opacity: 1 },
          { y: '10vh', opacity: 0.2, ease: 'power2.in' },
          0.7
        );
    }, section);

    return () => ctx.revert();
  }, []);

  const scrollToHub = () => {
    const hub = document.getElementById('hub');
    if (hub) {
      hub.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      ref={sectionRef}
      id="hero"
      className={`section-pinned ${className}`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[#0B0D14]">
        <img
          src="/hero_cosmic_bg.jpg"
          alt="Cosmic background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0B0D14]/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
        {/* Emblem Frame */}
        <div
          ref={emblemRef}
          className="emblem-frame w-[min(34vw,420px)] h-[min(34vw,420px)]"
          style={{ marginTop: '-8vh' }}
        >
          <img
            ref={logoRef}
            src="/nexus_logo.png"
            alt="NEXUS OS"
            className="emblem-content w-[70%] h-[70%] object-contain"
          />
        </div>

        {/* Headline */}
        <h1
          ref={headlineRef}
          className="text-[clamp(36px,6vw,84px)] text-[#F4F6FF] text-center max-w-[min(52vw,720px)] mt-8"
        >
          The Architecture of Human Dignity
        </h1>

        {/* Subheadline */}
        <p
          ref={subheadRef}
          className="text-[clamp(14px,1.4vw,20px)] text-[#A7B0D6] text-center max-w-[min(46vw,640px)] mt-6"
        >
          NEXUS OS — a sovereign, neuromorphic operating system for reality.
        </p>

        {/* CTA */}
        <button
          ref={ctaRef}
          onClick={scrollToHub}
          className="cta-pill mt-10 flex items-center gap-2"
        >
          Explore the Ecosystem
          <ChevronDown size={16} />
        </button>

        {/* Micro line */}
        <span
          ref={microRef}
          className="micro-label mt-6"
        >
          Pre-seed prospectus • 2026
        </span>
      </div>
    </section>
  );
};

export default HeroSection;
