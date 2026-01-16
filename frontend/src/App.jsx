import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NonCOC from "./pages/NonCOC";
import Search_Inv from "./pages/Search_Inv";
import RequestForPart from "./pages/Requestforpart";
import permissions from "./utils/permissions";
import { loginUser, fetchUserPermissions, logoutUser } from "./utils/api";
import AdminLogs from "./pages/AdminLogs";
import AllLocations from "./components/AllLocations";
import NonCocUI from "./pages/NonCOCU";
import MaterialIssueForm from "./pages/Noncoc_UMIF";
import Requests from "./pages/NonCOCrequests";
import MyRequests from "./pages/MIFRequests";
import MRFRequests from "./pages/MRFRequests";
import MifApproval from "./pages/MifApproval";
import MrfApproval from "./pages/MrfApproval";
import ReturnFormPage from "./pages/ReturnFormPage";
import ReturnApprovals from "./pages/ReturnApprovals";
import ComponentManagement from "./pages/ComponentManagement";
import NotificationBell from "./components/Notification";
import Locations from "./pages/Locations";
import CreateLocation from "./pages/CreateLocation";
import io from "socket.io-client";
import UserReturnRequests from './pages/UserReturnRequests';
import MrfSearchPage from './pages/MrfSearchPage';
import MrfReviewPage from './pages/MrfReviewPage';
import PurchaseHeadMrfSearchPage from './pages/PurchaseHeadMrfSearchPage';
import VendorList from './pages/VendorList';
import VendorCreation from './pages/VendorCreation';
import MaterialInPage from './pages/MaterialInPage';
import PurchaseOrderComponents from './pages/PurchaseOrderComponents';
import PoRaisedComponent from './components/PoRaisedComponent';
import QualityInspection from './pages/QualityInspection';
import MRRPage from './pages/MrrPage';
import QualityInspectionComponentsPage from './pages/QualityInspectionComponentsPage';
import BackorderPage from './pages/BackOrderPage'; // New import
import ReturnPage from './pages/ReturnPage'; // New import
import Documents from './components/Documents';
import PastPOReview from './pages/PastPoInv';
import MrfRejected from './components/MrfRejected'; // New import
import BackorderedReturnedPOs from './pages/BackorderedReturnedPOs'; // New import
import RaisePORequest from './pages/RaiseDirectPORequest'; // New import
import ReviewPORequest from './pages/ReviewPORequest'; // New import
import SafetyStock from './pages/SafetyStock'; // New import
import CeoDirectPoApproval from './pages/CeoDirectPoApproval'; // New import
import PurchaseHeadDirectPoRaise from './pages/PurchaseHeadDirectPoRaise'; // New import
import BackorderMaterialInPage from './pages/BackorderMaterialInPage'; // New import
import ShortageCalculator from './pages/ShortageCalculator'; // New import
import QualityCheckpoints from "./pages/QualityCheckpoints";
import QCdoneComponents from "./pages/QCdoneComponents";
import UserCreation from "./pages/UserCreation";
import ViewUsers from "./pages/ViewUsers";
import EditUser from "./pages/EditUser";
import PastPurchaseDetails from "./pages/PastPurchaseDetails";
import DirectPoRequestsHistory from "./pages/DirectPoRequestsHistory";
import DirectPoReviewPage from "./pages/DirectPoReviewPage";

const Layout = ({ children, toggleSidebar, sidebarOpen, userId, role }) => {
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  return (
    <div className="relative font-poppins h-screen flex flex-col">
      {!isLoginPage && (
        <Navbar
          toggleSidebar={toggleSidebar}
          extraContent={
            role?.includes("_head") && <NotificationBell userId={userId} />
          }
        />
      )}
      {!isLoginPage && <Sidebar isOpen={sidebarOpen} onClose={toggleSidebar} />}
      <div className="flex-grow">{children}</div>
    </div>
  );
};

const PrivateRoute = ({ element, requiredRole }) => {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const storedRole = localStorage.getItem("role");
        setUserRole(storedRole);
      } catch (error) {
        console.error("Error fetching user role", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  if (loading) return <div>Loading...</div>;

  return userRole && permissions[userRole]?.includes(requiredRole) ? (
    element
  ) : (
    <Navigate to="/" />
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [permissionsState, setPermissionsState] = useState({ edit: {}, read: {} });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    const storedPermissions = JSON.parse(localStorage.getItem("permissions")) || {};
    const email = localStorage.getItem("email");
    const storedUserId = localStorage.getItem("user_id");

    console.log("App.js - Initial Email from localStorage:", email);

    if (token) {
      setIsAuthenticated(true);
      setRole(storedRole);
      setPermissionsState(storedPermissions);
      setUserId(storedUserId);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      const newSocket = io("https://erp1-iwt1.onrender.com", {
        withCredentials: true,
        auth: {
          token: localStorage.getItem("token"),
        },
        query: { userId },
      });
      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [userId]);

  const handleLogin = async (email, password) => {
    console.log("handleLogin - Attempting login with email:", email);
    const response = await loginUser(email, password);
    console.log("handleLogin - API Response:", response);
    if (response.success !== false) {
      localStorage.setItem("token", response.token);
      localStorage.setItem("role", response.role);
      localStorage.setItem("email", email);
      localStorage.setItem("permissions", JSON.stringify(response.permissions || {}));
      localStorage.setItem("user_id", response.user_id);

      console.log("handleLogin - Email stored in localStorage:", email);
      setIsAuthenticated(true);
      setRole(response.role);
      setPermissionsState(response.permissions || {});
      setUserId(response.user_id);
    } else {
      alert(response.message || "Login failed");
    }
  };

  const handleLogout = () => {
    logoutUser();
    setIsAuthenticated(false);
    setRole(null);
    setPermissionsState({ edit: {}, read: {} });
    setUserId(null);
    if (socket) {
      socket.disconnect();
    }
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <Router>
      <Layout toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} userId={userId} role={role}>
        <Routes>
          <Route path="/" element={<Login onLogin={handleLogin} />} />
          <Route path="/home" element={<Home />} />
          <Route path="/RequestForPartno" element={<RequestForPart />} />
          <Route path="/non-coc" element={<NonCOC />} />
          <Route path="/searchinventory" element={<Search_Inv />} />
          <Route path="/admin-logs" element={<AdminLogs />} />
          <Route path="/non-cocu" element={<NonCocUI />} />
          <Route path="/noncocbasket" element={<MaterialIssueForm />} />
          <Route path="/noncoc-request" element={<Requests />} />
          <Route path="/my-requests" element={<MyRequests />} />
          <Route path="/mrf-requests" element={<MRFRequests />} />
          <Route path="/return-form" element={<ReturnFormPage />} />
          <Route path="/return-approval" element={<ReturnApprovals />} />
          <Route path="/mif-approval" element={<MifApproval />} />
          <Route path="/mif-approval/:umi" element={<MifApproval />} />
          <Route path="/mrf-approval" element={<MrfApproval />} />
          <Route path="/mrf-approval/:mrf_no" element={<MrfApproval />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/create-location" element={<CreateLocation />} />
          <Route path="/all-locations" element={<AllLocations />} />
          <Route path="/my-return-requests" element={<UserReturnRequests />} />
           <Route path="/quality-checks/create" element={<QualityCheckpoints />} />
            <Route path="/quality-checks" element={<div>Quality Checks List</div>} />  
            <Route path="/quality-inspection-done" element={<QCdoneComponents/>} />
          <Route path="/create-user" element={<UserCreation />} />
          <Route path="/view-users"  element={<ViewUsers />} />
          <Route path="/users/edit/:id" element={<EditUser />} />
          <Route path="/shortage-calculator" element={<ShortageCalculator/>} />
          <Route path="/direct-po-review-page" element={<DirectPoReviewPage/>} />
          <Route
            path="/mrf/search"
            element={
              <PrivateRoute
                element={<MrfSearchPage />}
                requiredRole="mrf_search_access"
              />
            }
          />
          <Route
            path="/mrf/review"
            element={
              <PrivateRoute
                element={<MrfReviewPage />}
                requiredRole="mrf_review_access"
              />
            }
          />
          <Route
            path="/mrf/purchase-head-search"
            element={
              <PrivateRoute
                element={<PurchaseHeadMrfSearchPage />}
                requiredRole="purchase_head_mrf_search_access"
              />
            }
          />
          <Route 
            path="/vendors" 
            element={<VendorList />} 
            requiredRole="vendors"
          />
          <Route 
            path="/vendor/create"
            element={<VendorCreation />} 
            requiredRole="vendors_creation"
          />
          <Route 
            path="/purchase-order-components" 
            element={<PurchaseOrderComponents />}
          />
          <Route path="/po-raised-components" element={<PoRaisedComponent />} />
          <Route
            path="/material-in"
            element={
              <PrivateRoute
                element={<MaterialInPage />}
                requiredRole="material_in_access"
              />
            }
          />
          <Route
            path="/quality-inspection"
            element={
              <PrivateRoute
                element={<QualityInspection />}
                requiredRole="quality_inspection"
              />
            }
          />
          <Route
            path="/material-receipt-report"
            element={<MRRPage />}
          />
          <Route path="/quality-inspection-components" element={<QualityInspectionComponentsPage />} />
          <Route path="/component-management" element={<ComponentManagement />} />
          <Route path="/past-purchase-details" element={<PastPurchaseDetails />} />
          <Route path="/direct-po-requests-history" element={<DirectPoRequestsHistory />} />
          <Route
            path="/backorder"
            element={
              <PrivateRoute
                element={<BackorderPage />}
                requiredRole="material_in_access"
              />
            }
          />
          <Route
            path="/return"
            element={
              <PrivateRoute
                element={<ReturnPage />}
                requiredRole="material_in_access"
              />
            }
          />
          <Route
            path="/documents"
           
                element={<Documents />}
               
          />
          <Route 
            path="/past-po-review" 
            element={<PastPOReview />}
          />
         <Route
            path="/mrf/rejected"
            element={<MrfRejected role={role} />}
          />
            <Route
            path="/backordered-returned-pos"
            element={
              <PrivateRoute
                element={<BackorderedReturnedPOs />}
                requiredRole="purchase_head_access"
              />
            }
          />
          <Route
            path="/raise-po-request"
            element={
              <PrivateRoute
                element={<RaisePORequest />}
                requiredRole="raise_po_request_access"
              />
            }
          />
          <Route
            path="/review-po-request"
            element={
              <PrivateRoute
                element={<ReviewPORequest />}
                requiredRole="review_po_request_access"
              />
            }
          />
          <Route
            path="/safety-stock"
            element={
              <PrivateRoute
                element={<SafetyStock />}
                requiredRole="safety_stock_access"
              />
            }
          />
          <Route
            path="/direct-approval-po"
            element={
              <PrivateRoute
                element={<CeoDirectPoApproval />}
                requiredRole="ceo_access"
              />
            }
          />
          <Route
            path="/direct-po"
            element={
              <PrivateRoute
                element={<PurchaseHeadDirectPoRaise />}
                requiredRole="purchase_access"
              />
            }
          />
             <Route
            path="/backorder-material-in-page"
            element={
              <PrivateRoute
                element={<BackorderMaterialInPage />}
                requiredRole="inv_access"
              />
            }
          />
          
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;