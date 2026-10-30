import React from 'react';
import { PublicNavbar } from '../../components/layout/PublicNavbar';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { Card } from '../../components/ui/Card';
import { ShieldCheck, Lock, Cpu, Database, FileCheck } from 'lucide-react';

export const SecurityPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F2E7D5] flex flex-col font-sans">
      <PublicNavbar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7F0E4] border border-[#A8CBA0] text-[#47634C] text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#5F8D65]" /> Security & Cryptographic Architecture
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#26352A]">Zero-Trust EHR Protection</h1>
          <p className="text-sm text-[#66736A]">
            Medrynx decouples sensitive health payload storage from blockchain ledger anchoring to guarantee performance, confidentiality, and tamper-proof verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card padding="lg" className="space-y-3">
            <Lock className="w-8 h-8 text-[#47634C]" />
            <h3 className="text-base font-bold text-[#26352A]">AES-256 Off-Chain Encryption</h3>
            <p className="text-xs text-[#66736A]">
              Medical files are client-side encrypted before off-chain storage on IPFS/secure medical databases. Raw medical payloads never touch public ledgers.
            </p>
          </Card>

          <Card padding="lg" className="space-y-3">
            <Database className="w-8 h-8 text-[#47634C]" />
            <h3 className="text-base font-bold text-[#26352A]">SHA-256 Hash Anchoring</h3>
            <p className="text-xs text-[#66736A]">
              Cryptographic SHA-256 hashes of encrypted records are anchored on Ethereum smart contracts to ensure data integrity and detect any unauthorized file tampering.
            </p>
          </Card>

          <Card padding="lg" className="space-y-3">
            <Cpu className="w-8 h-8 text-[#D9A441]" />
            <h3 className="text-base font-bold text-[#26352A]">Scikit-Learn ML Scoring</h3>
            <p className="text-xs text-[#66736A]">
              Machine learning access evaluation engine analyzes specialty alignment, historical request frequency, and time window deviations to provide decision-support risk scores.
            </p>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};
