import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Cross, Activity } from 'lucide-react';
import { Button } from '../ui/Button';

export const PublicNavbar: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-[#F2E7D5]/90 backdrop-blur-md border-b border-[#DDE5DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#47634C] text-[#A8CBA0] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <div className="relative flex items-center justify-center">
              <Shield className="w-6 h-6 stroke-[2.2]" />
              <Cross className="w-3.5 h-3.5 absolute text-white stroke-[3]" />
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-[#26352A] block leading-none">
              MEDRYNX
            </span>
            <span className="text-[10px] font-semibold text-[#47634C] tracking-wide block mt-1">
              PATIENT-CONTROLLED EHR
            </span>
          </div>
        </Link>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#47634C]">
          <Link to="/features" className="hover:text-[#26352A] transition-colors">Features</Link>
          <Link to="/how-it-works" className="hover:text-[#26352A] transition-colors">How It Works</Link>
          <Link to="/security" className="hover:text-[#26352A] transition-colors">Security Architecture</Link>
          <Link to="/about" className="hover:text-[#26352A] transition-colors">About</Link>
        </nav>

        {/* Auth Action Buttons */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/login')}>
            Login
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
};
