import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, Shield, Users, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface TechSectionProps {
  className?: string;
}

const TechSection = ({ className = '' }: TechSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const flywheelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      if (!headingRef.current || !cardsRef.current || !flywheelRef.current) return;

      // Heading reveal
      gsap.fromTo(
        headingRef.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 80%',
            end: 'top 55%',
            scrub: true,
          },
        }
      );

      // Cards stagger reveal
      const cards = cardsRef.current?.querySelectorAll('.tech-card');
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            scrollTrigger: {
              trigger: cardsRef.current,
              start: 'top 75%',
              end: 'top 50%',
              scrub: true,
            },
          }
        );
      }

      // Flywheel parallax
      gsap.fromTo(
        flywheelRef.current,
        { y: 20 },
        {
          y: -10,
          scrollTrigger: {
            trigger: flywheelRef.current,
            start: 'top 80%',
            end: 'bottom 20%',
            scrub: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const techCards = [
    {
      icon: Brain,
      title: 'NEXUS MIND',
      description: 'Spiking neural network engine. Sub-10ms intent recognition. Event-driven awareness.',
      specs: ['SNN Architecture', '<10ms Latency', '10mW Power'],
    },
    {
      icon: Shield,
      title: 'Sentinel Protocol',
      description: 'Post-quantum privacy. Zero-knowledge proofs. Ghost Relay integration.',
      specs: ['512-bit QRC', 'Zero-Knowledge', 'Tor Routing'],
    },
    {
      icon: Users,
      title: 'C.O.M.M.S.',
      description: 'Human-in-the-loop verification. Tiered workforce. Immutable ledger.',
      specs: ['4-Tier System', 'Truth Credits', 'Blockchain'],
    },
  ];

  const flywheelSteps = [
    { label: 'Capture', desc: 'Citizen sensors' },
    { label: 'Refine', desc: 'AI processing' },
    { label: 'Verify', desc: 'Human check' },
    { label: 'Monetize', desc: 'B2B/B2G sale' },
    { label: 'Reward', desc: 'Truth Credits' },
  ];

  return (
    <section
      ref={sectionRef}
      id="technology"
      className={`relative bg-[#0B0D14] py-24 md:py-32 ${className}`}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D14] via-[#14182B]/30 to-[#0B0D14]" />

      <div className="relative z-10 max-w-[980px] mx-auto px-6 md:px-12">
        {/* Heading */}
        <h2
          ref={headingRef}
          className="text-[clamp(32px,4vw,52px)] text-[#F4F6FF] text-center mb-16"
        >
          Technology Overview
        </h2>

        {/* Tech Cards */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20"
        >
          {techCards.map((card, index) => (
            <div key={index} className="tech-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#BFAFF2]/10 flex items-center justify-center">
                  <card.icon size={20} className="text-[#BFAFF2]" />
                </div>
                <h3 className="text-lg font-serif text-[#F4F6FF]">{card.title}</h3>
              </div>
              <p className="text-[#A7B0D6] text-sm mb-4 leading-relaxed">
                {card.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {card.specs.map((spec, i) => (
                  <span
                    key={i}
                    className="text-xs font-mono text-[#BFAFF2] bg-[#BFAFF2]/10 px-2 py-1 rounded"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Data Flywheel */}
        <div ref={flywheelRef} className="text-center">
          <h3 className="micro-label mb-8">The Data Flywheel</h3>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {flywheelSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-4 md:gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#BFAFF2]/20 to-[#BFAFF2]/5 border border-[#BFAFF2]/30 flex items-center justify-center mb-2">
                    <span className="text-[#BFAFF2] font-mono text-sm md:text-base font-medium">
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-[#F4F6FF] text-sm font-medium">{step.label}</p>
                  <p className="text-[#A7B0D6] text-xs">{step.desc}</p>
                </div>
                {index < flywheelSteps.length - 1 && (
                  <ArrowRight size={20} className="text-[#BFAFF2]/50 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechSection;
