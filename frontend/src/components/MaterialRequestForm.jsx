import React, { useState, useEffect, useRef, useMemo } from "react";
import { DateTime } from "luxon";
import { fetchProjects, submitMaterialRequestForm, deleteMRFItem } from "../utils/api.js";
import { FaTrash, FaTimes, FaPlus } from "react-icons/fa";
import _ from "lodash"; 
import VendorDetailsModal from "./VendorDetailsModal";

const MaterialRequestForm = ({
  mrfData: initialMrfData,
  projectName: parentProjectName,
  onClose,
  onSubmit,
  onRequiredQuantityChange,
  requiredQuantities,
  cartItems,
  mrfSubmitted,
  setMrfNo,
  mrfNo,
  hasMifItems,
  onMrfDataUpdate,
}) => {
  const [localMrfNo, setLocalMrfNo] = useState(mrfNo || "Not yet generated");
  const [error, setError] = useState(null);
  const [localProjectName, setLocalProjectName] = useState(parentProjectName || "");
  const [currentDateTime, setCurrentDate] = useState(getFormattedISTDate());
  const [submitting, setSubmitting] = useState(false);
  const [mrfRequiredQuantities, setMrfRequiredQuantities] = useState({});
  const [mrfData, setMrfData] = useState(initialMrfData);
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const userIdRaw = localStorage.getItem("user_id");
  const userId = userIdRaw ? parseInt(userIdRaw, 10) : null;
  const dropdownRef = useRef(null);

  function getFormattedISTDate() {
    return DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd HH:mm:ss");
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(getFormattedISTDate());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const memoizedInitialMrfData = useMemo(() => initialMrfData, [initialMrfData]);

  useEffect(() => {
    const initialQuantities = {};
    memoizedInitialMrfData.forEach((newItem) => {
      initialQuantities[newItem.basket_id] = newItem.required_quantity || newItem.initial_requested_quantity || 0;
    });
    setMrfRequiredQuantities(initialQuantities);
  }, [memoizedInitialMrfData]);

  useEffect(() => {
    setLocalMrfNo(mrfNo);
    setLocalProjectName(parentProjectName || "");
  }, [mrfNo, parentProjectName]);

  useEffect(() => {
    setMrfData(initialMrfData);
  }, [initialMrfData]);

  useEffect(() => {
    let isMounted = true;

    const fetchProjectsData = async () => {
      try {
        const data = await fetchProjects();
        if (isMounted) {
          setProjects(data);
          setFilteredProjects(data);
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load project names. Please try again.");
        }
        console.error(err);
      }
    };

    fetchProjectsData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle search term changes
  useEffect(() => {
    if (searchTerm) {
      const filtered = projects.filter((project) =>
        project.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects(projects);
    }
  }, [searchTerm, projects]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRequiredQuantityChange = (basketId, value) => {
    const newQty = parseInt(value) || 0;
    if (newQty < 0) {
      setError("Required quantity cannot be negative.");
      return;
    }
    setMrfRequiredQuantities((prev) => ({
      ...prev,
      [basketId]: newQty,
    }));

    const item = mrfData.find((item) => item.basket_id === basketId);
    const cartItem = cartItems.find((ci) => ci.basket_id === basketId);
    const onHandQty = cartItem?.on_hand_quantity || 0;

    if (!item) {
      if (cartItem && newQty > onHandQty) {
        // START UPDATE: Preserve vendorDetails if the item previously existed
        const existingItem = mrfData.find((md) => md.basket_id === basketId);
        const newMrfItem = {
          basket_id: cartItem.basket_id,
          component_id: cartItem.component_id,
          initial_requested_quantity: newQty,
          item_description: cartItem.item_description,
          mpn: cartItem.mpn,
          part_no: cartItem.part_no,
          make: cartItem.make,
          date: currentDateTime,
          on_hand_quantity: onHandQty,
          required_quantity: newQty,
          vendorDetails: existingItem?.vendorDetails || null,
        };
        setMrfData((prev) => {
          const updatedMrfData = [...prev, newMrfItem];
          localStorage.setItem("mrfData", JSON.stringify(updatedMrfData));
          onMrfDataUpdate(updatedMrfData);
          return updatedMrfData;
        });
        // END UPDATE
      }
      return;
    }

    const totalRequiredQty = newQty + (onHandQty > 0 ? Math.min(requiredQuantities[basketId] || 0, onHandQty) : 0);
    onRequiredQuantityChange(basketId, totalRequiredQty);

    setMrfData((prev) => {
      const updatedMrfData = prev.map((md) =>
        md.basket_id === basketId
          ? { ...md, initial_requested_quantity: newQty, required_quantity: newQty }
          : md
      );
      localStorage.setItem("mrfData", JSON.stringify(updatedMrfData));
      onMrfDataUpdate(updatedMrfData);
      return updatedMrfData;
    });

    if (newQty === 0) {
      setMrfData((prev) => {
        const updatedMrfData = prev.filter((md) => md.basket_id !== basketId);
        setMrfRequiredQuantities((prevQuantities) => {
          const newQuantities = { ...prevQuantities };
          delete newQuantities[basketId];
          return newQuantities;
        });
        localStorage.setItem("mrfData", JSON.stringify(updatedMrfData));
        onMrfDataUpdate(updatedMrfData);
        return updatedMrfData;
      });
    }
  };

  const handleVendorDetailsSave = (basketId, vendorDetails) => {
    setMrfData((prev) => {
      const updatedMrfData = prev.map((item) =>
        item.basket_id === basketId ? { ...item, vendorDetails } : item
      );
      console.log("After saving vendor details, mrfData:", updatedMrfData);
      localStorage.setItem("mrfData", JSON.stringify(updatedMrfData));
      onMrfDataUpdate(updatedMrfData);
      return updatedMrfData;
    });
  };

  const handleOpenModal = (component) => {
    setSelectedComponent(component);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedComponent(null);
  };

  const handleDelete = async (basketId) => {
    try {
      const item = mrfData.find((item) => item.basket_id === basketId);
      if (!item) {
        throw new Error("Item not found in draft.");
      }

      setMrfData((prev) => {
        const updatedMrfData = prev.filter((item) => item.basket_id !== basketId);
        setMrfRequiredQuantities((prev) => {
          const newQuantities = { ...prev };
          delete newQuantities[basketId];
          return newQuantities;
        });
        localStorage.setItem("mrfData", JSON.stringify(updatedMrfData));
        onMrfDataUpdate(updatedMrfData);
        return updatedMrfData;
      });

      const cartItem = cartItems.find((ci) => ci.basket_id === basketId);
      if (cartItem) {
        onRequiredQuantityChange(basketId, requiredQuantities[basketId] || 0);
      }

      alert("Item deleted successfully.");
    } catch (error) {
      alert(error.message || "Failed to delete item from draft.");
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (!userId || isNaN(userId)) {
        throw new Error("User ID is missing or invalid. Please log in again.");
      }

      const itemsToSubmit = mrfData.map((item) => {
        if (!item.component_id) {
          throw new Error(`Missing component_id for basket_id: ${item.basket_id}`);
        }

        const requestedQty = parseInt(mrfRequiredQuantities[item.basket_id] || item.initial_requested_quantity) || 0;
        if (requestedQty <= 0) {
          throw new Error(`Requested quantity must be greater than 0 for basket_id: ${item.basket_id}`);
        }

        const parsedDate = DateTime.fromISO(item.vendorDetails.expected_deliverydate, { zone: "Asia/Kolkata" });
        if (!parsedDate.isValid) {
          throw new Error(`Invalid expected_deliverydate for basket_id ${item.basket_id}: ${parsedDate.invalidReason}`);
        }

        return {
          component_id: item.component_id,
          requested_quantity: requestedQty,
          project_name: localProjectName || null,
          date: getFormattedISTDate(),
          user_id: userId,
          status: "Head Pending Approval",
          vendorDetails: item.vendorDetails || null,
        };
      });

      const basketIdsToSubmit = mrfData.map((item) => item.basket_id);

      if (itemsToSubmit.length !== basketIdsToSubmit.length) {
        throw new Error("Mismatch between items and basket_ids lengths");
      }

      if (itemsToSubmit.length === 0 || basketIdsToSubmit.length === 0) {
        setError("No valid items to submit in Material Request Form.");
        return;
      }

      console.log("Submitting MRF with payload:", { items: itemsToSubmit, basket_ids: basketIdsToSubmit });

      const response = await submitMaterialRequestForm({ items: itemsToSubmit, basket_ids: basketIdsToSubmit });
      const newMrfNo = response.mrf_no || "N/A";
      setLocalMrfNo(newMrfNo);
      setMrfNo(newMrfNo);
      localStorage.removeItem("mrfData");
      onSubmit(newMrfNo);
      onMrfDataUpdate([]);
      alert(`Material Request Form submitted successfully with MRF NO: ${newMrfNo}!`);
    } catch (error) {
      console.error("Error submitting material request form:", error.response?.data || error);
      setError(error.response?.data?.details || error.message || "Failed to submit material request form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProjectSelect = (project) => {
    setLocalProjectName(project);
    setSearchTerm("");
    setFilteredProjects(projects);
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-4 w-1/2 min-h-[calc(100vh-8rem)] transition-all duration-500 ease-in-out slide-in">
      <style>
        {`
          .fade-in {
            animation: fadeIn 0.5s ease-in-out;
          }
          .slide-in {
            animation: slideIn 0.5s ease-in-out;
          }
          .row-enter {
            animation: rowEnter 0.3s ease-in-out;
          }
          .pulse {
            animation: pulse 0.3s ease-in-out;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes rowEnter {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #9333ea;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            display: inline-block;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div className="flex justify-between items-start mb-4 relative">
        <h2 className="text-2xl font-bold text-purple-800 border-b-2 border-purple-400 pb-2">
          Material Request Form
          {mrfSubmitted && <span className="text-sm font-normal text-gray-600 ml-2">(Submitted)</span>}
        </h2>
        <button
          onClick={onClose}
          className="absolute top-0 right-0 text-gray-600 hover:text-blue-600 transition-all duration-200 hover:pulse"
          title="Close"
        >
          <FaTimes size={20} />
        </button>
        <div className="text-gray-700 text-sm text-right">
          <div>Date: {currentDateTime}</div>
          <div className="flex flex-col items-end gap-2 mt-2">
            <div className="relative w-40 z-50" ref={dropdownRef}>
              <input
                type="text"
                value={searchTerm || localProjectName}
                onChange={handleSearchChange}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full p-2 border border-purple-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm transition-all duration-300"
                placeholder="Select project name (Optional)"
                disabled={mrfSubmitted}
              />
              {isDropdownOpen && !mrfSubmitted && (
                <ul className="absolute w-full bg-white border border-purple-400 rounded-lg mt-1 dropdown-menu">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => (
                      <li
                        key={project}
                        onClick={() => handleProjectSelect(project)}
                        className="p-2 hover:bg-blue-100 cursor-pointer text-sm"
                      >
                        {project}
                      </li>
                    ))
                  ) : (
                    <li className="p-2 text-gray-500 text-sm">
                      No projects found
                    </li>
                  )}
                </ul>
              )}
            </div>
            <input
              type="text"
              value={localMrfNo}
              disabled
              className="w-40 p-2 border border-purple-400 rounded-lg bg-gray-100 text-sm"
              placeholder="MRF NO."
            />
          </div>
        </div>
      </div>

      {error && <p className="text-blue-600 text-center font-medium mb-4">{error}</p>}

      <div className="relative flex-1">
        <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
          <table className="w-full border-collapse">
            <thead className="bg-blue-100 text-gray-800 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-16">S.No</th>
                <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">Description</th>
                <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">MPN</th>
                <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">Part No</th>
                <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">Make</th>
                <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">Requested Qty</th>
                <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">Vendor Details</th>
                <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {mrfData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-4 text-center text-gray-500">
                    No items in material request form.
                  </td>
                </tr>
              ) : (
                mrfData.map((item, index) => (
                  <tr
                    key={item.basket_id}
                    className="hover:bg-blue-100 transition-all duration-200 shadow-sm row-enter"
                  >
                    <td className="p-3 text-center border-b border-blue-200 text-sm">{index + 1}</td>
                    <td className="p-3 text-center border-b border-blue-200 text-sm">{item.item_description}</td>
                    <td className="p-3 text-center border-b border-blue-200 text-sm">{item.mpn}</td>
                    <td className="p-3 text-center border-b border-blue-200 text-sm">{item.part_no || "N/A"}</td>
                    <td className="p-3 text-center border-b border-blue-200 text-sm">{item.make || "N/A"}</td>
                    <td className="p-3 text-center border-b border-blue-200 text-sm">
                      <input
                        type="number"
                        value={mrfRequiredQuantities[item.basket_id] || ""}
                        onChange={(e) => handleRequiredQuantityChange(item.basket_id, e.target.value)}
                        className="w-16 p-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm transition-all duration-300"
                        min="0"
                        disabled={mrfSubmitted}
                      />
                    </td>
                    <td className="p-3 text-center border-b border-blue-200 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(item)}
                          className="text-blue-600 hover:text-blue-800 hover:scale-110 transition-all duration-200"
                          title="Add/View Vendor Details"
                          disabled={mrfSubmitted}
                        >
                          <FaPlus size={14} />
                        </button>
                        {item.vendorDetails && (
                          <span className="text-green-600 text-xs">Details Attached</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center border-b border-blue-200 text-sm">
                      {!mrfSubmitted && (
                        <button
                          onClick={() => handleDelete(item.basket_id)}
                          className="text-blue-600 hover:text-blue-800 hover:scale-110 transition-all duration-200"
                          title="Delete Item"
                        >
                          <FaTrash size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!mrfSubmitted && (
          <div className="mt-4 flex justify-end gap-4 p-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all duration-300 text-sm hover:pulse"
            >
              Cancel
            </button>
            {!hasMifItems && (
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 hover:shadow-lg transition-all duration-300 text-sm flex items-center gap-2 hover:pulse"
                disabled={submitting || mrfData.length === 0}
              >
                {submitting && <span className="spinner"></span>}
                Submit
              </button>
            )}
          </div>
        )}
      </div>
      <VendorDetailsModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSave={handleVendorDetailsSave}
        component={selectedComponent}
      />
    </div>
  );
};

export default MaterialRequestForm;