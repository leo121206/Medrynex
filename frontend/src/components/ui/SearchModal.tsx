import React, { useState, useEffect } from 'react';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from './Modal';
import { Search, FileText, UserCheck, ShieldAlert, History, ArrowRight } from 'lucide-react';
import { recordsService } from '../../services/records.service';
import { consentService } from '../../services/consent.service';
import { auditService } from '../../services/audit.service';
import { adminService } from '../../services/admin.service';
import { useNavigate } from 'react-router-dom';

export const SearchModal: React.FC = () => {
  const { isSearchOpen, closeSearch } = useModal();
  const { role } = useAuth();
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSearchOpen) return;
    setIsLoading(true);
    Promise.all([
      recordsService.getRecords().catch(() => []),
      role === 'admin' ? adminService.getDoctorVerifications().catch(() => []) : Promise.resolve([]),
      role === 'patient' ? consentService.getAccessRequests().catch(() => []) : Promise.resolve([]),
      auditService.getAuditLogs().catch(() => []),
    ])
      .then(([recs, docs, reqs, audits]) => {
        setRecords(recs);
        setDoctors(docs);
        setRequests(reqs);
        setAuditEvents(audits);
      })
      .finally(() => setIsLoading(false));
  }, [isSearchOpen, role]);

  const handleSelect = (path: string) => {
    closeSearch();
    navigate(path);
  };

  const filteredRecords = query.trim()
    ? records.filter(
        (r) =>
          r.title?.toLowerCase().includes(query.toLowerCase()) ||
          r.category?.toLowerCase().includes(query.toLowerCase())
      )
    : records.slice(0, 3);

  const filteredDoctors = query.trim()
    ? doctors.filter(
        (d) =>
          d.doctorName?.toLowerCase().includes(query.toLowerCase()) ||
          d.specialization?.toLowerCase().includes(query.toLowerCase())
      )
    : doctors.slice(0, 2);

  const filteredRequests = query.trim()
    ? requests.filter(
        (req) =>
          req.doctorName?.toLowerCase().includes(query.toLowerCase()) ||
          req.recordType?.toLowerCase().includes(query.toLowerCase())
      )
    : requests.slice(0, 2);

  const filteredAudit = query.trim()
    ? auditEvents.filter(
        (a) =>
          a.recordType?.toLowerCase().includes(query.toLowerCase()) ||
          a.actorName?.toLowerCase().includes(query.toLowerCase())
      )
    : auditEvents.slice(0, 2);

  return (
    <Modal isOpen={isSearchOpen} onClose={closeSearch} maxWidth="xl">
      <div className="space-y-5">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-[#47634C]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records, doctors, access requests, or audit logs... (Press Esc to exit)"
            className="medrynx-input pl-11 py-3 text-base shadow-inner bg-[#F8F3EA]/60"
            autoFocus
          />
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="text-center py-8 text-[#66736A] text-xs">
              Searching authorized data...
            </div>
          ) : (
            <>
              {filteredRecords.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#47634C] mb-2">
                    <FileText className="w-3.5 h-3.5" /> Medical Records
                  </div>
                  <div className="space-y-1.5">
                    {filteredRecords.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => handleSelect(role === 'doctor' ? '/doctor/authorized-records' : '/patient/records')}
                        className="p-3 bg-[#F8F3EA]/70 hover:bg-[#E7F0E4] rounded-xl cursor-pointer flex items-center justify-between border border-[#DDE5DA]/70 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#26352A]">{r.title}</p>
                          <p className="text-[11px] text-[#66736A]">{r.category} • {r.date}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#47634C]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredDoctors.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#47634C] mb-2">
                    <UserCheck className="w-3.5 h-3.5" /> Clinicians &amp; Doctors
                  </div>
                  <div className="space-y-1.5">
                    {filteredDoctors.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => handleSelect('/admin/doctors')}
                        className="p-3 bg-[#F8F3EA]/70 hover:bg-[#E7F0E4] rounded-xl cursor-pointer flex items-center justify-between border border-[#DDE5DA]/70 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#26352A]">{d.doctorName}</p>
                          <p className="text-[11px] text-[#66736A]">{d.specialization} • {d.hospital}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#47634C]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredRequests.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#47634C] mb-2">
                    <ShieldAlert className="w-3.5 h-3.5" /> Access Requests
                  </div>
                  <div className="space-y-1.5">
                    {filteredRequests.map((req) => (
                      <div
                        key={req.id}
                        onClick={() => handleSelect('/patient/access-requests')}
                        className="p-3 bg-[#F8F3EA]/70 hover:bg-[#E7F0E4] rounded-xl cursor-pointer flex items-center justify-between border border-[#DDE5DA]/70 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#26352A]">{req.doctorName} • {req.recordType}</p>
                          <p className="text-[11px] text-[#66736A]">Purpose: {req.purpose} • Status: {req.status}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#47634C]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredAudit.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#47634C] mb-2">
                    <History className="w-3.5 h-3.5" /> Audit Events
                  </div>
                  <div className="space-y-1.5">
                    {filteredAudit.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => handleSelect(role === 'admin' ? '/admin/audit' : '/patient/audit')}
                        className="p-3 bg-[#F8F3EA]/70 hover:bg-[#E7F0E4] rounded-xl cursor-pointer flex items-center justify-between border border-[#DDE5DA]/70 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#26352A]">{a.actorName} accessed {a.recordType}</p>
                          <p className="text-[11px] text-[#66736A]">{a.timestamp} • {a.accessType}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#47634C]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredRecords.length === 0 && filteredDoctors.length === 0 && filteredRequests.length === 0 && filteredAudit.length === 0 && (
                <div className="text-center py-8 text-[#66736A] text-xs">
                  No matching records, doctors, or security events found.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
