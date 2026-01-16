import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCogs, FaCheckCircle, FaFileAlt, FaFolder, FaSignOutAlt, FaBox } from "react-icons/fa";
import { MdInventory, MdAdminPanelSettings } from "react-icons/md";
import { RiFileList3Line, RiCheckboxMultipleLine } from "react-icons/ri";
import { IoMdSettings } from "react-icons/io";
import { AiOutlineShoppingCart } from "react-icons/ai";
import { GiFactory } from "react-icons/gi";
import { fetchUserPermissions } from "../utils/api";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import applogo from "../assets/app-logo.jpg";

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [openDropdowns, setOpenDropdowns] = useState([]);
  const [permissions, setPermissions] = useState({ access: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getPermissions = async () => {
      const email = localStorage.getItem("email");
      if (!email) return;

      const data = await fetchUserPermissions(email);
      console.log("🔍 Permissions.access:", data.permissions.access);
      setPermissions(data.permissions);
      setLoading(false);
    };

    getPermissions();
  }, []);

  if (loading) return <div className="text-white text-center p-4">Loading Sidebar...</div>;

  const toggleDropdown = (menu) => {
    setOpenDropdowns((prev) =>
      prev.includes(menu) ? prev.filter((item) => item !== menu) : [...prev, menu]
    );
  };

  const handleModuleClick = () => {
    if (onClose) onClose();
  };

  // Role checking logic aligned with backend
  const role = localStorage.getItem("role");
  const isEmployee = role?.endsWith("_employee");
  const isHeadOrAdminOrCEO = role?.endsWith("_head") || role === "admin" || role === "ceo";

  return (
    <div
      className="fixed left-0 top-12 h-[calc(94vh-1rem)] w-64 bg-gradient-to-b from-[#2a2a72] to-[#4b0082] text-white transition-transform duration-300 ease-in-out z-50 rounded-tr-2xl rounded-br-2xl shadow-2xl overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-700"
      style={{ transform: isOpen ? "translateX(0)" : "translateX(-100%)" }}
    >
      {/* App Logo and Name */}
      <div className="p-4 border-b border-gray-700 flex items-center space-x-3">
        <img src={applogo} alt="App Logo" className="w-10 h-10 rounded-full" />
        <h1 className="text-xl font-bold text-white">ERP System</h1>
      </div>

      {/* Navigation Modules */}
      <ul className="mt-4 space-y-2 px-3">
{permissions.access[7] && (
  <>
    <li className="cursor-pointer hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg">
      <Link
        to="/shortage-calculator"
        className="flex items-center space-x-3 text-white w-full hover:text-gray-200"
        onClick={handleModuleClick}
      >
        <MdAdminPanelSettings className="text-lg" />
        <span className="font-semibold">Shortage Calculator</span>
      </Link>
    </li>
    <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                                   <Link to="/direct-approval-po" className="text-white w-full" onClick={handleModuleClick}>
                                     Direct Purchase Approval
                                   </Link>
                                 </li>
    <li>
      <div
        className="cursor-pointer flex items-center justify-between hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg"
        onClick={() => toggleDropdown("admin")}
      >
        <div className="flex items-center space-x-3">
          <MdAdminPanelSettings className="text-lg" />
          <span className="font-semibold">Admin</span>
        </div>
        {openDropdowns.includes("admin") ? <FiChevronDown /> : <FiChevronRight />}
      </div>
      {openDropdowns.includes("admin") && (
        <ul className="ml-6 mt-2 space-y-1">
          {/* Dashboard */}
          {/* <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
            <Link to="/admin-dashboard" className="text-white w-full" onClick={handleModuleClick}>
              Dashboard
            </Link>
          </li> */}
          <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
            <Link to="/admin-logs" className="text-white w-full" onClick={handleModuleClick}>
              Activity Log Management
            </Link>
          </li>
          {/* User Management Dropdown */}
          <li>
            <div
              className="cursor-pointer flex items-center justify-between hover:bg-gray-600 p-2 rounded-md transition-all duration-300"
              onClick={() => toggleDropdown("userManagement")}
            >
              <span className="font-semibold">User Management</span>
              {openDropdowns.includes("userManagement") ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            {openDropdowns.includes("userManagement") && (
              <ul className="ml-6 mt-2 space-y-1">
                <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                  <Link to="/create-user" className="text-white w-full" onClick={handleModuleClick}>
                    Create User
                  </Link>
                </li>
                <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                  <Link to="/view-users" className="text-white w-full" onClick={handleModuleClick}>
                    View Users
                  </Link>
                </li>
              </ul>
            )}
          </li>
          {/* Role Management Dropdown */}
          <li>
            <div
              className="cursor-pointer flex items-center justify-between hover:bg-gray-600 p-2 rounded-md transition-all duration-300"
              onClick={() => toggleDropdown("roleManagement")}
            >
              <span className="font-semibold">Role Management</span>
              {openDropdowns.includes("roleManagement") ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            {openDropdowns.includes("roleManagement") && (
              <ul className="ml-6 mt-2 space-y-1">
                <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                  <Link to="/create-role" className="text-white w-full" onClick={handleModuleClick}>
                    Create Role
                  </Link>
                </li>
                <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                  <Link to="/edit-role-permissions" className="text-white w-full" onClick={handleModuleClick}>
                    Edit Role Permissions
                  </Link>
                </li>
              </ul>
            )}
          </li>
          {/* Activity Log Management */}
          
        </ul>
      )}
    </li>
  </>
)}


        {permissions.access[6] && (
          <li className="cursor-pointer hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg">
            <Link
              to="/non-cocu"
              className="flex items-center space-x-3 text-white w-full hover:text-gray-200"
              onClick={handleModuleClick}
            >
              <FaBox className="text-lg" />
              <span className="font-semibold">Search Inventory </span>
            </Link>
          </li>
        )}

        {/* Purchase Dropdown */}
        {permissions.access[3] && (
          <li>
            <div
              className="cursor-pointer flex items-center justify-between hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg"
              onClick={() => toggleDropdown("purchase")}
            >
              <div className="flex items-center space-x-3">
                <AiOutlineShoppingCart className="text-lg" />
                <span className="font-semibold">Purchase</span>
              </div>
              {openDropdowns.includes("purchase") ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            {openDropdowns.includes("purchase") && (
              <ul className="ml-6 mt-2 space-y-1">
                                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"> 
                <Link to="/mrf-approval" className="text-white w-full" onClick={handleModuleClick}> Pending Material Request Form </Link></li>

                {/* <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">Request For Quotation</li> */}
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"> 
                <Link to="/mrf/purchase-head-search" className="text-white w-full" onClick={handleModuleClick}> Approved Requests </Link></li>
                  <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"> 
                <Link to="/raise-po-request" className="text-white w-full" onClick={handleModuleClick}> Direct Raise PO</Link></li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"> 
                <Link to="/mrf/rejected" className="text-white w-full" onClick={handleModuleClick}> Rejected Requests </Link></li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"> 
                <Link to="/po-raised-components" className="text-white w-full" onClick={handleModuleClick}> Raised PO's </Link></li>
                 <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"> 
                <Link to="/backordered-returned-pos" className="text-white w-full" onClick={handleModuleClick}> Backorder and Return Receipts </Link></li>
                  <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"> 
                <Link to="/direct-po" className="text-white w-full" onClick={handleModuleClick}> Draft PO Requests </Link></li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                 <Link to="/vendors" className="text-white w-full" onClick={handleModuleClick}> Vendors </Link></li>
                 <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                 <Link to="/component-management" className="text-white w-full" onClick={handleModuleClick}> Minimum Order Value </Link></li>
                 <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                 <Link to="/past-purchase-details" className="text-white w-full" onClick={handleModuleClick}> Previous Purchase Details </Link></li>
                 
                
                 {/* <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"><Link to="/safety-stock" className="text-white w-full" onClick={handleModuleClick}>
                           Safety Stock </Link></li> */}
              </ul>
            )}
          </li>
        )}

        {/* Inventory Dropdown */}
        {permissions.access[1] && (
          <li>
            <div
              className="cursor-pointer flex items-center justify-between hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg"
              onClick={() => toggleDropdown("inventory")}
            >
              <div className="flex items-center space-x-3">
                <MdInventory className="text-lg" />
                <span className="font-semibold">Inventory</span>
              </div>
              {openDropdowns.includes("inventory") ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            {openDropdowns.includes("inventory") && (
              <ul className="ml-6 mt-2 space-y-1">
                <li>
                  <div
                    className="cursor-pointer flex items-center justify-between hover:bg-gray-600 p-2 rounded-md transition-all duration-300"
                    onClick={() => toggleDropdown("nonCoc")}
                  >
                    <span className="font-semibold">Material Issue Receipts</span>
                    {openDropdowns.includes("nonCoc") ? <FiChevronDown /> : <FiChevronRight />}
                  </div>
                  {openDropdowns.includes("nonCoc") && (
                    <ul className="ml-6 mt-2 space-y-2">
                      <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300 flex items-center space-x-2">
                        <Link to="/noncoc-request" className="text-white w-full" onClick={handleModuleClick}>
                          Material Issue Requests
                        </Link>
                      </li>
                      
                    </ul>
                  )}
                </li>
               <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300 flex items-center space-x-2">
                        <Link to="/non-coc" className="text-white w-full" onClick={handleModuleClick}>
                          Stock
                        </Link>
                      </li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                  <Link to="/locations" className="text-white w-full" onClick={handleModuleClick}>
                          Locations
                        </Link> </li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                   <Link to="/purchase-order-components" className="text-white w-full" onClick={handleModuleClick}>
                           Reciepts </Link> </li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"><Link to="/material-in" className="text-white w-full" onClick={handleModuleClick}>
                           Material In </Link></li>
                           
                 <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"><Link to="/backorder-material-in-page" className="text-white w-full" onClick={handleModuleClick}>
                           Backorder Material In </Link></li>   
                           <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300"><Link to="/safety-stock" className="text-white w-full" onClick={handleModuleClick}>
                           Safety Stock </Link></li>       
                           
              </ul>
            )}
          </li>
        )}

       {/* Quality Assurance Dropdown */}
        {permissions.access[2] && (
          <li>
            <div
              className="cursor-pointer flex items-center justify-between hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg"
              onClick={() => toggleDropdown("quality")}
            >
              <div className="flex items-center space-x-3">
                <RiCheckboxMultipleLine className="text-lg" />
                <span className="font-semibold">Quality Assurance</span>
              </div>
              {openDropdowns.includes("quality") ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            {openDropdowns.includes("quality") && (
              <ul className="ml-6 mt-2 space-y-1">
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                  <Link to="/quality-inspection" className="text-white w-full" onClick={handleModuleClick}>
                           Reciepts </Link>
                </li>
                {/* <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                  <Link to="/material-receipt-report" className="text-white w-full" onClick={handleModuleClick}>
                          Quality Control </Link></li> */}
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                  <Link to="/quality-inspection-done"className="text-white w-full" onClick={handleModuleClick}>
                          QC Done Components </Link></li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">
                  <Link to="/quality-checks/create"className="text-white w-full" onClick={handleModuleClick}>
                          Quality Check Points </Link></li>
              </ul>
            )}
          </li>
        )}


        {/* R&D Dropdown */}
        {permissions.access[4] && (
          <li>
            <div
              className="cursor-pointer flex items-center justify-between hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg"
              onClick={() => toggleDropdown("rnd")}
            >
              <div className="flex items-center space-x-3">
                <FaCogs className="text-lg" />
                <span className="font-semibold">Research and Development</span>
              </div>
              {openDropdowns.includes("rnd") ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            {openDropdowns.includes("rnd") && (
              <ul className="ml-6 mt-2 space-y-1">
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">Projects</li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">BOM</li>
              </ul>
            )}
          </li>
        )}

        {/* Manufacturing Dropdown */}
        {permissions.access[5] && (
          <li>
            <div
              className="cursor-pointer flex items-center justify-between hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg"
              onClick={() => toggleDropdown("manufacturing")}
            >
              <div className="flex items-center space-x-3">
                <GiFactory className="text-lg" />
                <span className="font-semibold">Manufacturing</span>
              </div>
              {openDropdowns.includes("manufacturing") ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            {openDropdowns.includes("manufacturing") && (
              <ul className="ml-6 mt-2 space-y-1">
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">Production</li>
                <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">Assembly</li>
              </ul>
            )}
          </li>
        )}

        {/* Approvals Section */}
        <li>
                 {(isEmployee || isHeadOrAdminOrCEO) && (
                   <div
                     className="cursor-pointer flex items-center justify-between hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg"
                     onClick={() => toggleDropdown("approvals")}
                   >
                     <div className="flex items-center space-x-3">
                       <FaCheckCircle className="text-lg" />
                       <span className="font-semibold">Approvals</span>
                     </div>
                     {openDropdowns.includes("approvals") ? <FiChevronDown /> : <FiChevronRight />}
                   </div>
                 )}
                 {openDropdowns.includes("approvals") && (
                   <ul className="ml-6 mt-2 space-y-1">
                     {isEmployee && (
                       <>
                         <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300 flex items-center space-x-2">
                           <Link to="/my-requests" className="text-white w-full" onClick={handleModuleClick}>
                             MIF
                           </Link>
                         </li>
                         <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300 flex items-center space-x-2">
                           <Link to="/mrf-requests" className="text-white w-full" onClick={handleModuleClick}>
                             MRF
                           </Link>
                         </li>
                         <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300 flex items-center space-x-2">
                           <Link to="/my-return-requests" className="text-white w-full" onClick={handleModuleClick}>
                           RETURN FORM
                           </Link>
                         </li>
                       </>
                     )}
                     {isHeadOrAdminOrCEO && (
                       <>
                         <li>
                           <div
                             className="cursor-pointer flex items-center justify-between hover:bg-gray-600 p-2 rounded-md transition-all duration-300"
                             onClick={() => toggleDropdown("myRequests")}
                           >
                             <span className="font-semibold">My Requests</span>
                             {openDropdowns.includes("myRequests") ? <FiChevronDown /> : <FiChevronRight />}
                           </div>
                           {openDropdowns.includes("myRequests") && (
                             <ul className="ml-6 mt-2 space-y-1">
                               <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                                 <Link to="/my-requests" className="text-white w-full" onClick={handleModuleClick}>
                                   MIF
                                 </Link>
                               </li>
                               <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                                 <Link to="/mrf-requests" className="text-white w-full" onClick={handleModuleClick}>
                                   MRF
                                 </Link>
                               </li>
                               <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                                 <Link to="/return-approval" className="text-white w-full" onClick={handleModuleClick}>
                                   RETURN FORM
                                 </Link>
                               </li>
                             </ul>
                           )}
                         </li>
                         {permissions.access[9] && (
                           <li>
                             <div
                               className="cursor-pointer flex items-center justify-between hover:bg-gray-600 p-2 rounded-md transition-all duration-300"
                               onClick={() => toggleDropdown("approvalRequests")}
                               >
                               <span className="font">Approval Requests</span>
                               {openDropdowns.includes("approvalRequests") ? <FiChevronDown /> : <FiChevronRight />}
                             </div>
                             {openDropdowns.includes("approvalRequests") && (
                               <ul className="ml-6 mt-2 space-y-1">
                                 <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                                   <Link to="/mif-approval" className="text-white w-full" onClick={handleModuleClick}>
                                     MIF Approval
                                   </Link>
                                 </li>
                                 <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                                   <Link to="/mrf-approval" className="text-white w-full" onClick={handleModuleClick}>
                                     MRF Approval
                                   </Link>
                                 </li>
                                  
                                 <li className="cursor-pointer p-2 hover:bg-gray-500 rounded-md transition-all duration-300">
                                   <Link to="/return-approval" className="text-white w-full" onClick={handleModuleClick}>
                                    RETURN FORM 
                                   </Link>
                                 </li>
                               </ul>
                             )}
                           </li>
                         )}
                       </>
                     )}
                   </ul>
                 )}
               </li>

        {/* Request for Part No. */}
        <li className="cursor-pointer hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg">
          <Link
            to="/RequestForPartno"
            className="flex items-center space-x-3 text-white w-full hover:text-gray-200"
            onClick={handleModuleClick}
          >
            <RiFileList3Line className="text-lg" />
            <span className="font-semibold">Request for Part No.</span>
          </Link>
        </li>

        {/* Forms Dropdown */}
        <li>
          <div
            className="cursor-pointer flex items-center justify-between hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg"
            onClick={() => toggleDropdown("forms")}
          >
            <div className="flex items-center space-x-3">
              <FaFileAlt className="text-lg" />
              <span className="font-semibold">Forms</span>
            </div>
            {openDropdowns.includes("forms") ? <FiChevronDown /> : <FiChevronRight />}
          </div>
          {openDropdowns.includes("forms") && (
            <ul className="ml-6 mt-2 space-y-1">
              <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">Pickup Form</li>
              <li className="cursor-pointer p-2 hover:bg-gray-600 rounded-md transition-all duration-300">Dispatch Form</li>
            </ul>
          )}
        </li>

        {/* Documents */}
        {permissions.access[8] && (
          <li className="cursor-pointer hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg">
            <div className="flex items-center space-x-3">
              <FaFolder className="text-lg" />
              <span className="font-semibold"><Link to="/documents" className="text-white w-full" onClick={handleModuleClick}>
                                   Documents 
                                   </Link></span>
            </div>
            
          </li>
        )}

        {/* Settings */}
        <li className="cursor-pointer hover:bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg transition-all duration-300 hover:shadow-lg">
          <div className="flex items-center space-x-3">
            <IoMdSettings className="text-lg" />
            <span className="font-semibold">Settings</span>
          </div>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;