import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { apiRequest } from '../../services/apiClient';
import { User, Mail, Phone, Calendar, CheckCircle2 } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
}) => {
  const { user, role } = useAuth();
  const { showToast } = useNotification();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dob, setDob] = useState((user as any)?.dob || '');
  const [bloodGroup, setBloodGroup] = useState((user as any)?.bloodGroup || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await apiRequest<Record<string, unknown>>('/auth/me', {
        method: 'PATCH',
        data: {
          name,
          email,
          phone,
          ...(role === 'patient' ? { dob, bloodGroup } : {}),
        },
      });

      if (user) {
        user.name = (updated.name as string) || name;
        user.email = (updated.email as string) || email;
        user.phone = (updated.phone as string) || phone;
        if (role === 'patient') {
          (user as any).dob = (updated.dob as string) || dob;
          (user as any).bloodGroup = (updated.bloodGroup as string) || bloodGroup;
        }
      }

      showToast('Profile information updated successfully!', 'success');
      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update profile information',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile Information"
      subtitle="Update your personal details &amp; contact preferences"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="flex items-center gap-4 p-3 bg-[#F8F3EA] rounded-2xl border border-[#DDE5DA]">
          <div className="w-14 h-14 rounded-full bg-[#47634C] text-[#A8CBA0] flex items-center justify-center font-bold text-xl shadow-xs">
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="space-y-1">
            <span className="block font-semibold text-[#26352A]">{name || 'Account Profile'}</span>
            <span className="text-[11px] text-[#66736A] capitalize">{role || 'User'} Account</span>
          </div>
        </div>

        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
          />
        </div>

        {role === 'patient' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Date of Birth"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4" />}
            />
            <Select
              label="Blood Group"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              options={[
                { value: '', label: 'Select Blood Group...' },
                { value: 'O+', label: 'O+' },
                { value: 'O-', label: 'O-' },
                { value: 'A+', label: 'A+' },
                { value: 'A-', label: 'A-' },
                { value: 'B+', label: 'B+' },
                { value: 'B-', label: 'B-' },
                { value: 'AB+', label: 'AB+' },
                { value: 'AB-', label: 'AB-' },
              ]}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DDE5DA]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving} icon={<CheckCircle2 className="w-4 h-4" />}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
