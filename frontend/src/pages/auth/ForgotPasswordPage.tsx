import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Shield, Cross, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F2E7D5] flex items-center justify-center p-4 font-sans">
      <Card padding="lg" className="w-full max-w-md bg-white shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-[#47634C] text-[#A8CBA0] flex items-center justify-center">
              <Shield className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-2xl font-extrabold text-[#26352A]">MEDRYNX</span>
          </Link>
          <h2 className="text-xl font-bold text-[#26352A]">Reset Password</h2>
          <p className="text-xs text-[#66736A]">Enter your email to receive recovery instructions</p>
        </div>

        {submitted ? (
          <div className="text-center p-4 bg-[#E7F0E4] rounded-2xl space-y-3 border border-[#A8CBA0]">
            <CheckCircle2 className="w-8 h-8 text-[#5F8D65] mx-auto" />
            <h4 className="text-sm font-bold text-[#26352A]">Recovery Email Sent</h4>
            <p className="text-xs text-[#66736A]">
              We have dispatched password reset instructions to <span className="font-semibold text-[#26352A]">{email}</span>.
            </p>
            <Link to="/login" className="inline-block pt-2 text-xs font-bold text-[#47634C] hover:underline">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Account Email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />
            <Button type="submit" variant="primary" className="w-full py-3">
              Send Reset Link
            </Button>
            <div className="text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-[#47634C] font-semibold hover:underline">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
