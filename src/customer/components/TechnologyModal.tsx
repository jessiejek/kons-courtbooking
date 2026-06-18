import React from 'react';
import { X, Layers, Award, Landmark, Ruler } from 'lucide-react';

interface TechnologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TechnologyModal({ isOpen, onClose }: TechnologyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-[#05140B] text-[#F3F4F1] border border-[#14321E] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#14321E]">
          <div>
            <span className="text-xs bg-[#BCFD31]/20 text-[#BCFD31] px-2.5 py-1 rounded-full font-mono font-medium uppercase tracking-wider">
              Exclusive Surface Tech
            </span>
            <h3 className="text-2xl font-sans font-bold tracking-tight text-white mt-2">
              ProCushion™ Surface Coating
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-2 text-[#94A3B8] hover:text-white hover:bg-[#112F1B] rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-[#A2B5A7] text-sm md:text-base leading-relaxed">
            Sunshine Pickleball Courts feature our multi-layered, climate-responsive cushion technology. 
            Engineered in Germany, the ProCushion™ system comprises five individual performance layers 
            providing maximum force reduction while maintaining consistent coefficient of friction.
          </p>

          {/* Diagram of Layers */}
          <div className="bg-[#020A05] p-5 rounded-xl border border-[#112F1B] space-y-3">
            <h4 className="text-xs font-mono uppercase text-[#BCFD31] tracking-wider mb-2 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5" /> Layer Sub-System Breakdown
            </h4>
            
            <div className="space-y-2">
              {/* Layer 5 */}
              <div className="flex items-center gap-3 bg-[#0C2415] p-2.5 rounded-lg border-l-4 border-[#BCFD31]">
                <div className="text-xs font-mono text-[#BCFD31] w-6 shrink-0">L5</div>
                <div>
                  <div className="text-xs font-semibold text-white">Ultra-Wear Clear Coat (UV-Protective)</div>
                  <div className="text-[10px] text-[#A2B5A7]">Scratch-resistant silica seal protecting pigmentation and friction levels.</div>
                </div>
              </div>

              {/* Layer 4 */}
              <div className="flex items-center gap-3 bg-[#0C2415] p-2.5 rounded-lg border-l-4 border-emerald-400">
                <div className="text-xs font-mono text-emerald-400 w-6 shrink-0">L4</div>
                <div>
                  <div className="text-xs font-semibold text-white">Pigmented Textured Finish</div>
                  <div className="text-[10px] text-[#A2B5A7]">Vibrant non-glare chartreuse hue engineered for precise bounce traction.</div>
                </div>
              </div>

              {/* Layer 3 */}
              <div className="flex items-center gap-3 bg-[#0C2415] p-2.5 rounded-lg border-l-4 border-green-500">
                <div className="text-xs font-mono text-green-500 w-6 shrink-0">L3</div>
                <div>
                  <div className="text-xs font-semibold text-white">Core Cushioned Elastic Layer</div>
                  <div className="text-[10px] text-[#A2B5A7]">Liquid rubber granules absorbing 22% of joint and muscular foot-strike impact.</div>
                </div>
              </div>

              {/* Layer 2 */}
              <div className="flex items-center gap-3 bg-[#0C2415] p-2.5 rounded-lg border-l-4 border-slate-400">
                <div className="text-xs font-mono text-slate-400 w-6 shrink-0">L2</div>
                <div>
                  <div className="text-xs font-semibold text-white">Acrylic Resurfacer Filler</div>
                  <div className="text-[10px] text-[#A2B5A7]">Creates completely flat, shadowless, void-free leveling.</div>
                </div>
              </div>

              {/* Layer 1 */}
              <div className="flex items-center gap-3 bg-[#0C2415] p-2.5 rounded-lg border-l-4 border-slate-600">
                <div className="text-xs font-mono text-slate-600 w-6 shrink-0">L1</div>
                <div>
                  <div className="text-xs font-semibold text-white">Reinforced Concrete Sub-Base</div>
                  <div className="text-[10px] text-[#A2B5A7]">Laser-leveled heavy aggregate substrate resisting moisture and heat shifts.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#0A1F12] rounded-xl border border-[#14321E]">
              <div className="flex items-center gap-2 text-[#BCFD31] mb-1.5">
                <Award className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-wider font-semibold">Joint Safety</span>
              </div>
              <div className="text-2xl font-bold font-sans text-white">22%</div>
              <p className="text-[11px] text-[#A2B5A7] mt-0.5">Impact energy absorption reduces fatigue compared to asphalt.</p>
            </div>

            <div className="p-4 bg-[#0A1F12] rounded-xl border border-[#14321E]">
              <div className="flex items-center gap-2 text-emerald-400 mb-1.5">
                <Ruler className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-wider font-semibold">Planimetry</span>
              </div>
              <div className="text-2xl font-bold font-sans text-white">&lt;0.5mm</div>
              <p className="text-[11px] text-[#A2B5A7] mt-0.5">Maximum deviation across the court lines ensuring perfectly true bounce.</p>
            </div>
          </div>

          <div className="flex gap-3 bg-[#0D2617]/40 p-4 rounded-xl border border-[#14321E]/60 text-xs text-[#A2B5A7] items-start">
            <Landmark className="className w-5 h-5 text-[#BCFD31] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white mb-1">USA Pickleball Association (USAPA) Compliant</p>
              <p>Certified for official tournaments, local leagues, and recreational ladder matches alike. Fast drainage technology allows plays to support gameplay within 15 minutes of extreme downpours.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#14321E] flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 text-xs font-mono uppercase bg-[#BCFD31] text-[#05140B] rounded-lg font-bold hover:bg-[#a9e428] active:scale-95 transition-all cursor-pointer"
          >
            Acknowledge & Back
          </button>
        </div>
      </div>
    </div>
  );
}
