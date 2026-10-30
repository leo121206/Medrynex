import React from 'react';
import { Shield, Cross } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="bg-[#47634C] text-[#F2E7D5] py-12 border-t border-[#DDE5DA]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#A8CBA0] text-[#26352A] flex items-center justify-center">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-lg font-bold text-white">MEDRYNX</span>
          </div>
          <p className="text-xs text-[#A8CBA0]/80 leading-relaxed">
            Secure Healthcare. Patient-Controlled Access. Next-generation EHR consent architecture powered by blockchain integrity and AI anomaly detection.
          </p>
        </div>

        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Platform</h5>
          <ul className="space-y-2 text-xs text-[#E7F0E4]/80">
            <li><Link to="/patient/dashboard" className="hover:text-white">Patient Portal</Link></li>
            <li><Link to="/doctor/dashboard" className="hover:text-white">Clinician Portal</Link></li>
            <li><Link to="/admin/dashboard" className="hover:text-white">Super Admin Console</Link></li>
            <li><Link to="/security" className="hover:text-white">Security Architecture</Link></li>
          </ul>
        </div>

        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Core Modules</h5>
          <ul className="space-y-2 text-xs text-[#E7F0E4]/80">
            <li>Scope-Bound Consent</li>
            <li>AI Anomaly Detection</li>
            <li>Tiered Emergency Access</li>
            <li>Post-Emergency Reconciliation</li>
            <li>Audit Transparency</li>
          </ul>
        </div>

        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Compliance & Security</h5>
          <p className="text-xs text-[#E7F0E4]/70 mb-3">
            SHA-256 Off-chain storage hash anchoring with Ganache local node integration.
          </p>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A8CBA0]/20 text-[#A8CBA0] text-xs font-medium border border-[#A8CBA0]/30">
            ✓ Production Ready Specification
          </span>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-[#F2E7D5]/10 text-center text-xs text-[#E7F0E4]/60">
        © 2026 Medrynx Healthcare Security Systems. All rights reserved.
      </div>
    </footer>
  );
};
