import React from 'react';
import { PublicNavbar } from '../../components/layout/PublicNavbar';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { Card } from '../../components/ui/Card';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F2E7D5] flex flex-col font-sans">
      <PublicNavbar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#26352A]">About Medrynx</h1>
          <p className="text-sm text-[#66736A]">
            "Secure Healthcare. Patient-Controlled Access."
          </p>
        </div>

        <Card padding="lg" className="max-w-3xl mx-auto space-y-4">
          <h3 className="text-lg font-bold text-[#26352A]">Our Core Purpose</h3>
          <p className="text-xs text-[#66736A] leading-relaxed">
            Medrynx was conceived to solve the critical privacy and security challenges of modern Electronic Health Records. Patients frequently lose visibility over who accesses their confidential health records, while clinicians face friction during legitimate care delivery or life-threatening emergency situations.
          </p>
          <p className="text-xs text-[#66736A] leading-relaxed">
            By uniting smart-contract audit transparency, scope-bound consent configuration, AI anomaly risk scoring, and post-emergency reconciliation, Medrynx restores full control to patients without compromising clinical workflow speed.
          </p>
        </Card>
      </main>
      <PublicFooter />
    </div>
  );
};
