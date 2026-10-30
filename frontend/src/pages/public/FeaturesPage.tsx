import React from 'react';
import { PublicNavbar } from '../../components/layout/PublicNavbar';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { Card } from '../../components/ui/Card';
import { KeyRound, Cpu, AlertOctagon, History, Lock, ShieldAlert, Layers } from 'lucide-react';

export const FeaturesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F2E7D5] flex flex-col font-sans">
      <PublicNavbar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#26352A]">Medrynx Core Platform Capabilities</h1>
          <p className="text-sm text-[#66736A]">
            Discover how scope-bound consent, anomaly detection, break-glass emergency access, and post-emergency reconciliation protect health data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card padding="lg" className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#A8CBA0] text-[#26352A] flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#26352A]">1. Scope-Bound Consent Engine</h3>
            <p className="text-xs text-[#66736A] leading-relaxed">
              Traditional EHRs grant blanket access to entire medical profiles. Medrynx limits clinician authorization to specific record categories (e.g. Cardiology ECG only), defined medical purposes (e.g. Diagnosis vs Follow-up), and strict expiration windows (e.g. 7 Days). Access automatically locks when time expires.
            </p>
          </Card>

          <Card padding="lg" className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#D9A441] text-white flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#26352A]">2. AI Anomaly Risk Assessment</h3>
            <p className="text-xs text-[#66736A] leading-relaxed">
              Every incoming clinician access request passes through an ML anomaly scoring model evaluating historical clinician patterns, specialty alignments, hospital affiliations, and record type frequencies. High risk score alerts (80+/100) are flagged for patient scrutiny.
            </p>
          </Card>

          <Card padding="lg" className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#C85C5C] text-white flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#26352A]">3. Tiered Emergency Break-Glass</h3>
            <p className="text-xs text-[#66736A] leading-relaxed">
              In critical trauma scenarios, clinicians cannot wait for patient approval. Medrynx offers Partial Access (Allergies, Medications, Blood Group) upon hospital identity verification, and Full Access for 30 minutes with an Emergency Authorization Code.
            </p>
          </Card>

          <Card padding="lg" className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#47634C] text-white flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#26352A]">4. Consent Batching</h3>
            <p className="text-xs text-[#66736A] leading-relaxed">
              Prevent notification fatigue! Group multiple related low-risk care team requests (e.g. 4 clinicians involved in an outpatient check-up) into a single unified consent decision card for one-click approval.
            </p>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};
