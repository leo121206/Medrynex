import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { AdminUser } from '../../types/user';

export const AdminProfilePage: React.FC = () => {
  const { user } = useAuth();
  const adminUser = user as AdminUser | null;
  const permissions = adminUser?.permissions || [];

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Super Admin Profile</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Security compliance officer profile &amp; system permission credentials.
        </p>
      </div>

      <Card padding="lg" className="max-w-2xl bg-white space-y-4">
        <div className="flex items-center gap-4 border-b border-[#DDE5DA] pb-4">
          <div className="w-14 h-14 rounded-full bg-[#47634C] text-[#A8CBA0] flex items-center justify-center text-xl font-bold">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#26352A]">{user?.name || 'Administrator'}</h3>
            <p className="text-xs text-[#66736A]">
              {user?.email} {adminUser?.department ? `• Department: ${adminUser.department}` : ''}
            </p>
            {adminUser?.adminId && (
              <p className="text-[11px] text-[#47634C] font-mono mt-0.5">Admin ID: {adminUser.adminId}</p>
            )}
            <Badge variant="dark" className="mt-1">Full Platform Admin Privileges</Badge>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <span className="font-bold text-[#47634C] block uppercase">Granted Administrative Permissions:</span>
          {permissions.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-[#66736A] bg-[#F8F3EA] p-3 rounded-xl border border-[#DDE5DA]">
              {permissions.map((perm) => (
                <li key={perm}>{perm}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[#66736A] bg-[#F8F3EA] p-3 rounded-xl border border-[#DDE5DA]">
              Standard role-based administrative permissions active.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
