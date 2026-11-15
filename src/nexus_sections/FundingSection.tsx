import { useRef, useLayoutEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/nexus_components/ui/dialog';
import { Input } from '@/nexus_components/ui/input';
import { Textarea } from '@/nexus_components/ui/textarea';
import { Mail, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface FundingSectionProps {
  className?: string;
}

const FundingSection = ({ className = '' }: FundingSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const emblemRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const secondaryRef = useRef<HTMLButtonElement>(null);

  const [isContactOpen, setIsContactOpen] = useState(false);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      if (!emblemRef.current || !headlineRef.current || !subheadRef.current || !ctaRef.current || !secondaryRef.current) return;

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
        .fromTo(
          emblemRef.current,
          { scale: 0.6, rotate: 0, opacity: 0 },
          { scale: 1, rotate: 45, opacity: 1, ease: 'none' },
          0
        )
        .fromTo(
          headlineRef.current,
          { y: '8vh', opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.1
        )
        .fromTo(
          subheadRef.current,
          { y: '6vh', opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.15
        )
        .fromTo(
          [ctaRef.current, secondaryRef.current],
          { y: '4vh', opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.2
        );

      // SETTLE (30-70%): Hold positions

      // EXIT (70-100%)
      scrollTl
        .to(
          emblemRef.current,
          { opacity: 0.3, ease: 'power2.in' },
          0.7
        )
        .to(
          [headlineRef.current, subheadRef.current, ctaRef.current, secondaryRef.current],
          { opacity: 0, ease: 'power2.in' },
          0.75
        );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        id="funding"
        className={`section-pinned ${className}`}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-[#0B0D14]">
          <img
            src="/invite_cosmic_bg.jpg"
            alt="Cosmic invitation"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0B0D14]/60" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
          {/* Emblem Frame */}
          <div
            ref={emblemRef}
            className="emblem-frame w-[min(30vw,380px)] h-[min(30vw,380px)]"
            style={{ position: 'absolute', left: '50%', top: '32%', transform: 'translate(-50%, -50%) rotate(45deg)' }}
          >
            <img
              src="/great_seal.png"
              alt="Great Seal"
              className="emblem-content w-[70%] h-[70%] object-contain"
            />
          </div>

          {/* Headline */}
          <h2
            ref={headlineRef}
            className="text-[clamp(28px,4vw,52px)] text-[#F4F6FF] text-center max-w-[min(70vw,900px)]"
            style={{ position: 'absolute', top: '62%', left: '50%', transform: 'translateX(-50%)' }}
          >
            Join us in building the Operating System for Reality.
          </h2>

          {/* Subheadline */}
          <p
            ref={subheadRef}
            className="text-[clamp(14px,1.4vw,20px)] text-[#BFAFF2] text-center"
            style={{ position: 'absolute', top: '74%', left: '50%', transform: 'translateX(-50%)' }}
          >
            $5M pre-seed • $20M post-money SAFE
          </p>

          {/* CTA */}
          <button
            ref={ctaRef}
            className="cta-accent absolute flex items-center gap-2"
            style={{ top: '82%', left: '50%', transform: 'translateX(-50%)' }}
            onClick={() => setIsContactOpen(true)}
          >
            Request the Deck
            <ArrowRight size={16} />
          </button>

          {/* Secondary Link */}
          <button
            ref={secondaryRef}
            onClick={() => setIsContactOpen(true)}
            className="text-[#A7B0D6] text-sm hover:text-[#F4F6FF] transition-colors absolute"
            style={{ top: '90%', left: '50%', transform: 'translateX(-50%)' }}
          >
            Contact the collective
          </button>
        </div>
      </section>

      {/* Contact Dialog */}
      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent className="bg-[#14182B] border-white/10 text-[#F4F6FF] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Contact WTP Collective</DialogTitle>
            <DialogDescription className="text-[#A7B0D6]">
              Request the investor deck or schedule a call with our team.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 mt-4" onSubmit={(e) => { e.preventDefault(); setIsContactOpen(false); }}>
            <div>
              <label className="text-sm text-[#A7B0D6] mb-1 block">Name</label>
              <Input 
                placeholder="Your name" 
                className="bg-[#0B0D14] border-white/10 text-[#F4F6FF] placeholder:text-[#A7B0D6]/50"
              />
            </div>
            <div>
              <label className="text-sm text-[#A7B0D6] mb-1 block">Email</label>
              <Input 
                type="email"
                placeholder="you@firm.com" 
                className="bg-[#0B0D14] border-white/10 text-[#F4F6FF] placeholder:text-[#A7B0D6]/50"
              />
            </div>
            <div>
              <label className="text-sm text-[#A7B0D6] mb-1 block">Message</label>
              <Textarea 
                placeholder="Tell us about your interest..." 
                className="bg-[#0B0D14] border-white/10 text-[#F4F6FF] placeholder:text-[#A7B0D6]/50 min-h-[100px]"
              />
            </div>
            <button type="submit" className="cta-accent w-full">
              <Mail size={16} />
              Send Message
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FundingSection;
