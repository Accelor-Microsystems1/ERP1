import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBars, FaSearch, FaHome, FaBell } from "react-icons/fa";
import { PlusOutlined } from "@ant-design/icons";
import { Button } from "antd";
import Sidebar from "./Sidebar"; // Import the existing Sidebar component

const NonCOCNavbar = ({ searchQuery, setSearchQuery }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    console.log("Sidebar toggled:", !sidebarOpen); // For debugging
  };

  return (
    <div className="flex items-center justify-between bg-gray-200 px-4 md:px-6 py-2 shadow-md h-12 w-full fixed top-0 left-0 z-50">
      {/* Sidebar Toggle */}
      <button onClick={toggleSidebar} className="text-gray-800 text-xl cursor-pointer hover:text-gray-600">
        <FaBars />
      </button>

      {/* Search Bar */}
      <div className="flex items-center bg-gray-800 px-4 py-2 rounded-full w-[600px] h-8 shadow-lg">
        <input
          type="text"
          placeholder="Search by Description, MPN, or S.No"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent outline-none text-white placeholder-gray-300 px-2 w-full"
        />
        <FaSearch className="text-white cursor-pointer hover:text-gray-300 transition-all" />
      </div>

      {/* Home, Notifications, NEW Button, Profile */}
      <div className="flex items-center space-x-4">
        <button
          className="text-gray-800 text-xl cursor-pointer hover:text-gray-600 transition-all"
          onClick={() => navigate("/home")}
        >
          <FaHome />
        </button>

        <button
          className="text-gray-800 text-xl cursor-pointer hover:text-gray-600 transition-all"
          onClick={() => alert("Notifications clicked!")}
        >
          <FaBell />
        </button>

        <button
          onClick={() => alert("Add New clicked!")} // Placeholder for handleAddNew
          className="bg-blue-500 text-white px-4 py-1 rounded-full hover:bg-blue-700 transition-all flex items-center"
        >
          <PlusOutlined className="mr-2" /> NEW
        </button>

        <div className="flex items-center bg-yellow-400 px-3 py-1 rounded-full">
          <span className="font-medium text-sm text-gray-800">User_id</span>
        </div>
      </div>

      {/* Render Sidebar */}
      <Sidebar isOpen={sidebarOpen} />
    </div>
  );
};

export default NonCOCNavbar;