import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface HubSectionProps {
  className?: string;
}

const HubSection = ({ className = '' }: HubSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const hubEmblemRef = useRef<HTMLDivElement>(null);
  const hubLabelRef = useRef<HTMLSpanElement>(null);
  const orbARef = useRef<HTMLDivElement>(null);
  const orbBRef = useRef<HTMLDivElement>(null);
  const orbCRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGSVGElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      if (!hubEmblemRef.current || !hubLabelRef.current || !orbARef.current || !orbBRef.current || !orbCRef.current || !connectorRef.current || !ctaRef.current) return;

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
        },
      });

      // ENTRANCE (0-30%)
      scrollTl
        // Hub emblem entrance
        .fromTo(
          hubEmblemRef.current,
          { scale: 0.65, opacity: 0, rotate: -20 },
          { scale: 1, opacity: 1, rotate: 45, ease: 'none' },
          0
        )
        // Hub label
        .fromTo(
          hubLabelRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.1
        )
        // Orb A (left) entrance
        .fromTo(
          orbARef.current,
          { x: '-40vw', opacity: 0 },
          { x: 0, opacity: 1, ease: 'none' },
          0.05
        )
        // Orb B (right) entrance
        .fromTo(
          orbBRef.current,
          { x: '40vw', opacity: 0 },
          { x: 0, opacity: 1, ease: 'none' },
          0.08
        )
        // Orb C (bottom) entrance
        .fromTo(
          orbCRef.current,
          { y: '35vh', opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.1
        )
        // Connector lines draw-on
        .fromTo(
          connectorRef.current,
          { opacity: 0 },
          { opacity: 1, ease: 'none' },
          0.12
        )
        // CTA entrance
        .fromTo(
          ctaRef.current,
          { y: '6vh', opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.18
        );

      // SETTLE (30-70%): Hold positions - no animation needed

      // EXIT (70-100%)
      scrollTl
        .to(
          hubEmblemRef.current,
          { scale: 0.85, opacity: 0.25, ease: 'power2.in' },
          0.7
        )
        .to(
          orbARef.current,
          { x: '-18vw', opacity: 0.25, ease: 'power2.in' },
          0.7
        )
        .to(
          orbBRef.current,
          { x: '18vw', opacity: 0.25, ease: 'power2.in' },
          0.7
        )
        .to(
          orbCRef.current,
          { y: '18vh', opacity: 0.25, ease: 'power2.in' },
          0.7
        )
        .to(
          connectorRef.current,
          { opacity: 0, ease: 'power2.in' },
          0.7
        )
        .to(
          [hubLabelRef.current, ctaRef.current],
          { y: '4vh', opacity: 0, ease: 'power2.in' },
          0.75
        );
    }, section);

    return () => ctx.revert();
  }, []);

  const scrollToPillars = () => {
    const compassion = document.getElementById('compassion');
    if (compassion) {
      compassion.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const orbs = [
    {
      ref: orbARef,
      label: 'Compassion Bridge',
      position: 'left-[18vw] top-[46%]',
      image: '/compassion_ui_mock.jpg',
    },
    {
      ref: orbBRef,
      label: 'Home Reintegration',
      position: 'right-[18vw] top-[46%]',
      image: '/home_ui_mock.jpg',
    },
    {
      ref: orbCRef,
      label: 'CitySpark Schools',
      position: 'left-1/2 -translate-x-1/2 bottom-[12vh]',
      image: '/schools_ui_mock.jpg',
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="hub"
      className={`section-pinned ${className}`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[#0B0D14]">
        <img
          src="/hub_cosmic_bg.jpg"
          alt="Cosmic hub"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0B0D14]/60" />
      </div>

      {/* SVG Connector Lines */}
      <svg
        ref={connectorRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line
          className="connector-line"
          x1="50"
          y1="46"
          x2="18"
          y2="46"
          vectorEffect="non-scaling-stroke"
        />
        <line
          className="connector-line"
          x1="50"
          y1="46"
          x2="82"
          y2="46"
          vectorEffect="non-scaling-stroke"
        />
        <line
          className="connector-line"
          x1="50"
          y1="46"
          x2="50"
          y2="84"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        {/* Hub Emblem */}
        <div
          ref={hubEmblemRef}
          className="emblem-frame w-[min(28vw,360px)] h-[min(28vw,360px)]"
          style={{ position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%) rotate(45deg)' }}
        >
          <img
            src="/nexus_logo.png"
            alt="NEXUS OS"
            className="emblem-content w-[60%] h-[60%] object-contain"
          />
        </div>

        {/* Hub Label */}
        <span
          ref={hubLabelRef}
          className="micro-label absolute"
          style={{ left: '50%', top: '62%', transform: 'translateX(-50%)' }}
        >
          NEXUS OS
        </span>

        {/* Orbs */}
        {orbs.map((orb, index) => (
          <div
            key={index}
            ref={orb.ref}
            className={`absolute ${orb.position} flex flex-col items-center`}
          >
            <div className="orb w-[min(14vw,180px)] h-[min(14vw,180px)]">
              <img
                src={orb.image}
                alt={orb.label}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="micro-label mt-4 text-center whitespace-nowrap">
              {orb.label}
            </span>
          </div>
        ))}

        {/* CTA */}
        <button
          ref={ctaRef}
          onClick={scrollToPillars}
          className="cta-pill absolute"
          style={{ left: '50%', bottom: '6vh', transform: 'translateX(-50%)' }}
        >
          Meet the Pillars
          <ChevronDown size={16} />
        </button>
      </div>
    </section>
  );
};

export default HubSection;
