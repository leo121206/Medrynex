import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Shield, Cross, LayoutDashboard, FileText, KeyRound, 
  AlertOctagon, History, ShieldAlert, Bell, User, Settings, 
  LogOut, Users, UserCheck, Stethoscope, FilePlus, Award, 
  Activity, Database, Cpu, AlertTriangle, FileSpreadsheet
} from 'lucide-react';

interface AppSidebarProps {
  onCloseMobile?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ onCloseMobile }) => {
  const { role, logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
      isActive
        ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs'
        : 'text-[#47634C] hover:bg-[#E7F0E4] hover:text-[#26352A]'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-[#DDE5DA] h-screen flex flex-col justify-between p-4 shrink-0 overflow-y-auto">
      {/* Top Header */}
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-xl bg-[#47634C] text-[#A8CBA0] flex items-center justify-center shadow-xs">
            <div className="relative flex items-center justify-center">
              <Shield className="w-5 h-5 stroke-[2.2]" />
              <Cross className="w-3 h-3 absolute text-white stroke-[3]" />
            </div>
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-[#26352A] block leading-none">
              MEDRYNX
            </span>
            <span className="text-[9px] font-bold text-[#47634C] uppercase tracking-wider block mt-1">
              {role} Portal
            </span>
          </div>
        </div>

        {/* Patient Sidebar */}
        {role === 'patient' && (
          <nav className="space-y-4">
            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Main
              </div>
              <NavLink to="/patient/dashboard" onClick={onCloseMobile} className={navLinkClass}>
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </NavLink>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Health Data
              </div>
              <div className="space-y-1">
                <NavLink to="/patient/records" onClick={onCloseMobile} className={navLinkClass}>
                  <FileText className="w-4 h-4" /> Medical Records
                </NavLink>
                <NavLink to="/patient/access-requests" onClick={onCloseMobile} className={navLinkClass}>
                  <ShieldAlert className="w-4 h-4" /> Access Requests
                </NavLink>
                <NavLink to="/patient/consent" onClick={onCloseMobile} className={navLinkClass}>
                  <KeyRound className="w-4 h-4" /> Consent Management
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Security & Audit
              </div>
              <div className="space-y-1">
                <NavLink to="/patient/emergency" onClick={onCloseMobile} className={navLinkClass}>
                  <AlertOctagon className="w-4 h-4" /> Emergency Access
                </NavLink>
                <NavLink to="/patient/audit" onClick={onCloseMobile} className={navLinkClass}>
                  <History className="w-4 h-4" /> Audit History
                </NavLink>
                <NavLink to="/patient/reconciliation" onClick={onCloseMobile} className={navLinkClass}>
                  <Award className="w-4 h-4" /> Reconciliation
                </NavLink>
                <NavLink to="/patient/disputes" onClick={onCloseMobile} className={navLinkClass}>
                  <AlertTriangle className="w-4 h-4" /> Disputes
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Account
              </div>
              <div className="space-y-1">
                <NavLink to="/patient/notifications" onClick={onCloseMobile} className={navLinkClass}>
                  <Bell className="w-4 h-4" /> Notifications
                </NavLink>
                <NavLink to="/patient/profile" onClick={onCloseMobile} className={navLinkClass}>
                  <User className="w-4 h-4" /> Profile
                </NavLink>
                <NavLink to="/patient/settings" onClick={onCloseMobile} className={navLinkClass}>
                  <Settings className="w-4 h-4" /> Settings
                </NavLink>
              </div>
            </div>
          </nav>
        )}

        {/* Doctor Sidebar */}
        {role === 'doctor' && (
          <nav className="space-y-4">
            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Main
              </div>
              <NavLink to="/doctor/dashboard" onClick={onCloseMobile} className={navLinkClass}>
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </NavLink>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Patient Care
              </div>
              <div className="space-y-1">
                <NavLink to="/doctor/patients" onClick={onCloseMobile} className={navLinkClass}>
                  <Users className="w-4 h-4" /> My Patients
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Access & Scopes
              </div>
              <div className="space-y-1">
                <NavLink to="/doctor/access-requests" onClick={onCloseMobile} className={navLinkClass}>
                  <ShieldAlert className="w-4 h-4" /> Access Requests
                </NavLink>
                <NavLink to="/doctor/authorized-records" onClick={onCloseMobile} className={navLinkClass}>
                  <FileText className="w-4 h-4" /> Authorized Records
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Emergency
              </div>
              <div className="space-y-1">
                <NavLink to="/doctor/emergency" onClick={onCloseMobile} className={navLinkClass}>
                  <AlertOctagon className="w-4 h-4" /> Break-Glass Emergency
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Account
              </div>
              <div className="space-y-1">
                <NavLink to="/doctor/profile" onClick={onCloseMobile} className={navLinkClass}>
                  <User className="w-4 h-4" /> Profile
                </NavLink>
                <NavLink to="/doctor/settings" onClick={onCloseMobile} className={navLinkClass}>
                  <Settings className="w-4 h-4" /> Settings
                </NavLink>
              </div>
            </div>
          </nav>
        )}

        {/* Super Admin Sidebar */}
        {role === 'admin' && (
          <nav className="space-y-4">
            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Main
              </div>
              <div className="space-y-1">
                <NavLink to="/admin/dashboard" onClick={onCloseMobile} className={navLinkClass}>
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </NavLink>
                <NavLink to="/admin/analytics" onClick={onCloseMobile} className={navLinkClass}>
                  <Activity className="w-4 h-4" /> Platform Analytics
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                User Management
              </div>
              <div className="space-y-1">
                <NavLink to="/admin/users" onClick={onCloseMobile} className={navLinkClass}>
                  <Users className="w-4 h-4" /> All Users
                </NavLink>
                <NavLink to="/admin/patients" onClick={onCloseMobile} className={navLinkClass}>
                  <UserCheck className="w-4 h-4" /> Patients
                </NavLink>
                <NavLink to="/admin/doctors" onClick={onCloseMobile} className={navLinkClass}>
                  <Stethoscope className="w-4 h-4" /> Doctors & Hospitals
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Access & Security
              </div>
              <div className="space-y-1">
                <NavLink to="/admin/access-logs" onClick={onCloseMobile} className={navLinkClass}>
                  <KeyRound className="w-4 h-4" /> Access Logs
                </NavLink>
                <NavLink to="/admin/emergency" onClick={onCloseMobile} className={navLinkClass}>
                  <AlertOctagon className="w-4 h-4" /> Emergency Events
                </NavLink>
                <NavLink to="/admin/anomalies" onClick={onCloseMobile} className={navLinkClass}>
                  <AlertTriangle className="w-4 h-4" /> AI Anomaly Alerts
                </NavLink>
                <NavLink to="/admin/audit" onClick={onCloseMobile} className={navLinkClass}>
                  <History className="w-4 h-4" /> System Audit Logs
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                System Infrastructure
              </div>
              <div className="space-y-1">
                <NavLink to="/admin/blockchain" onClick={onCloseMobile} className={navLinkClass}>
                  <Cpu className="w-4 h-4" /> Blockchain Status
                </NavLink>
                <NavLink to="/admin/storage" onClick={onCloseMobile} className={navLinkClass}>
                  <Database className="w-4 h-4" /> IPFS Storage Status
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736A]">
                Admin
              </div>
              <div className="space-y-1">
                <NavLink to="/admin/profile" onClick={onCloseMobile} className={navLinkClass}>
                  <User className="w-4 h-4" /> Admin Profile
                </NavLink>
                <NavLink to="/admin/settings" onClick={onCloseMobile} className={navLinkClass}>
                  <Settings className="w-4 h-4" /> Settings
                </NavLink>
              </div>
            </div>
          </nav>
        )}
      </div>

      {/* Footer Logout Button */}
      <div className="pt-4 border-t border-[#DDE5DA]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#C85C5C] hover:bg-[#fceded] transition-colors"
        >
          <span className="flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Logout
          </span>
          <span className="text-[10px] font-bold bg-[#fcf5e5] text-[#D9A441] px-2 py-0.5 rounded-md">
            v1.0
          </span>
        </button>
      </div>
    </aside>
  );
};
