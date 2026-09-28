import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Eagerly loaded — needed immediately for auth UI
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';

// Lazy loaded — all page/layout components loaded only after login
const Layout = lazy(() => import('./components/layout/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const LeadManagement = lazy(() => import('./components/leads/LeadManagement'));
const QuotationPage = lazy(() => import('./pages/QuotationsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const LoyaltyPage = lazy(() => import('./pages/LoyaltyPage'));
const FranchisePage = lazy(() => import('./pages/FranchisePage'));
const StaffManagementPage = lazy(() => import('./pages/StaffManagementPage'));
const StockManagementPage = lazy(() => import('./pages/StockManagementPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const LeadDetailPage = lazy(() => import('./components/leads/LeadDetailPage'));
const EnquiryProfileView = lazy(() => import('./pages/EnquiryProfileView'));
const CustomerProfileView = lazy(() => import('./components/CRM/CustomerProfileView'));
const TicketDetails = lazy(() => import('./pages/TicketDetails'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'));
const AssignLeads = lazy(() => import('./components/leads/AssignLeads'));
const NotesSection = lazy(() => import('./components/leads/NotesSection'));
const FollowUpSection = lazy(() => import('./components/leads/FollowUpSection'));
const LeaveRequestCard = lazy(() => import('./pages/LeaveRequestCard'));
const HierarchyAssignment = lazy(() => import('./pages/HierarchyAssignment'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage'));
const TestPage = lazy(() => import('./pages/TestPage'));
const RepeatNotificationDemo = lazy(() => import('./pages/RepeatNotificationDemo'));
const AutoNotificationDemo = lazy(() => import('./pages/AutoNotificationDemo'));

// Hospital HIS Pages (lazy)
const ReceptionPage = lazy(() => import('./pages/ReceptionPage'));
const HospitalManagementPage = lazy(() => import('./pages/HospitalManagementPage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const PatientRegistrationPage = lazy(() => import('./pages/PatientRegistrationPage'));
const OPDManagementPage = lazy(() => import('./pages/OPDManagementPage'));
const IPDWardPage = lazy(() => import('./pages/IPDWardPage'));
const EMRPage = lazy(() => import('./pages/EMRPage'));
const PharmacyPage = lazy(() => import('./pages/PharmacyPage'));
const LaboratoryPage = lazy(() => import('./pages/LaboratoryPage'));
const RadiologyPage = lazy(() => import('./pages/RadiologyPage'));
const BloodBankPage = lazy(() => import('./pages/BloodBankPage'));
const OTManagementPage = lazy(() => import('./pages/OTManagementPage'));
const NursingStationPage = lazy(() => import('./pages/NursingStationPage'));
const TeleconsultationPage = lazy(() => import('./pages/TeleconsultationPage'));
const BillingRevenuePage = lazy(() => import('./pages/BillingRevenuePage'));
const PatientPortalPage = lazy(() => import('./pages/PatientPortalPage'));
const DoctorManagementPage = lazy(() => import('./pages/DoctorManagementPage'));
const DepartmentManagementPage = lazy(() => import('./pages/DepartmentManagementPage'));
const InsuranceTpaPage = lazy(() => import('./pages/InsuranceTpaPage'));
const CertificatesPage = lazy(() => import('./pages/CertificatesPage'));

// Minimal page-level loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    </div>
  );
}

// Authentication hook
function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('access_token'); // Check if token exists in localStorage
  });
  const [showRegister, setShowRegister] = useState(false);


  const login = () => setIsAuthenticated(true);
  const logout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
  }

  // Register also logs user in
  const register = () => {
    setIsAuthenticated(true);
    setShowRegister(false);
  };

  return {
    isAuthenticated,
    login,
    logout,
    showRegister,
    setShowRegister,
    register,
  };
}

// ProtectedRoute: Only shows children if logged in, otherwise redirects to login
function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// AuthGate: Handles login/register switching
function AuthGate({ isAuthenticated, login, showRegister, setShowRegister, register }) {
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return showRegister ? (
    <RegisterForm
      onRegister={register}
      onShowLogin={() => setShowRegister(false)}
    />
  ) : (
    <LoginForm
      onLogin={login}
      onShowRegister={() => setShowRegister(true)}
    />
  );
}

function App() {
  const auth = useAuth();

  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
      <Routes>
        {/* Auth routes */}
        <Route
          path="/login"
          element={
            <AuthGate
              isAuthenticated={auth.isAuthenticated}
              login={auth.login}
              showRegister={auth.showRegister}
              setShowRegister={auth.setShowRegister}
              register={auth.register}
            />
          }
        />
        {/* Default route: redirect to login if not authenticated */}
        <Route
          path="/"
          element={
            auth.isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        {/* Main app, only visible if logged in */}
        <Route
          element={
            <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
              <Suspense fallback={<PageLoader />}>
                <Layout logout={auth.logout} />
              </Suspense>
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/super-admin" element={<SuperAdminPage />} />
          {/* Hospital HIS Routes */}
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/reception" element={<ReceptionPage />} />
          <Route path="/users/hospitals" element={<HospitalManagementPage />} />
          <Route path="/patients/registration" element={<PatientRegistrationPage />} />
          <Route path="/patients/portal" element={<PatientPortalPage />} />
          <Route path="/opd" element={<OPDManagementPage />} />
          <Route path="/ipd" element={<IPDWardPage />} />
          <Route path="/emr" element={<EMRPage />} />
          <Route path="/pharmacy" element={<PharmacyPage />} />
          <Route path="/laboratory" element={<LaboratoryPage />} />
          <Route path="/radiology" element={<RadiologyPage />} />
          <Route path="/blood-bank" element={<BloodBankPage />} />
          <Route path="/ot" element={<OTManagementPage />} />
          <Route path="/nursing" element={<NursingStationPage />} />
          <Route path="/teleconsult" element={<TeleconsultationPage />} />
          <Route path="/billing" element={<BillingRevenuePage />} />
          <Route path="/doctors" element={<DoctorManagementPage />} />
          <Route path="/departments" element={<DepartmentManagementPage />} />
          <Route path="/insurance" element={<InsuranceTpaPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          {/* Legacy/kept routes */}
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/LeadManagement" element={<LeadManagement />} />
          <Route path="/leads/quotations" element={<QuotationPage />} />
          <Route path="/leads/payments" element={<PaymentsPage />} />
          <Route path="/users/list" element={<UsersPage />} />
          <Route path="/users/roles" element={<RolesPage />} />
          {/* <Route path="/users/hierarchy" element={<UserHierarchyPage/>}/> */}
          {/* Placeholder Routes */}
          <Route path="/franchise/*" element={<FranchisePage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/hr/*" element={<StaffManagementPage />} />
          <Route path="/inventory/*" element={<StockManagementPage />} />
          <Route path="/tasks/*" element={<TasksPage />} />
          <Route path="/tickets/*" element={<TicketsPage />} />
          <Route path="/documents/*" element={<DocumentsPage />} />
          <Route path="/enquiries/:enquiry_id" element={<EnquiryProfileView />} />
          <Route path="/customers/:customer_id" element={<CustomerProfileView />} />
          <Route path="/tickets/:ticket_id" element={<TicketDetails />} />
          <Route path="/employee/:id" element={<EmployeeDetail />} />
          <Route path="/assigned-leads" element={<AssignLeads />} />
          <Route path="/hierarchy-assignment" element={<HierarchyAssignment />} />
          <Route path="/notes" element={<NotesSection />} />
          <Route path="/follow-up" element={<FollowUpSection />} />
          <Route path="/leave-requests" element={<LeaveRequestCard />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/my-leave-requests" element={<LeaveRequestsPage />} />
          <Route path="/test-followup" element={<TestPage />} />
          <Route path="/demo-repeat" element={<RepeatNotificationDemo />} />
          <Route path="/demo-auto" element={<AutoNotificationDemo />} />

          {/* <Route
            path="/marketing/*"
            element={
              <MarketingToolsModule/>
            }
          /> */}
          <Route path="/reports/*" element={<ReportsPage />} />
          {/* <Route
            path="/admin/*"
            element={
              <Admin/>
            }
          /> */}
          <Route path="/leads/:leadId" element={<LeadDetailPage />} />

        </Route>
        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="p-4">
              <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
