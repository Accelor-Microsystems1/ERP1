import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaTimes, FaEdit, FaChevronDown } from "react-icons/fa"; 
import { DateTime } from "luxon";
import isURL from "validator/lib/isURL"; 
import { fetchVendors } from "../utils/api";

// Add debounce utility function to prevent validation on every keystroke
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
};

const VendorDetailsModal = ({ open, onClose, onSave, component, readOnly = false}) => {
  const [formData, setFormData] = useState({
    description: "",
    mpn: "",
    vendorName: "",
    vendor_link: "",
    expected_deliverydate: "",
    certificate_desired: "none",
  });
  const [dateError, setDateError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [cocError, setCocError] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [hasSavedDetails, setHasSavedDetails] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [vendorSearchTerm, setVendorSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const formDataRef = useRef(formData);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (component) {
      const normalizedDescription =
        component.description || component.item_description || "";
      const initialFormData = {
        description: normalizedDescription || "",
        mpn: component.mpn || "",
        vendorName: component.vendorDetails?.vendorName || "",
        vendor_link: component.vendorDetails?.vendor_link || "",
        expected_deliverydate: component.vendorDetails?.expected_deliverydate || "",
        certificate_desired: component.vendorDetails?.certificate_desired ? "yes" : component.vendorDetails?.certificate_desired === false ? "no" : "none",
      };
      setFormData(initialFormData);
      formDataRef.current = initialFormData;
      setDateError("");
      setLinkError("");
      setCocError("");
      setHasSavedDetails(!!component.vendorDetails);
      setIsEditing(readOnly ? false : !component.vendorDetails?.vendorName);
      setVendorSearchTerm("");
      setIsDropdownOpen(false);
    }
  }, [component, readOnly]);

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const vendorList = await fetchVendors();
        setVendors(vendorList);
        setFilteredVendors(vendorList);
        setFetchError("");
      } catch (error) {
        console.error("Failed to load vendors:", error);
        setFetchError("Failed to load vendors. Please try again.");
      }
    };
    loadVendors();
  }, []);

  useEffect(() => {
    if (vendorSearchTerm) {
      const filtered = vendors.filter((vendor) =>
        vendor.toLowerCase().includes(vendorSearchTerm.toLowerCase())
      );
      setFilteredVendors(filtered);
    } else {
      setFilteredVendors(vendors);
    }
  }, [vendorSearchTerm, vendors]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const debouncedSetFormData = useCallback(
    debounce((newFormData) => {
      setFormData(newFormData);
    }, 300),
    []
  );

  const validateLink = useCallback(
    debounce((value) => {
      if (!value || value.length < 5 || !value.includes(".")) {
        setLinkError("Please enter a valid URL (e.g., https://example.com)");
        return;
      }
      if (!isURL(value, { require_protocol: false })) {
        setLinkError("Please enter a valid URL (e.g., https://example.com)");
      } else {
        setLinkError("");
      }
    }, 300),
    []
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formDataRef.current };

    if (name === "expected_deliverydate") {
      if (!value) {
        setDateError("Delivery date is required.");
      } else {
        const today = DateTime.now().setZone("Asia/Kolkata").startOf("day");
        const selectedDate = DateTime.fromISO(value, { zone: "Asia/Kolkata" });
        if (selectedDate < today) {
          setDateError("Delivery date must be today or in the future.");
        } else {
          setDateError("");
        }
        const formattedDate = selectedDate
          .set({ hour: 23, minute: 59, second: 59, millisecond: 0 })
          .toISO();
        newFormData = { ...newFormData, [name]: formattedDate };
      }
      formDataRef.current = newFormData;
      debouncedSetFormData(newFormData);
    } else if (name === "vendor_link") {
      newFormData = { ...newFormData, [name]: value };
      formDataRef.current = newFormData;
      debouncedSetFormData(newFormData);
      validateLink(value);
    } else if (name === "certificate_desired") {
      newFormData = { ...newFormData, [name]: value };
      setCocError(value === "none" ? "Please select Yes or No for CoC." : "");
      formDataRef.current = newFormData;
      setFormData(newFormData);
    } else {
      newFormData = { ...newFormData, [name]: value };
      formDataRef.current = newFormData;
      setFormData(newFormData);
    }
  };

  const handleVendorSelect = (vendor) => {
    const newFormData = { ...formDataRef.current, vendorName: vendor, vendor_link: "" };
    setFormData(newFormData);
    formDataRef.current = newFormData;
    setLinkError("");
    setIsDropdownOpen(false);
  };

  const resetForm = () => {
    const normalizedDescription =
      component?.description ||
      component?.item_description ||
      "";
    const initialFormData = {
      description: normalizedDescription,
      mpn: component?.mpn || "",
      vendorName: "",
      vendor_link: "",
      expected_deliverydate: "",
      certificate_desired: "none",
    };
    setFormData(initialFormData);
    formDataRef.current = initialFormData;
    setDateError("");
    setLinkError("");
    setCocError("");
    setIsEditing(readOnly ? false : true);
    setVendorSearchTerm("");
    setFilteredVendors(vendors);
    setIsDropdownOpen(false);
  };

const handleSave = () => {
  let hasError = false;

  // Validate Expected Delivery Date
  if (!formData.expected_deliverydate) {
    setDateError("Delivery date is required.");
    hasError = true;
  } else {
    const today = DateTime.now().setZone("Asia/Kolkata").startOf("day");
    const selectedDate = DateTime.fromISO(formData.expected_deliverydate, { zone: "Asia/Kolkata" });
    if (selectedDate < today) {
      setDateError("Delivery date must be today or in the future.");
      hasError = true;
    } else {
      setDateError("");
    }
  }

  // Validate Certification Desired
  if (formData.certificate_desired === "none") {
    setCocError("Please select Yes or No for CoC.");
    hasError = true;
  } else {
    setCocError("");
  }

  if (hasError) {
    return; // Prevent save if there are errors
  }

  onSave(component.basket_id, {
    vendorName: formData.vendorName,
    vendor_link: formData.vendor_link,
    expected_deliverydate: formData.expected_deliverydate,
    certificate_desired: formData.certificate_desired === "yes",
  });
  setHasSavedDetails(true);
  setIsEditing(false);
  onClose();
};

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const today = DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd");

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 transition-opacity duration-300 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl transform transition-all duration-300 slide-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-purple-800">Vendor Details</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-blue-600 transition-all duration-200"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <input
            type="text"
            value={formData.description}
            disabled
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">MPN</label>
          <input
            type="text"
            value={formData.mpn}
            disabled
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Vendor Name</label>
          {(!isEditing || readOnly) ? (
            <input
              type="text"
              value={formData.vendorName}
              disabled
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
            />
          ) : (
            <div className="relative w-full z-50" ref={dropdownRef}>
              <input
                type="text"
                name="vendorName"
                value={formData.vendorName}
                onChange={handleChange}
                onFocus={() => setIsDropdownOpen(true)}
                className={`w-full p-2 border rounded-lg text-sm ${
                  isEditing
                    ? "border-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all duration-300"
                    : "border-gray-300 bg-gray-100"
                }`}
                placeholder="Select vendor name"
                disabled={!isEditing || readOnly}
              />
              {isDropdownOpen && (
                <ul className="absolute w-full bg-white border border-purple-400 rounded-lg mt-1 max-h-60 overflow-y-auto dropdown-menu">
                  {filteredVendors.length > 0 ? (
                    filteredVendors.map((vendor) => (
                      <li
                        key={vendor}
                        onClick={() => handleVendorSelect(vendor)}
                        className="p-2 hover:bg-blue-100 cursor-pointer text-sm"
                      >
                        {vendor}
                      </li>
                    ))
                  ) : (
                    <li className="p-2 text-gray-500 text-sm">
                      No vendors found
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
       <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Vendor Link</label>
          {(!isEditing || readOnly) && formData.vendor_link ? (
            <a
              href={formData.vendor_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm break-all"
            >
              Link
            </a>
          ) : (
            <>
              <input
                type="text"
                name="vendor_link"
                value={formData.vendor_link}
                onChange={handleChange}
                disabled={!isEditing || readOnly}
                placeholder="https://example.com"
                className={`w-full p-2 border rounded-lg text-sm ${
                  linkError
                    ? "border-red-500 focus:ring-red-500"
                    : isEditing
                    ? "border-purple-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    : "border-gray-300 bg-gray-100"
                }`}
              />
              {linkError && (
                <p className="text-red-500 text-xs mt-1">{linkError}</p>
              )}
            </>
          )}
        </div>
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700">Expected Delivery Date</label>
  <input
    type="date"
    name="expected_deliverydate"
    value={formData.expected_deliverydate ? DateTime.fromISO(formData.expected_deliverydate).toFormat("yyyy-MM-dd") : ""}
    onChange={handleChange}
    min={today}
    disabled={!isEditing || readOnly}
    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
      dateError
        ? "border-red-500 focus:ring-red-500"
        : isEditing
        ? "border-purple-600 focus:ring-blue-600"
        : "border-gray-300 bg-gray-100"
    }`}
  />
  {dateError && (
    <p className="text-red-500 text-xs mt-1">{dateError}</p>
  )}
</div>

<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700">Certification Desired</label>
  <div className="flex gap-4">
    <label className="flex items-center">
      <input
        type="radio"
        name="certificate_desired"
        value="yes"
        disabled={!isEditing || readOnly}
        checked={formData.certificate_desired === "yes"}
        onChange={handleChange}
        className="mr-2"
      />
      Yes
    </label>
    <label className="flex items-center">
      <input
        type="radio"
        name="certificate_desired"
        value="no"
        checked={formData.certificate_desired === "no"}
        onChange={handleChange}
        disabled={!isEditing || readOnly}
        className="mr-2"
      />
      No
    </label>
  </div>
  {cocError && (
    <p className="text-red-500 text-xs mt-1">{cocError}</p>
  )}
</div>

<div className="flex justify-end gap-2">
  {!readOnly && isEditing && (
    <button
      onClick={handleSave}
      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-300 text-sm hover:pulse"
      disabled={!!dateError || formData.certificate_desired === "none"}
    >
      Save
    </button>
  )}
  <button
    onClick={onClose}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 text-sm hover:pulse"
  >
    Cancel
  </button>
</div>
      </div>
      <style jsx>{`
        .slide-in {
          animation: slideIn 0.5s ease-in-out;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .hover\\:pulse:hover {
          animation: pulse 0.3s ease-in-out;
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default VendorDetailsModal;