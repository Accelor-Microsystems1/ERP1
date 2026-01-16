
import React, { useState, useEffect, useRef } from "react";
import { DateTime } from "luxon";
import { fetchBasketItemsForUMIF, submitMaterialIssueForm, deleteBasketItem, updateBasketQuantities, submitMaterialRequestForm, fetchProjects } from "../utils/api.js";
import { FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import MaterialRequestForm from "../components/MaterialRequestForm.jsx";

const Noncoc_UMIF = () => {
  const [cartItems, setCartItems] = useState([]);
  const [requiredQuantities, setRequiredQuantities] = useState({});
  const [requestedQuantities, setRequestedQuantities] = useState({});
  const [projectName, setProjectName] = useState("");
  const [mrfNo, setMrfNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [umi, setUmi] = useState("");
  const [currentDateTime, setCurrentDate] = useState(getFormattedISTDate());
  const [mrfData, setMrfData] = useState([]);
  const [showMRF, setShowMRF] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mrfSubmitted, setMrfSubmitted] = useState(false);
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const initialFetchDone = useRef(false);

  function getFormattedISTDate() {
    return DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd HH:mm:ss");
  }

  const handleMrfDataUpdate = (updatedMrfData) => {
    setMrfData(updatedMrfData);
    localStorage.setItem("mrfData", JSON.stringify(updatedMrfData));
    setCartItems((prevCartItems) =>
      prevCartItems.map((cartItem) => {
        const mrfItem = updatedMrfData.find((md) => md.basket_id === cartItem.basket_id);
        return mrfItem && mrfItem.vendorDetails
          ? { ...cartItem, vendorDetails: mrfItem.vendorDetails }
          : cartItem;
      })
    );
  };

  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchBasketItems();
    }

    const interval = setInterval(() => {
      setCurrentDate(getFormattedISTDate());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
  }, []); // Run only once on mount

  // CHANGED: Separate useEffect for click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []); // Run only once on mount

  // CHANGED: Separate useEffect for project filtering
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

  useEffect(() => {
    localStorage.setItem("mrfData", JSON.stringify(mrfData));
    localStorage.setItem("showMRF", showMRF.toString());
  }, [mrfData, showMRF]);

  const fetchBasketItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchBasketItemsForUMIF() || [];
      const filteredItems = items.filter((item) => !item.umi && !item.mrf_no);

      setCartItems(
        filteredItems.map((item) => ({
          ...item,
          on_hand_quantity: Number(item.on_hand_quantity) || 0,
          initial_requestedqty: Number(item.initial_requestedqty) || 0,
          updated_requestedqty: Number(item.updated_requestedqty) || 0,
          date: item.date ? item.date : getFormattedISTDate(),
        }))
      );

      const newRequiredQuantities = {};
      const newRequestedQuantities = {};
      filteredItems.forEach((item) => {
        newRequiredQuantities[item.basket_id] = item.updated_requestedqty || "";
        newRequestedQuantities[item.basket_id] = calculateRequestedQty(
          item.basket_id,
          item.updated_requestedqty || 0,
          item.on_hand_quantity
        );
      });
      setRequiredQuantities(newRequiredQuantities);
      setRequestedQuantities(newRequestedQuantities);
    } catch (error) {
      console.error("Fetch error:", error);
      setError(`Failed to fetch basket items: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateRequestedQty = (basketId, requiredQty, onHandQty) => {
    const reqQty = parseInt(requiredQty) || 0;
    return reqQty > onHandQty ? onHandQty : reqQty;
  };

 const handleRequiredQuantityChange = async (basketId, value) => {
    const requiredQty = parseInt(value) || 0;
    if (requiredQty < 0) {
      setError("Required quantity cannot be negative.");
      return;
    }

    const item = cartItems.find((item) => item.basket_id === basketId);
    if (!item) {
      setError("Item not found in cart.");
      return;
    }

    setRequiredQuantities((prev) => ({
      ...prev,
      [basketId]: requiredQty,
    }));

    const onHandQty = item.on_hand_quantity || 0;
    let updatedMrfData = [...mrfData];

    const hasOtherMifItems = cartItems.some(
      (i) =>
        i.basket_id !== basketId &&
        (parseInt(requiredQuantities[i.basket_id] || 0) > 0 || i.on_hand_quantity > 0)
    );

    if (requiredQty > 0) {
      const mrfRequestedQty = Math.max(requiredQty - onHandQty, 0);
      if (mrfRequestedQty > 0 || onHandQty === 0) {
        const existingMrfItem = updatedMrfData.find((md) => md.basket_id === basketId);
        if (existingMrfItem) {
          updatedMrfData = updatedMrfData.map((md) =>
            md.basket_id === basketId
              ? { ...md, initial_requested_quantity: mrfRequestedQty || requiredQty, required_quantity: mrfRequestedQty || requiredQty }
              : md
          );
        } else {
          const newMrfItem = {
            basket_id: item.basket_id,
            component_id: item.component_id,
            initial_requested_quantity: mrfRequestedQty || requiredQty,
            item_description: item.item_description,
            mpn: item.mpn,
            part_no: item.part_no,
            make: item.make,
            date: currentDateTime,
            on_hand_quantity: onHandQty,
            required_quantity: mrfRequestedQty || requiredQty,
          };
          updatedMrfData = [...updatedMrfData, newMrfItem];

          if (onHandQty === 0 && !hasOtherMifItems) {
            setTimeout(() => {
              setCartItems((prev) => prev.filter((i) => i.basket_id !== basketId));
              setRequiredQuantities((prev) => {
                const newQuantities = { ...prev };
                delete newQuantities[basketId];
                return newQuantities;
              });
              setRequestedQuantities((prev) => {
                const newQuantities = { ...prev };
                delete newQuantities[basketId];
                return newQuantities;
              });
            }, 2000);
          }
        }
      } else {
        updatedMrfData = updatedMrfData.filter((md) => md.basket_id !== basketId);
      }
      setMrfData(updatedMrfData);
      setShowMRF(updatedMrfData.length > 0);
    } else {
      updatedMrfData = updatedMrfData.filter((md) => md.basket_id !== basketId);
      setMrfData(updatedMrfData);
      setShowMRF(updatedMrfData.length > 0);
      setRequiredQuantities((prev) => ({
        ...prev,
        [basketId]: "",
      }));
      setRequestedQuantities((prev) => ({
        ...prev,
        [basketId]: 0,
      }));
    }

    const newRequestedQty = calculateRequestedQty(basketId, requiredQty, onHandQty);
    setRequestedQuantities((prev) => ({
      ...prev,
      [basketId]: newRequestedQty,
    }));

    try {
      await updateBasketQuantities(basketId, requiredQty);
      setError(null);
    } catch (error) {
      console.error("Error updating quantity:", error);
      setError("Failed to update quantity.");
    }
  };

  const handleDelete = async (basketId) => {
    try {
      await deleteBasketItem(basketId);
      setCartItems((prevItems) => prevItems.filter((item) => item.basket_id !== basketId));
      setRequiredQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[basketId];
        return newQuantities;
      });
      setRequestedQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[basketId];
        return newQuantities;
      });
      const newMrfData = mrfData.filter((item) => item.basket_id !== basketId);
      setMrfData(newMrfData);
      setShowMRF(newMrfData.length > 0);
      localStorage.setItem("mrfData", JSON.stringify(newMrfData));
      alert("Item removed from basket.");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to remove item from basket.");
    }
  };

  const handleSubmitOrder = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const submitDateTime = getFormattedISTDate();
      const user_id = localStorage.getItem("user_id");

      if (!user_id) {
        throw new Error("User ID not found in local storage. Please ensure you are logged in.");
      }

      let generatedMrfNo = mrfNo;
      if (mrfData.length > 0 && !mrfSubmitted) {
        const mrfItemsToSubmit = mrfData.map((item) => ({
          component_id: item.component_id,
          requested_quantity: item.required_quantity,
          date: submitDateTime,
          user_id: parseInt(user_id),
          project_name: projectName || "",
          vendorDetails: item.vendorDetails || null,
        }));
        const basketIds = mrfData.map((item) => item.basket_id);

        if (mrfItemsToSubmit.length === 0) {
          alert("No items eligible for Material Request Form submission.");
          return;
        }

        const mrfResponse = await submitMaterialRequestForm({ items: mrfItemsToSubmit, basket_ids: basketIds });
        generatedMrfNo = mrfResponse.mrf_no;
        setMrfNo(generatedMrfNo);
        setMrfSubmitted(true);
      }

      const mifItemsToSubmit = cartItems
      
        .filter((item) => {
          const requiredQty = parseInt(requiredQuantities[item.basket_id] || 0);
          return requiredQty > 0 || mrfData.some((md) => md.basket_id === item.basket_id);
        })
        .map((item) => ({
          basket_id: item.basket_id,
          requested_quantity: parseInt(requestedQuantities[item.basket_id] || 0),
          date: submitDateTime,
          mrf_no: generatedMrfNo && mrfData.some((md) => md.basket_id === item.basket_id) ? generatedMrfNo : null,
          project_name: projectName || "",
          vendorDetails: item.vendorDetails || null,
        }));

      if (mifItemsToSubmit.length === 0 && mrfData.length === 0) {
        alert("No items eligible for submission.");
        return;
      }

      let mifResponse = null;
      if (mifItemsToSubmit.length > 0) {
        mifResponse = await submitMaterialIssueForm({ items: mifItemsToSubmit });
        setUmi(mifResponse.umi || "N/A");
      }

      setCartItems([]);
      setRequiredQuantities({});
      setRequestedQuantities({});
      setProjectName("");
      initialFetchDone.current = false;
      setMrfData([]);
      setShowMRF(false);
      setMrfNo("");
      setMrfSubmitted(false);
      localStorage.removeItem("mrfData");
      await fetchBasketItems();

      alert(
        `Order submitted successfully! ${
          mifResponse ? `UMI: ${mifResponse.umi}` : ""
        }${generatedMrfNo ? `${mifResponse ? ", " : ""}MRF NO: ${generatedMrfNo}` : ""}`
      );
      navigate("/home");
    } catch (error) {
      console.error("Error submitting order:", error.message);
      alert(`Failed to submit order: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await Promise.all(cartItems.map((item) => deleteBasketItem(item.basket_id)));
      setCartItems([]);
      setRequiredQuantities({});
      setRequestedQuantities({});
      setProjectName("");
      initialFetchDone.current = false;
      setUmi("");
      setMrfData([]);
      setShowMRF(false);
      setMrfNo("");
      setMrfSubmitted(false);
      localStorage.removeItem("mrfData");
      alert("Material issue request canceled.");
      navigate("/non-cocu");
    } catch (error) {
      alert("Failed to cancel request: " + (error.response?.data?.message || "Unknown error"));
    }
  };

  const handleProjectNameChange = (e) => {
    const newValue = e.target.value;
    console.log("Project Name Input Event:", { newValue, previousValue: projectName });
    setProjectName(newValue);
  };

  const handleProjectSelect = (project) => {
    setProjectName(project);
    setSearchTerm("");
    setFilteredProjects(projects);
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <style>
        {`
          .elegant-bg {
            background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #e0f2fe 100%);
            animation: subtleMove 20s ease-in-out infinite;
            position: relative;
            overflow: hidden;
          }
          @keyframes subtleMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .elegant-bg::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
            animation: gentleFade 5s ease-in-out infinite;
          }
          @keyframes gentleFade {
            0% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
            100% { opacity: 0.4; transform: scale(1); }
          }
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
            border-top: 3px solid #3b82f6;
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
          .editable-input {
            background-color: #ffffff !important;
            border: 2px solid #4b9cea !important;
            color: #1f2937 !important;
            opacity: 1 !important;
            cursor: text !important;
          }
          .editable-input:focus {
            border-color: #2563eb !important;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1) !important;
          }
        `}
      </style>
      <div className="pt-16 elegant-bg">
        <div className="flex flex-row gap-4 p-4">
          <div className={`bg-white rounded-lg shadow-xl p-4 ${showMRF ? "w-1/2" : "w-full"} min-h-[calc(100vh-8rem)] transition-all duration-500 ease-in-out fade-in`}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-blue-800 border-b-2 border-blue-400 pb-2">
                User Material Issue Form
              </h2>
              <div className="text-gray-700 text-sm text-right">
                <div>Date: {currentDateTime}</div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
             
                {/* <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label> */}
                <div className="relative w-40 z-50" ref={dropdownRef}>
                  <input
                    type="text"
                    value={searchTerm || projectName}
                    onChange={handleSearchChange}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full p-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm transition-all duration-300 editable-input"
                    placeholder="Select project name"
                  />
                  {isDropdownOpen && (
                    <ul className="absolute w-full bg-white border border-blue-400 rounded-lg mt-1 dropdown-menu">
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
              

              <div className="flex items-center gap-2 flex-wrap mb-2">
                <input
                  type="text"
                  value={mrfNo}
                  disabled
                  className="w-40 p-2 border border-blue-400 rounded-lg bg-gray-100 text-sm"
                  placeholder="MRF NO."
                />
                {umi && <span className="font-medium text-sm">MIF NO.: {umi}</span>}
              </div>
            </div>

            {loading && <p className="text-gray-600 text-center">Loading...</p>}
            {error && <p className="text-blue-600 text-center font-medium">{error}</p>}

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
                      <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">UoM</th>
                      <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">On-Hand Qty</th>
                      <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">Requested Qty (For Issuing)</th>
                      <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-24">Required Qty</th>
                      <th className="p-3 text-center border-b-2 border-blue-300 text-sm w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-4 text-center text-gray-500">
                          No items found in your basket.
                        </td>
                      </tr>
                    ) : (
                      cartItems.map((item, index) => (
                        <tr
                          key={item.basket_id}
                          className="hover:bg-blue-100 transition-all duration-200 shadow-sm row-enter"
                        >
                          <td className="p-3 text-center border-b border-blue-200 text-sm">{index + 1}</td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">{item.item_description}</td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">{item.mpn}</td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">{item.part_no || "N/A"}</td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">{item.make || "N/A"}</td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">{item.uom || "N/A"}</td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">{item.on_hand_quantity}</td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">
                            {requestedQuantities[item.basket_id] || 0}
                          </td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">
                            <input
                              type="number"
                              value={requiredQuantities[item.basket_id] || ""}
                              onChange={(e) => handleRequiredQuantityChange(item.basket_id, e.target.value)}
                              className="w-16 p-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm transition-all duration-300"
                              min="0"
                            />
                          </td>
                          <td className="p-3 text-center border-b border-blue-200 text-sm">
                            <button
                              onClick={() => handleDelete(item.basket_id)}
                              className="text-blue-600 hover:text-blue-800 hover:scale-110 transition-all duration-200"
                              title="Delete Item"
                            >
                              <FaTrash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {cartItems.length > 0 && (
                <div className="mt-4 flex justify-end gap-4 p-3">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all duration-300 text-sm hover:pulse"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitOrder}
                    className={`px-4 py-2 text-white rounded-lg transition-all duration-300 text-sm flex items-center gap-2 ${
                      submitting
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-purple-600 hover:bg-purple-700 hover:shadow-lg hover:pulse"
                    }`}
                    disabled={submitting}
                  >
                    {submitting && <span className="spinner"></span>}
                    Submit 
                  </button>
                </div>
              )}
            </div>
          </div>

          {showMRF && (
            <MaterialRequestForm
              mrfData={mrfData}
              projectName={projectName} // Pass projectName to MaterialRequestForm
              onClose={() => setShowMRF(false)}
              onSubmit={(newMrfNo) => {
                setMrfNo(newMrfNo);
                setMrfSubmitted(true);
              }}
              onRequiredQuantityChange={handleRequiredQuantityChange}
              requiredQuantities={requiredQuantities}
              cartItems={cartItems}
              mrfSubmitted={mrfSubmitted}
              setMrfNo={setMrfNo}
              mrfNo={mrfNo}
              hasMifItems={cartItems.length > 0}
              onMrfDataUpdate={handleMrfDataUpdate}

            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Noncoc_UMIF;