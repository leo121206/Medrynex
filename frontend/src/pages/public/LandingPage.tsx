import React from 'react';
import { PublicNavbar } from '../../components/layout/PublicNavbar';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { 
  ShieldCheck, KeyRound, Cpu, AlertOctagon, History, Lock, 
  CheckCircle2, ArrowRight, Activity, FileText, UserCheck, ShieldAlert 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F2E7D5] flex flex-col font-sans">
      <PublicNavbar />

      {/* HERO SECTION */}
      <section className="pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E7F0E4] border border-[#A8CBA0]/80 text-[#47634C] text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#5F8D65]" />
              <span>Next-Gen Healthcare Cybersecurity & Consent Protocol</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#26352A] tracking-tight leading-[1.1]">
              Your Medical Records. <br />
              <span className="text-[#47634C]">Your Consent.</span> <br />
              Your Control.
            </h1>

            <p className="text-base sm:text-lg text-[#66736A] max-w-2xl leading-relaxed">
              Medrynx provides a secure and transparent way to manage electronic health records while giving patients meaningful control over who can access their medical information with scope-bound consent and AI anomaly monitoring.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button size="lg" variant="primary" icon={<ArrowRight className="w-5 h-5" />} onClick={() => navigate('/register')}>
                Get Started
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/features')}>
                Explore Platform
              </Button>
            </div>

            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-[#DDE5DA]">
              <div>
                <span className="text-2xl font-bold text-[#47634C]">100%</span>
                <p className="text-xs text-[#66736A]">Patient-Controlled Scope</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-[#47634C]">SHA-256</span>
                <p className="text-xs text-[#66736A]">Off-Chain Hash Anchoring</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-[#47634C]">AI Scored</span>
                <p className="text-xs text-[#66736A]">Anomaly Access Detection</p>
              </div>
            </div>
          </div>

          {/* Right Preview Card */}
          <div className="lg:col-span-5 relative">
            <div className="absolute -top-6 -left-6 w-72 h-72 bg-[#A8CBA0]/20 rounded-full blur-3xl pointer-events-none" />
            
            <Card padding="lg" className="relative shadow-2xl border-[#DDE5DA] space-y-5 bg-white/95 backdrop-blur-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DDE5DA]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#C85C5C]" />
                  <div className="w-3 h-3 rounded-full bg-[#D9A441]" />
                  <div className="w-3 h-3 rounded-full bg-[#5F8D65]" />
                </div>
                <Badge variant="sage">Medrynx Consent Console</Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F3EA] border border-[#DDE5DA]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#47634C] text-white flex items-center justify-center font-semibold text-xs">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold text-[#26352A]">Verified Clinician Identity</h6>
                      <p className="text-[11px] text-[#66736A]">Role &amp; License Attestation • ABAC Policy</p>
                    </div>
                  </div>
                  <Badge variant="sage">AI Evaluated</Badge>
                </div>

                <div className="p-3.5 rounded-xl bg-[#E7F0E4]/60 border border-[#A8CBA0]/50 space-y-2">
                  <div className="flex justify-between text-xs text-[#47634C] font-semibold">
                    <span>Scope-Bound Grant</span>
                    <span>Time-Limited</span>
                  </div>
                  <p className="text-xs font-bold text-[#26352A]">Category-Scoped Record Authorization</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#5F8D65] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Patient-controlled purpose &amp; automatic expiry
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#DDE5DA]">
                  <div className="flex items-center gap-2 text-xs text-[#26352A]">
                    <Lock className="w-4 h-4 text-[#5F8D65]" />
                    <span>AES-256-GCM + On-Chain SHA-256 Proof</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#66736A]">Verified</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 6 CORE FEATURES SECTION */}
      <section className="py-20 bg-white border-y border-[#DDE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-extrabold text-[#26352A]">
              Architected for Complete Security & Patient Sovereignty
            </h2>
            <p className="text-sm text-[#66736A]">
              Built strictly according to the Medrynx proposal specification, protecting medical privacy without impeding critical health delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <Card hoverable padding="lg" className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E7F0E4] text-[#47634C] flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#26352A]">Scope-Bound Consent</h3>
              <p className="text-xs text-[#66736A] leading-relaxed">
                Control clinician access with precision bound by record type, specific clinical purpose, and exact expiration duration.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card hoverable padding="lg" className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#fcf5e5] text-[#D9A441] flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#26352A]">AI Anomaly Detection</h3>
              <p className="text-xs text-[#66736A] leading-relaxed">
                Identify unusual access patterns and specialty mismatches using machine learning scoring prior to patient approval.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card hoverable padding="lg" className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#fceded] text-[#C85C5C] flex items-center justify-center">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#26352A]">Tiered Emergency Access</h3>
              <p className="text-xs text-[#66736A] leading-relaxed">
                Break-glass emergency workflow with verified hospital identity and time-limited full authorization codes.
              </p>
            </Card>

            {/* Feature 4 */}
            <Card hoverable padding="lg" className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E7F0E4] text-[#47634C] flex items-center justify-center">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#26352A]">Audit Transparency</h3>
              <p className="text-xs text-[#66736A] leading-relaxed">
                Complete verifiable record access transparency showing exactly who accessed data, when, and for what purpose.
              </p>
            </Card>

            {/* Feature 5 */}
            <Card hoverable padding="lg" className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E7F0E4] text-[#47634C] flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#26352A]">Secure Off-Chain Storage</h3>
              <p className="text-xs text-[#66736A] leading-relaxed">
                Encrypted medical records stored securely off-chain with cryptographic SHA-256 hash anchoring on smart contracts.
              </p>
            </Card>

            {/* Feature 6 */}
            <Card hoverable padding="lg" className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#fcf5e5] text-[#D9A441] flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#26352A]">Post-Emergency Reconciliation</h3>
              <p className="text-xs text-[#66736A] leading-relaxed">
                Every emergency break-glass event requires mandatory patient post-hoc review, with full dispute tracking capabilities.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};
