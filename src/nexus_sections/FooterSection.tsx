import { useRef, useLayoutEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/nexus_components/ui/dialog';
import { Input } from '@/nexus_components/ui/input';
import { Textarea } from '@/nexus_components/ui/textarea';
import { Mail, Calendar, Download, ExternalLink } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface FooterSectionProps {
  className?: string;
}

const FooterSection = ({ className = '' }: FooterSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isContactOpen, setIsContactOpen] = useState(false);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      if (!contentRef.current) return;

      gsap.fromTo(
        contentRef.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: contentRef.current,
            start: 'top 80%',
            end: 'top 60%',
            scrub: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        id="footer"
        className={`relative bg-[#0B0D14] py-20 md:py-28 ${className}`}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#14182B]/50 to-[#0B0D14]" />

        <div ref={contentRef} className="relative z-10 max-w-[800px] mx-auto px-6 md:px-12">
          {/* Contact Block */}
          <div className="text-center mb-16">
            <h2 className="text-[clamp(28px,3.5vw,44px)] text-[#F4F6FF] mb-6">
              Let's build the future we've been waiting for.
            </h2>
            <a
              href="mailto:hello@wtpcollective.nexus"
              className="text-[#BFAFF2] text-lg hover:underline inline-flex items-center gap-2"
            >
              <Mail size={18} />
              hello@wtpcollective.nexus
            </a>

            {/* Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
              <button 
                className="cta-pill flex items-center gap-2"
                onClick={() => alert('Deck download coming soon!')}
              >
                <Download size={16} />
                Download Deck
              </button>
              <button 
                className="cta-accent flex items-center gap-2"
                onClick={() => setIsContactOpen(true)}
              >
                <Calendar size={16} />
                Schedule a Call
              </button>
            </div>
          </div>

          {/* Footer Links */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <img
                  src="/nexus_logo.png"
                  alt="WTP Collective"
                  className="w-6 h-6 opacity-70"
                />
                <span className="text-[#A7B0D6] text-sm">
                  © 2026 WTP Collective
                </span>
              </div>
              <div className="flex items-center gap-6">
                <button className="text-[#A7B0D6] text-sm hover:text-[#F4F6FF] transition-colors">
                  Privacy
                </button>
                <button className="text-[#A7B0D6] text-sm hover:text-[#F4F6FF] transition-colors">
                  Terms
                </button>
                <a 
                  href="#" 
                  className="text-[#A7B0D6] text-sm hover:text-[#F4F6FF] transition-colors inline-flex items-center gap-1"
                >
                  Whitepaper
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>

          {/* Manifesto Quote */}
          <div className="mt-16 text-center">
            <p className="text-[#A7B0D6]/60 text-sm italic max-w-lg mx-auto">
              "We are not merely writing code or shaping vision. We are architects of possibility, 
              building the infrastructure for a free world."
            </p>
            <p className="text-[#BFAFF2]/60 text-xs mt-2 font-mono uppercase tracking-wider">
              By the People. For the People. Making Reality.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Dialog */}
      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent className="bg-[#14182B] border-white/10 text-[#F4F6FF] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Schedule a Call</DialogTitle>
            <DialogDescription className="text-[#A7B0D6]">
              Connect with our team to discuss investment opportunities.
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
              <label className="text-sm text-[#A7B0D6] mb-1 block">Firm/Organization</label>
              <Input 
                placeholder="Your firm" 
                className="bg-[#0B0D14] border-white/10 text-[#F4F6FF] placeholder:text-[#A7B0D6]/50"
              />
            </div>
            <div>
              <label className="text-sm text-[#A7B0D6] mb-1 block">Message</label>
              <Textarea 
                placeholder="What would you like to discuss?" 
                className="bg-[#0B0D14] border-white/10 text-[#F4F6FF] placeholder:text-[#A7B0D6]/50 min-h-[100px]"
              />
            </div>
            <button type="submit" className="cta-accent w-full">
              <Mail size={16} />
              Request Meeting
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FooterSection;
