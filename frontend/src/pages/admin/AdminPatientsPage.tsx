import React from 'react';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { adminService, AdminPatient } from '../../services/admin.service';
import { useApiCall } from '../../hooks/useApiCall';

export const AdminPatientsPage: React.FC = () => {
  const { data: patients, loading, error, refetch } = useApiCall<AdminPatient[]>(
    () => adminService.getPatients(),
    []
  );

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Patient Account Management</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Platform-level patient identity monitoring and account status overview.
        </p>
      </div>

      {/* Admin Warning Note */}
      <div className="p-3 bg-[#E7F0E4] border border-[#A8CBA0] rounded-xl text-xs text-[#47634C]">
        🔒 <strong>Privacy Mandate:</strong> Super Admin accounts manage platform identities and access logs only. Patient medical record payloads remain encrypted and inaccessible to administrative roles.
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && patients.length === 0}
        emptyTitle="No patients registered"
        emptyMessage="Patient accounts will appear here once users register on the platform."
        onRetry={refetch}
        skeletonRows={4}
      >
        <Card padding="none" className="overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DDE5DA] text-[11px] font-bold uppercase text-[#66736A] bg-[#F8F3EA]">
                  <th className="py-3.5 px-4">Patient ID</th>
                  <th className="py-3.5 px-4">Name</th>
                  <th className="py-3.5 px-4">Registration Date</th>
                  <th className="py-3.5 px-4">Active Consents</th>
                  <th className="py-3.5 px-4">Last Activity</th>
                  <th className="py-3.5 px-4">Account Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE5DA] text-xs">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F2E7D5]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#47634C]">{p.id}</td>
                    <td className="py-3.5 px-4 font-bold text-[#26352A]">{p.name}</td>
                    <td className="py-3.5 px-4 text-[#66736A]">{p.regDate}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#26352A]">{p.activeConsents} Active Scopes</td>
                    <td className="py-3.5 px-4 text-[#66736A]">{p.lastActivity}</td>
                    <td className="py-3.5 px-4"><StatusBadge status={p.status === 'active' ? 'active' : 'pending'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </ApiStateWrapper>
    </div>
  );
};
