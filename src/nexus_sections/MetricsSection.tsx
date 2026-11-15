import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CheckCircle, Clock, Zap, Layers } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface MetricsSectionProps {
  className?: string;
}

const MetricsSection = ({ className = '' }: MetricsSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const roadmapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      if (!headingRef.current || !metricsRef.current || !roadmapRef.current) return;

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

      // Metrics stagger
      const metrics = metricsRef.current?.querySelectorAll('.metric-item');
      if (metrics) {
        gsap.fromTo(
          metrics,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            scrollTrigger: {
              trigger: metricsRef.current,
              start: 'top 75%',
              end: 'top 50%',
              scrub: true,
            },
          }
        );
      }

      // Roadmap reveal
      gsap.fromTo(
        roadmapRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: roadmapRef.current,
            start: 'top 80%',
            end: 'top 60%',
            scrub: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const metrics = [
    { icon: CheckCircle, value: 12, suffix: '/12', label: 'Tests Passed', suffixLabel: '' },
    { icon: Clock, value: 85, suffix: 'ms', label: 'End-to-end', suffixLabel: 'Latency' },
    { icon: Zap, value: 10, suffix: 'mW', label: 'Target Power', suffixLabel: 'Consumption' },
    { icon: Layers, value: 5, suffix: '', label: 'Phases', suffixLabel: 'Complete' },
  ];

  const roadmap = [
    { phase: '1', title: 'Core Architecture', status: 'complete' },
    { phase: '2', title: 'Real Engine Integration', status: 'complete' },
    { phase: '3', title: 'Cognitive Loops', status: 'complete' },
    { phase: '4', title: 'Production Deployment', status: 'complete' },
    { phase: '5', title: 'Advanced Features', status: 'complete' },
  ];

  return (
    <section
      ref={sectionRef}
      id="metrics"
      className={`relative bg-[#0B0D14] py-24 md:py-32 ${className}`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D14] via-[#14182B]/20 to-[#0B0D14]" />

      <div className="relative z-10 max-w-[980px] mx-auto px-6 md:px-12">
        {/* Heading */}
        <h2
          ref={headingRef}
          className="text-[clamp(32px,4vw,52px)] text-[#F4F6FF] text-center mb-16"
        >
          Current Status: <span className="text-gradient">Code Complete</span>
        </h2>

        {/* Metrics Grid */}
        <div
          ref={metricsRef}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-20"
        >
          {metrics.map((metric, index) => (
            <div key={index} className="metric-item text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-[#BFAFF2]/10 flex items-center justify-center">
                  <metric.icon size={24} className="text-[#BFAFF2]" />
                </div>
              </div>
              <div className="metric-number mb-1">
                <AnimatedCounter value={metric.value} suffix={metric.suffix} />
              </div>
              <p className="text-[#A7B0D6] text-sm">{metric.label}</p>
              {metric.suffixLabel && (
                <p className="text-[#A7B0D6] text-sm">{metric.suffixLabel}</p>
              )}
            </div>
          ))}
        </div>

        {/* Roadmap */}
        <div ref={roadmapRef}>
          <h3 className="micro-label text-center mb-8">Development Roadmap</h3>
          <div className="space-y-4">
            {roadmap.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg bg-[#14182B]/40 border border-white/5"
              >
                <div className="w-8 h-8 rounded-full bg-[#BFAFF2]/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={16} className="text-[#BFAFF2]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[#BFAFF2] font-mono text-sm">
                      Phase {item.phase}
                    </span>
                    <span className="text-[#F4F6FF] font-medium">{item.title}</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#A7B0D6] uppercase tracking-wider">
                  Complete
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// Animated counter component
interface AnimatedCounterProps {
  value: number;
  suffix: string;
}

const AnimatedCounter = ({ value, suffix }: AnimatedCounterProps) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const duration = 1500;
            const startTime = Date.now();
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setCount(Math.floor(eased * value));
              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} className="metric-number">
      {count}
      {suffix}
    </span>
  );
};

export default MetricsSection;
