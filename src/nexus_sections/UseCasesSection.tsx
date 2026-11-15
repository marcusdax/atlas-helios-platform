import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Building2, Shield, GraduationCap, Landmark, TreePine, Siren } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface UseCasesSectionProps {
  className?: string;
}

const UseCasesSection = ({ className = '' }: UseCasesSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      if (!headingRef.current || !leftColRef.current || !rightColRef.current) return;

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

      // Left column slide in
      gsap.fromTo(
        leftColRef.current,
        { x: '-6vw', opacity: 0 },
        {
          x: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: leftColRef.current,
            start: 'top 75%',
            end: 'top 50%',
            scrub: true,
          },
        }
      );

      // Right column slide in
      gsap.fromTo(
        rightColRef.current,
        { x: '6vw', opacity: 0 },
        {
          x: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: rightColRef.current,
            start: 'top 75%',
            end: 'top 50%',
            scrub: true,
          },
        }
      );

      // Stagger rows
      const leftRows = leftColRef.current?.querySelectorAll('.usecase-row');
      const rightRows = rightColRef.current?.querySelectorAll('.usecase-row');
      
      if (leftRows) {
        gsap.fromTo(
          leftRows,
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            scrollTrigger: {
              trigger: leftColRef.current,
              start: 'top 70%',
              end: 'top 45%',
              scrub: true,
            },
          }
        );
      }

      if (rightRows) {
        gsap.fromTo(
          rightRows,
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            scrollTrigger: {
              trigger: rightColRef.current,
              start: 'top 70%',
              end: 'top 45%',
              scrub: true,
            },
          }
        );
      }
    }, section);

    return () => ctx.revert();
  }, []);

  const federalItems = [
    {
      icon: Shield,
      title: 'DIU / AFWERX',
      description: 'Rapid prototyping for defense & public safety.',
    },
    {
      icon: Building2,
      title: 'DHS',
      description: 'Soft-target security & verified alerts.',
    },
    {
      icon: GraduationCap,
      title: 'DOE / ED',
      description: 'Adaptive learning & infrastructure resilience.',
    },
  ];

  const municipalItems = [
    {
      icon: Landmark,
      title: 'Municipal Efficiency',
      description: 'Reduce waste via verified ground truth.',
    },
    {
      icon: TreePine,
      title: 'School Districts',
      description: 'Personalized learning at scale.',
    },
    {
      icon: Siren,
      title: 'Public Safety',
      description: 'Predictive triage + CAD integration.',
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="usecases"
      className={`relative bg-[#0B0D14] py-24 md:py-32 ${className}`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D14] via-[#14182B]/20 to-[#0B0D14]" />

      <div className="relative z-10 max-w-[1100px] mx-auto px-6 md:px-12">
        {/* Heading */}
        <h2
          ref={headingRef}
          className="text-[clamp(32px,4vw,52px)] text-[#F4F6FF] text-center mb-16"
        >
          Built for Civic & Federal Deployment
        </h2>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Federal Column */}
          <div ref={leftColRef}>
            <h3 className="micro-label mb-6 text-[#BFAFF2]">Federal Alignment</h3>
            <div className="space-y-4">
              {federalItems.map((item, index) => (
                <div
                  key={index}
                  className="usecase-row flex items-start gap-4 p-4 rounded-lg bg-[#14182B]/40 border border-white/5 hover:border-[#BFAFF2]/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#BFAFF2]/10 flex items-center justify-center flex-shrink-0">
                    <item.icon size={20} className="text-[#BFAFF2]" />
                  </div>
                  <div>
                    <h4 className="text-[#F4F6FF] font-medium mb-1">{item.title}</h4>
                    <p className="text-[#A7B0D6] text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Municipal Column */}
          <div ref={rightColRef}>
            <h3 className="micro-label mb-6 text-[#BFAFF2]">Municipal Value</h3>
            <div className="space-y-4">
              {municipalItems.map((item, index) => (
                <div
                  key={index}
                  className="usecase-row flex items-start gap-4 p-4 rounded-lg bg-[#14182B]/40 border border-white/5 hover:border-[#BFAFF2]/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#BFAFF2]/10 flex items-center justify-center flex-shrink-0">
                    <item.icon size={20} className="text-[#BFAFF2]" />
                  </div>
                  <div>
                    <h4 className="text-[#F4F6FF] font-medium mb-1">{item.title}</h4>
                    <p className="text-[#A7B0D6] text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;
