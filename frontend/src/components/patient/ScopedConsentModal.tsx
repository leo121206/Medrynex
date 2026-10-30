import React, { useState } from 'react';
import { AccessRequest } from '../../types/access';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { RiskIndicator } from '../ui/RiskIndicator';
import { consentService } from '../../services/consent.service';
import { useNotification } from '../../context/NotificationContext';
import { ShieldCheck, KeyRound, Layers } from 'lucide-react';

interface ScopedConsentModalProps {
  request: AccessRequest;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ScopedConsentModal: React.FC<ScopedConsentModalProps> = ({
  request,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useNotification();
  const initialCategories: string[] = Array.isArray((request as any).categories)
    ? (request as any).categories
    : request.recordType
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

  const [approvedCategories, setApprovedCategories] = useState<string[]>(initialCategories);
  const [durationDays, setDurationDays] = useState(request.durationDays || 7);
  const [understoodScope, setUnderstoodScope] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const expiryDate = new Date(Date.now() + durationDays * 86400000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const toggleCategory = (cat: string) => {
    setApprovedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleGrantAccess = async () => {
    if (approvedCategories.length === 0) {
      showToast('Please select at least one record category to authorize, or reject the request', 'warning');
      return;
    }
    if (!understoodScope) {
      showToast('Please acknowledge the scope understanding checkbox', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      await consentService.grantScopedAccess(request.id, durationDays, {
        categories: approvedCategories,
        recordType: approvedCategories.join(', '),
      });
      showToast(
        `Patient-level access granted to ${request.doctorName} for [${approvedCategories.join(', ')}] (${durationDays} days)`,
        'success'
      );
      onSuccess();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to grant consent', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Consolidated Patient-Level Access Request"
      subtitle={`Clinician authorization request from ${request.doctorName}`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Clinician & Trust Tier Overview */}
        <div className="p-4 bg-[#F8F3EA] rounded-2xl border border-[#DDE5DA] grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[#66736A] block">Requesting Doctor:</span>
            <strong className="text-[#26352A] text-sm block">{request.doctorName}</strong>
            <span className="text-[#66736A]">{request.doctorSpecialty}</span>
          </div>
          <div>
            <span className="text-[#66736A] block">Hospital &amp; Trust Status:</span>
            <strong className="text-[#26352A] text-sm block">{request.hospital}</strong>
            <div className="mt-1">
              <Badge variant="success">
                {(request as any).tierLabel || 'T1 — Verified Relationship'} → T2 Upon Approval
              </Badge>
            </div>
          </div>
        </div>

        {/* Category Restriction & Scope Configuration */}
        <div className="p-4 bg-white border border-[#A8CBA0] rounded-2xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#47634C] uppercase tracking-wider">
              <KeyRound className="w-4 h-4 text-[#47634C]" />
              <span>Consolidated Patient-Level Scope &amp; Category Control</span>
            </div>
            <span className="text-[11px] font-semibold text-[#5F8D65]">
              {approvedCategories.length} of {initialCategories.length} Categories Approved
            </span>
          </div>

          <p className="text-xs text-[#66736A]">
            You may uncheck any category below to restrict the scope before approving. All documents in the checked categories will be unlocked for this clinician during the active window.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {initialCategories.map((cat) => {
              const checked = approvedCategories.includes(cat);
              return (
                <label
                  key={cat}
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition-all ${
                    checked
                      ? 'bg-[#E7F0E4]/80 border-[#5F8D65] font-bold text-[#26352A]'
                      : 'bg-gray-50 border-[#DDE5DA] text-[#66736A] line-through'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(cat)}
                    className="w-4 h-4 rounded accent-[#47634C]"
                  />
                  <Layers className="w-3.5 h-3.5 text-[#47634C]" />
                  <span>{cat}</span>
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#DDE5DA]">
            <Select
              label="Permitted Access Duration"
              value={durationDays.toString()}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              options={[
                { value: '1', label: '24 Hours (1 Day)' },
                { value: '3', label: '3 Days' },
                { value: '7', label: '7 Days (Standard)' },
                { value: '14', label: '14 Days' },
                { value: '30', label: '30 Days' },
              ]}
            />
            <div className="text-xs space-y-1">
              <span className="block font-semibold text-[#47634C]">Active Time Window</span>
              <div className="p-2.5 bg-[#F2E7D5]/70 rounded-xl border border-[#DDE5DA]">
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Start:</span>
                  <span className="font-semibold text-[#26352A]">{today}</span>
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[#66736A]">Expires:</span>
                  <span className="font-bold text-[#C85C5C]">{expiryDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Risk Component */}
        <RiskIndicator assessment={request.riskAssessment} />

        {/* Scope Understanding Checkbox */}
        <div className="p-3.5 bg-[#E7F0E4]/60 border border-[#A8CBA0]/60 rounded-xl space-y-2">
          <p className="text-xs text-[#26352A] leading-relaxed font-medium">
            {request.doctorName} will <strong>ONLY</strong> be able to access your records in{' '}
            <strong>[{approvedCategories.join(', ') || 'No Categories Selected'}]</strong> for{' '}
            <strong>{request.purpose}</strong> during the next <strong>{durationDays} Days</strong>. You can revoke this grant at any time with 0ms enforcement.
          </p>
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={understoodScope}
              onChange={(e) => setUnderstoodScope(e.target.checked)}
              className="w-4 h-4 rounded-md accent-[#47634C]"
            />
            <span className="text-xs font-bold text-[#26352A]">
              ☑ I understand and authorize this consolidated patient-level access scope.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DDE5DA]">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleGrantAccess}
            isLoading={isSubmitting}
            disabled={approvedCategories.length === 0}
            icon={<ShieldCheck className="w-4 h-4" />}
          >
            Approve Patient-Level Grant ({approvedCategories.length} Categories)
          </Button>
        </div>
      </div>
    </Modal>
  );
};

