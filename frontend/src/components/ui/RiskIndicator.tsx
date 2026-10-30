import React from 'react';
import { AnomalyAssessment } from '../../types/access';
import { Check, AlertTriangle, ShieldCheck, Info } from 'lucide-react';

interface RiskIndicatorProps {
  assessment: AnomalyAssessment;
  compact?: boolean;
}

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({ assessment, compact = false }) => {
  const safeAssessment = (assessment || {}) as Partial<AnomalyAssessment> & Record<string, unknown>;
  const score = typeof safeAssessment.score === 'number' ? safeAssessment.score : 15;
  const rawLevel = String(safeAssessment.riskLevel || safeAssessment.level || 'Low').toLowerCase();
  const riskLevel: 'Low' | 'Moderate' | 'High' =
    rawLevel === 'high'
      ? 'High'
      : rawLevel === 'moderate' || rawLevel === 'medium'
        ? 'Moderate'
        : 'Low';

  const summary =
    safeAssessment.summary ||
    (riskLevel === 'High'
      ? 'Elevated Access Pattern Detected'
      : riskLevel === 'Moderate'
        ? 'Moderate Clinical Context Variance'
        : 'Normal Clinical Request Pattern');

  const checks = {
    specialtyMatch: safeAssessment.checks?.specialtyMatch ?? score < 65,
    hospitalMatch: safeAssessment.checks?.hospitalMatch ?? true,
    frequencyElevated: safeAssessment.checks?.frequencyElevated ?? score >= 50,
    recordTypeUnusual: safeAssessment.checks?.recordTypeUnusual ?? score >= 65,
  };

  const explanation =
    safeAssessment.explanation ||
    (safeAssessment.recommendation as string) ||
    'Evaluated by Medrynx AI Anomaly Detection Engine against verified clinical relationship and category scope.';

  const colorStyles = {
    Low: {
      bg: 'bg-[#E7F0E4]',
      border: 'border-[#A8CBA0]',
      text: 'text-[#47634C]',
      badgeBg: 'bg-[#A8CBA0]',
      badgeText: 'text-[#26352A]',
      scoreColor: 'text-[#5F8D65]',
    },
    Moderate: {
      bg: 'bg-[#fcf5e5]',
      border: 'border-[#D9A441]',
      text: 'text-[#8c651f]',
      badgeBg: 'bg-[#D9A441]',
      badgeText: 'text-white',
      scoreColor: 'text-[#D9A441]',
    },
    High: {
      bg: 'bg-[#fceded]',
      border: 'border-[#C85C5C]',
      text: 'text-[#8a2f2f]',
      badgeBg: 'bg-[#C85C5C]',
      badgeText: 'text-white',
      scoreColor: 'text-[#C85C5C]',
    },
  };

  const style = colorStyles[riskLevel] || colorStyles.Low;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${style.bg} ${style.border}`}>
        <span className={`text-sm font-bold ${style.scoreColor}`}>{score}/100</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${style.badgeBg} ${style.badgeText}`}>
          {riskLevel} Risk
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${style.bg} ${style.border} space-y-4`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#47634C]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#47634C]">AI Access Assessment</span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.badgeBg} ${style.badgeText}`}>
          {riskLevel} Risk
        </span>
      </div>

      {/* Score Header */}
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-extrabold ${style.scoreColor}`}>{score}</span>
        <span className="text-sm font-medium text-[#66736A]">/ 100</span>
        <span className="text-xs text-[#66736A] font-medium ml-2">• {summary}</span>
      </div>

      {/* Pattern Checks Grid */}
      <div className="space-y-1.5 pt-1 border-t border-[#DDE5DA]/50 text-xs">
        <div className="flex justify-between items-center py-1">
          <span className="text-[#26352A] font-medium">Doctor Specialty Match</span>
          {checks.specialtyMatch ? (
            <span className="text-[#5F8D65] font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Verified
            </span>
          ) : (
            <span className="text-[#C85C5C] font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Mismatch
            </span>
          )}
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-[#26352A] font-medium">Hospital Affiliation Verified</span>
          {checks.hospitalMatch ? (
            <span className="text-[#5F8D65] font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Verified
            </span>
          ) : (
            <span className="text-[#C85C5C] font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Unverified
            </span>
          )}
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-[#26352A] font-medium">Request Frequency Pattern</span>
          {checks.frequencyElevated ? (
            <span className="text-[#D9A441] font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Elevated
            </span>
          ) : (
            <span className="text-[#5F8D65] font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Normal
            </span>
          )}
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-[#26352A] font-medium">Record Type Pattern</span>
          {checks.recordTypeUnusual ? (
            <span className="text-[#D9A441] font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Less Common
            </span>
          ) : (
            <span className="text-[#5F8D65] font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Standard
            </span>
          )}
        </div>
      </div>

      {/* Explanation text */}
      <p className="text-xs text-[#26352A] bg-white/70 p-3 rounded-xl border border-[#DDE5DA]">
        {explanation}
      </p>

      {/* Footer Disclaimer */}
      <div className="flex items-start gap-1.5 text-[11px] text-[#66736A] italic pt-1">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#47634C]" />
        <span>AI-generated decision-support signal. This score does not automatically approve or reject access.</span>
      </div>
    </div>
  );
};
