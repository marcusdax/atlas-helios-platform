import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface PillarSectionProps {
  className?: string;
  id: string;
  pillarNumber: string;
  title: string;
  subtitle: string;
  backgroundImage: string;
  emblemImage: string;
  ctaText?: string;
  entranceDirection: 'left' | 'right' | 'bottom';
  isReport?: boolean;
}

const PillarSection = ({
  className = '',
  id,
  pillarNumber,
  title,
  subtitle,
  backgroundImage,
  emblemImage,
  ctaText,
  entranceDirection,
  isReport = false,
}: PillarSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const emblemRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      if (!sectionRef.current || !bgRef.current || !emblemRef.current || !labelRef.current || !headlineRef.current || !subheadRef.current || !ctaRef.current) return;

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
        },
      });

      // Get entrance values based on direction
      const getEntranceValues = () => {
        switch (entranceDirection) {
          case 'left':
            return { emblem: { x: '-18vw', opacity: 0 }, text: { x: '10vw', opacity: 0 } };
          case 'right':
            return { emblem: { x: '18vw', opacity: 0 }, text: { x: '-10vw', opacity: 0 } };
          case 'bottom':
          default:
            return { emblem: { y: '15vh', opacity: 0 }, text: { y: '8vh', opacity: 0 } };
        }
      };

      const entrance = getEntranceValues();

      // ENTRANCE (0-30%)
      scrollTl
        // Background
        .fromTo(
          bgRef.current,
          { scale: 1.08, opacity: 0.7 },
          { scale: 1, opacity: 1, ease: 'none' },
          0
        )
        // Pillar label
        .fromTo(
          labelRef.current,
          { y: '-4vh', opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0
        )
        // Emblem entrance
        .fromTo(
          emblemRef.current,
          { scale: 0.6, rotate: entranceDirection === 'right' ? 60 : -30, ...entrance.emblem },
          { scale: 1, rotate: 45, x: 0, y: 0, opacity: 1, ease: 'none' },
          0
        )
        // Text entrance
        .fromTo(
          [headlineRef.current, subheadRef.current],
          { ...entrance.text },
          { opacity: 1, x: 0, y: 0, ease: 'none' },
          0.1
        )
        // CTA entrance
        .fromTo(
          ctaRef.current,
          { y: '4vh', opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.2
        );

      // SETTLE (30-70%): Hold positions

      // EXIT (70-100%)
      const getExitValues = () => {
        switch (entranceDirection) {
          case 'left':
            return { emblem: { x: '18vw' }, text: { x: '-10vw' } };
          case 'right':
            return { emblem: { x: '-18vw' }, text: { x: '10vw' } };
          case 'bottom':
          default:
            return { emblem: { y: '-10vh' }, text: { y: '6vh' } };
        }
      };

      const exit = getExitValues();

      scrollTl
        .to(
          bgRef.current,
          { scale: 1.05, opacity: 0.35, ease: 'power2.in' },
          0.7
        )
        .to(
          emblemRef.current,
          { scale: 0.88, opacity: 0.25, ...exit.emblem, ease: 'power2.in' },
          0.7
        )
        .to(
          [headlineRef.current, subheadRef.current],
          { opacity: 0.2, ...exit.text, ease: 'power2.in' },
          0.7
        )
        .to(
          [labelRef.current, ctaRef.current],
          { opacity: 0, ease: 'power2.in' },
          0.75
        );
    }, section);

    return () => ctx.revert();
  }, [entranceDirection]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`section-pinned ${className}`}
    >
      {/* Background */}
      <div ref={bgRef} className="absolute inset-0 bg-[#0B0D14]">
        <img
          src={backgroundImage}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D14]/40 via-transparent to-[#0B0D14]/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
        {/* Pillar Label */}
        {pillarNumber && (
          <span
            ref={labelRef}
            className="micro-label absolute"
            style={{ top: '8vh', left: '50%', transform: 'translateX(-50%)' }}
          >
            PILLAR {pillarNumber}
          </span>
        )}

        {/* Emblem Frame */}
        <div
          ref={emblemRef}
          className="emblem-frame w-[min(30vw,380px)] h-[min(30vw,380px)]"
          style={{ position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%) rotate(45deg)' }}
        >
          <img
            src={emblemImage}
            alt={title}
            className="emblem-content w-[75%] h-[75%] object-cover rounded-lg"
          />
        </div>

        {/* Headline */}
        <h2
          ref={headlineRef}
          className="text-[clamp(32px,4.5vw,56px)] text-[#F4F6FF] text-center max-w-[min(60vw,800px)]"
          style={{ position: 'absolute', top: '68%', left: '50%', transform: 'translateX(-50%)' }}
        >
          {title}
        </h2>

        {/* Subheadline */}
        <p
          ref={subheadRef}
          className="text-[clamp(14px,1.3vw,19px)] text-[#A7B0D6] text-center max-w-[min(50vw,680px)]"
          style={{ position: 'absolute', top: '78%', left: '50%', transform: 'translateX(-50%)' }}
        >
          {subtitle}
        </p>

        {/* CTA */}
        {ctaText && (
          <button
            ref={ctaRef}
            className={`absolute ${isReport ? 'cta-pill' : 'text-[#BFAFF2] text-sm hover:underline'}`}
            style={{ top: '88%', left: '50%', transform: 'translateX(-50%)' }}
          >
            {ctaText}
          </button>
        )}
      </div>
    </section>
  );
};

export default PillarSection;
