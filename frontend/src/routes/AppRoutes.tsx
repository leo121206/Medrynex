import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PatientLayout } from '../components/layout/PatientLayout';
import { DoctorLayout } from '../components/layout/DoctorLayout';
import { AdminLayout } from '../components/layout/AdminLayout';
import { PrivateRoute, RequireRole, RedirectIfAuthenticated } from '../components/auth/AuthGuards';

// Public & Auth Pages
import { LandingPage } from '../pages/public/LandingPage';
import { FeaturesPage } from '../pages/public/FeaturesPage';
import { SecurityPage } from '../pages/public/SecurityPage';
import { AboutPage } from '../pages/public/AboutPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';

// Patient Portal Pages
import { PatientDashboard } from '../pages/patient/PatientDashboard';
import { MedicalRecordsPage } from '../pages/patient/MedicalRecordsPage';
import { AccessRequestsPage } from '../pages/patient/AccessRequestsPage';
import { ConsentManagementPage } from '../pages/patient/ConsentManagementPage';
import { EmergencyAccessPage } from '../pages/patient/EmergencyAccessPage';
import { AuditHistoryPage } from '../pages/patient/AuditHistoryPage';
import { ReconciliationPage } from '../pages/patient/ReconciliationPage';
import { DisputesPage } from '../pages/patient/DisputesPage';
import { NotificationsPage } from '../pages/patient/NotificationsPage';
import { PatientProfilePage } from '../pages/patient/PatientProfilePage';
import { PatientSettingsPage } from '../pages/patient/PatientSettingsPage';

// Doctor Portal Pages
import { DoctorDashboard } from '../pages/doctor/DoctorDashboard';
import { PatientsPage } from '../pages/doctor/PatientsPage';
import { DoctorRequestsPage } from '../pages/doctor/DoctorRequestsPage';
import { AuthorizedRecordsPage } from '../pages/doctor/AuthorizedRecordsPage';
import { DoctorEmergencyPage } from '../pages/doctor/DoctorEmergencyPage';
import { DoctorProfilePage } from '../pages/doctor/DoctorProfilePage';
import { DoctorSettingsPage } from '../pages/doctor/DoctorSettingsPage';

// Admin Portal Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminPatientsPage } from '../pages/admin/AdminPatientsPage';
import { AdminDoctorsPage } from '../pages/admin/AdminDoctorsPage';
import { AdminAccessLogsPage } from '../pages/admin/AdminAccessLogsPage';
import { AdminEmergencyPage } from '../pages/admin/AdminEmergencyPage';
import { AdminAnomalyPage } from '../pages/admin/AdminAnomalyPage';
import { AdminAuditPage } from '../pages/admin/AdminAuditPage';
import { AdminBlockchainPage } from '../pages/admin/AdminBlockchainPage';
import { AdminStoragePage } from '../pages/admin/AdminStoragePage';
import { AdminProfilePage } from '../pages/admin/AdminProfilePage';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* ── Public Pages (no auth required) ── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/how-it-works" element={<FeaturesPage />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/about" element={<AboutPage />} />

      {/* ── Auth Pages (redirect to dashboard if already authenticated) ── */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthenticated>
            <RegisterPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* ── Patient Portal (requires authentication + PATIENT role) ── */}
      <Route
        path="/patient"
        element={
          <RequireRole role="patient">
            <PatientLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="records" element={<MedicalRecordsPage />} />
        <Route path="access-requests" element={<AccessRequestsPage />} />
        <Route path="consent" element={<ConsentManagementPage />} />
        <Route path="emergency" element={<EmergencyAccessPage />} />
        <Route path="audit" element={<AuditHistoryPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="disputes" element={<DisputesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<PatientProfilePage />} />
        <Route path="settings" element={<PatientSettingsPage />} />
      </Route>

      {/* ── Doctor Portal (requires authentication + DOCTOR role) ── */}
      <Route
        path="/doctor"
        element={
          <RequireRole role="doctor">
            <DoctorLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="/doctor/dashboard" replace />} />
        <Route path="dashboard" element={<DoctorDashboard />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="access-requests" element={<DoctorRequestsPage />} />
        <Route path="authorized-records" element={<AuthorizedRecordsPage />} />
        <Route path="records" element={<Navigate to="/doctor/authorized-records" replace />} />
        <Route path="emergency" element={<DoctorEmergencyPage />} />
        <Route path="profile" element={<DoctorProfilePage />} />
        <Route path="settings" element={<DoctorSettingsPage />} />
      </Route>

      {/* ── Admin Portal (requires authentication + ADMIN role) ── */}
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="patients" element={<AdminPatientsPage />} />
        <Route path="doctors" element={<AdminDoctorsPage />} />
        <Route path="access-logs" element={<AdminAccessLogsPage />} />
        <Route path="emergency" element={<AdminEmergencyPage />} />
        <Route path="anomalies" element={<AdminAnomalyPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="blockchain" element={<AdminBlockchainPage />} />
        <Route path="storage" element={<AdminStoragePage />} />
        <Route path="profile" element={<AdminProfilePage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      {/* ── Fallback ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
