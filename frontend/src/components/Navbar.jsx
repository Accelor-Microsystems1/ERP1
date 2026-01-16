import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaSearch, FaBell, FaHome, FaSignOutAlt } from "react-icons/fa";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logo from "../assets/accelor-nobg.png";
import NotificationBell from "../components/Notification";

const Navbar = ({ toggleSidebar, socket, userId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isNonCocPage = location.pathname === "/non-coc";
  const userEmail = localStorage.getItem("email") || "User_id";
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // const handleConfirmNotification = (umiNo) => {
  //   // Simulate approval or status update (to be replaced with actual API call)
  //   window.dispatchEvent(new CustomEvent('statusConfirm', { detail: { umiNo, status: 'Issued' } }));
  // };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("user_id");
    localStorage.removeItem("role");
    localStorage.removeItem("permissions");
    navigate("/");
  };

  return (
    <div
      className="flex items-center justify-between bg-[#F9FAFB] text-[#3d3d82] px-4 py-2 shadow-md fixed top-0 left-0 w-screen z-50 transition-all duration-300 h-16"
    >
      <button
        onClick={toggleSidebar}
        className="text-[#32328e] text-2xl cursor-pointer hover:text-[#3d3d82] transition-transform transform hover:scale-110"
      >
        <FaBars />
      </button>

      <div className="flex items-center gap-x-4 flex-nowrap justify-center flex-1">
        <span className="flex items-center justify-start">
          <img
            src={logo}
            alt="Accelor Microsystems Logo"
            className="h-10 w-auto object-contain transition-opacity duration-300 hover:opacity-90"
          />
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="text-[#32328e] text-2xl cursor-pointer hover:text-[#3d3d82] transition-transform transform hover:scale-110"
          onClick={() => navigate("/home")}
          title="Home"
        >
          <FaHome />
        </button>
        <button
          className="text-[#32328e] text-2xl cursor-pointer hover:text-[#3d3d82] transition-transform transform hover:scale-110"
          onClick={() => navigate("/searchinventory")}
          title="Search Inventory"
        >
          <FaSearch />
        </button>
        <div className="relative">
        <NotificationBell userId={userId} socket={socket} />
        </div>
        <div className="flex items-center bg-[#E5E7EB]/50 px-3 py-1 rounded-full shadow-md hover:bg-[#D1D5DB]/50 transition-all duration-300">
          <span className="font-semibold text-sm text-[#32328e] whitespace-nowrap">
            {userEmail}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-x-2 px-3 py-1 bg-gradient-to-r from-gray-600 to-gray-800 text-white rounded-lg font-semibold hover:from-red-600 hover:to-red-800 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
        >
          <span>Logout</span>
          <FaSignOutAlt />
        </button>
      </div>
      <ToastContainer position="top-right" autoClose={10000} />
    </div>
  );
};

export default Navbar;