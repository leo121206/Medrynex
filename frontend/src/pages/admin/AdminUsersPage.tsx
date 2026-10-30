import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { Search } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { useApiCall } from '../../hooks/useApiCall';

interface AdminUserRow {
  id: string;
  name: string;
  role: string;
  hospital: string;
  status: string;
  email: string;
}

export const AdminUsersPage: React.FC = () => {
  const { data: users, loading, error, refetch } = useApiCall<AdminUserRow[]>(
    () => adminService.getAllUsers(),
    []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.hospital.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">User Management</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          View registered patients, clinicians, and system accounts across organizations.
        </p>
      </div>

      <Card padding="md" className="flex flex-col sm:flex-row items-center gap-4 bg-white">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search users by name, email, or hospital..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: 'All', label: 'All Roles' },
              { value: 'Doctor', label: 'Doctor' },
              { value: 'Patient', label: 'Patient' },
              { value: 'Super Admin', label: 'Super Admin' },
            ]}
          />
        </div>
      </Card>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && filteredUsers.length === 0}
        emptyTitle="No matching users found"
        emptyMessage="No registered accounts match your current search or role filter."
        onRetry={refetch}
        skeletonRows={4}
      >
        <Card padding="none" className="overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DDE5DA] text-[11px] font-bold uppercase text-[#66736A] bg-[#F8F3EA]">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Organization / Hospital</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DA] text-xs">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#F2E7D5]/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#26352A]">{u.name}</div>
                    <div className="text-[11px] text-[#66736A]">{u.email}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-[#47634C]">{u.role}</span>
                  </td>
                  <td className="py-3.5 px-4 text-[#66736A]">{u.hospital}</td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={u.status === 'Active' ? 'approved' : 'pending'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </ApiStateWrapper>
    </div>
  );
};
