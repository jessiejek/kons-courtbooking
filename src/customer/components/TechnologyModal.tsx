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
        className="bg-white text-[#1a1c1b] border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <span className="text-xs bg-[#e8f5ee] text-[#005a40] px-2.5 py-1 rounded-full font-mono font-medium uppercase tracking-wider border border-[#00694c]/20">
              Exclusive Surface Tech
            </span>
            <h3 className="text-2xl font-sans font-bold tracking-tight text-[#1a1c1b] mt-2">
              ProCushion™ Surface Coating
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-2 text-slate-400 hover:text-[#1a1c1b] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            Sunshine Pickleball Courts feature our multi-layered, climate-responsive cushion technology.
            Engineered in Germany, the ProCushion™ system comprises five individual performance layers
            providing maximum force reduction while maintaining consistent coefficient of friction.
          </p>

          {/* Diagram of Layers */}
          <div className="bg-[#f5f8f6] p-5 rounded-xl border border-[#bccac1] space-y-3">
            <h4 className="text-xs font-mono uppercase text-[#00694c] tracking-wider mb-2 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5" /> Layer Sub-System Breakdown
            </h4>

            <div className="space-y-2">
              {/* Layer 5 */}
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border-l-4 border-[#00694c] shadow-sm">
                <div className="text-xs font-mono text-[#00694c] w-6 shrink-0">L5</div>
                <div>
                  <div className="text-xs font-semibold text-[#1a1c1b]">Ultra-Wear Clear Coat (UV-Protective)</div>
                  <div className="text-[10px] text-slate-500">Scratch-resistant silica seal protecting pigmentation and friction levels.</div>
                </div>
              </div>

              {/* Layer 4 */}
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border-l-4 border-emerald-500 shadow-sm">
                <div className="text-xs font-mono text-emerald-600 w-6 shrink-0">L4</div>
                <div>
                  <div className="text-xs font-semibold text-[#1a1c1b]">Pigmented Textured Finish</div>
                  <div className="text-[10px] text-slate-500">Vibrant non-glare chartreuse hue engineered for precise bounce traction.</div>
                </div>
              </div>

              {/* Layer 3 */}
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border-l-4 border-green-400 shadow-sm">
                <div className="text-xs font-mono text-green-600 w-6 shrink-0">L3</div>
                <div>
                  <div className="text-xs font-semibold text-[#1a1c1b]">Core Cushioned Elastic Layer</div>
                  <div className="text-[10px] text-slate-500">Liquid rubber granules absorbing 22% of joint and muscular foot-strike impact.</div>
                </div>
              </div>

              {/* Layer 2 */}
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border-l-4 border-slate-300 shadow-sm">
                <div className="text-xs font-mono text-slate-500 w-6 shrink-0">L2</div>
                <div>
                  <div className="text-xs font-semibold text-[#1a1c1b]">Acrylic Resurfacer Filler</div>
                  <div className="text-[10px] text-slate-500">Creates completely flat, shadowless, void-free leveling.</div>
                </div>
              </div>

              {/* Layer 1 */}
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border-l-4 border-slate-200 shadow-sm">
                <div className="text-xs font-mono text-slate-400 w-6 shrink-0">L1</div>
                <div>
                  <div className="text-xs font-semibold text-[#1a1c1b]">Reinforced Concrete Sub-Base</div>
                  <div className="text-[10px] text-slate-500">Laser-leveled heavy aggregate substrate resisting moisture and heat shifts.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#f0f4f1] rounded-xl border border-[#bccac1]">
              <div className="flex items-center gap-2 text-[#00694c] mb-1.5">
                <Award className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-wider font-semibold">Joint Safety</span>
              </div>
              <div className="text-2xl font-bold font-sans text-[#1a1c1b]">22%</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Impact energy absorption reduces fatigue compared to asphalt.</p>
            </div>

            <div className="p-4 bg-[#f0f4f1] rounded-xl border border-[#bccac1]">
              <div className="flex items-center gap-2 text-emerald-600 mb-1.5">
                <Ruler className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-wider font-semibold">Planimetry</span>
              </div>
              <div className="text-2xl font-bold font-sans text-[#1a1c1b]">&lt;0.5mm</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Maximum deviation across the court lines ensuring perfectly true bounce.</p>
            </div>
          </div>

          <div className="flex gap-3 bg-[#f5f8f6] p-4 rounded-xl border border-[#bccac1] text-xs text-slate-600 items-start">
            <Landmark className="w-5 h-5 text-[#00694c] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#1a1c1b] mb-1">USA Pickleball Association (USAPA) Compliant</p>
              <p>Certified for official tournaments, local leagues, and recreational ladder matches alike. Fast drainage technology allows plays to support gameplay within 15 minutes of extreme downpours.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 text-xs font-mono uppercase bg-[#00694c] text-white rounded-lg font-bold hover:bg-[#005a40] active:scale-95 transition-all cursor-pointer"
          >
            Acknowledge & Back
          </button>
        </div>
      </div>
    </div>
  );
}
