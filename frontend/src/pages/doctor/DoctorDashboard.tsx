import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Users, ShieldAlert, FileText, AlertOctagon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { consentService } from '../../services/consent.service';
import { emergencyService } from '../../services/emergency.service';
import { relationshipService } from '../../services/relationship.service';
import { getTimeBasedGreeting } from '../../utils/greeting';

export const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patientsCount, setPatientsCount] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [activeConsents, setActiveConsents] = useState<any[]>([]);
  const [emergencyEventsCount, setEmergencyEventsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    let isMounted = true;
    setError(null);
    Promise.all([
      relationshipService.getPatientDirectory(),
      consentService.getDoctorAccessRequests(),
      consentService.getActiveConsents(),
      emergencyService.getEmergencyEvents(),
    ]).then(([patients, requests, consents, emergencies]) => {
      if (isMounted) {
        setPatientsCount(patients.length);
        setPendingRequestsCount(requests.filter((r) => r.status === 'pending' || (r.status as string) === 'PENDING').length);
        setActiveConsents(consents);
        setEmergencyEventsCount(emergencies.length);
        setIsLoading(false);
      }
    }).catch((err) => {
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-8 font-sans">
      {/* Banner with Dynamic Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#DDE5DA]">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">
            {getTimeBasedGreeting()}, {user?.name || 'Doctor'} 👋
          </h2>
          <p className="text-xs text-[#66736A] mt-1">
            {(user as any)?.hospital || 'Affiliated Facility'} • {(user as any)?.specialization || 'Clinical Medicine'}
          </p>
        </div>
        <Button variant="primary" icon={<ShieldAlert className="w-4 h-4" />} onClick={() => navigate('/doctor/access-requests')}>
          Request Patient Access
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Stats Grid (100% Dynamic) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card padding="md" className="space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">My Patients</span>
            <Users className="w-5 h-5 text-[#47634C]" />
          </div>
          <span className="text-3xl font-extrabold text-[#26352A]">
            {isLoading ? '...' : patientsCount}
          </span>
        </Card>

        <Card padding="md" className="space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Pending Requests</span>
            <ShieldAlert className="w-5 h-5 text-[#D9A441]" />
          </div>
          <span className="text-3xl font-extrabold text-[#26352A]">
            {isLoading ? '...' : pendingRequestsCount}
          </span>
        </Card>

        <Card padding="md" className="space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Authorized Records</span>
            <FileText className="w-5 h-5 text-[#5F8D65]" />
          </div>
          <span className="text-3xl font-extrabold text-[#26352A]">
            {isLoading ? '...' : activeConsents.length}
          </span>
        </Card>

        <Card padding="md" className="space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Emergency Events</span>
            <AlertOctagon className="w-5 h-5 text-[#C85C5C]" />
          </div>
          <span className="text-3xl font-extrabold text-[#26352A]">
            {isLoading ? '...' : emergencyEventsCount}
          </span>
        </Card>
      </div>

      {/* Recent Patients Table (Dynamic from activeConsents) */}
      <Card padding="md" className="space-y-4 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#26352A]">Recent Authorized Patients</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/patients')}>
            View All Patients <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DDE5DA] text-[11px] font-bold uppercase text-[#66736A]">
                <th className="py-3 px-3">Patient</th>
                <th className="py-3 px-3">Scope Window</th>
                <th className="py-3 px-3">Authorized Record</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DA] text-xs">
              {activeConsents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#66736A]">
                    No active consent scopes currently granted. Submit an access request to begin.
                  </td>
                </tr>
              ) : (
                activeConsents.map((consent) => (
                  <tr key={consent.id} className="hover:bg-[#F2E7D5]/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-[#26352A]">
                      {consent.patientName || '—'} {consent.patientId ? `(${consent.patientId})` : ''}
                    </td>
                    <td className="py-3 px-3 text-[#66736A]">{consent.accessStart} – {consent.accessExpiry}</td>
                    <td className="py-3 px-3 text-[#47634C] font-semibold">{consent.recordType}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={consent.status === 'active' ? 'active' : 'expired'} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => navigate('/doctor/authorized-records')}>
                        View Records
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
