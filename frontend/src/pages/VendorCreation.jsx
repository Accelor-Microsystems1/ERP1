import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import moment from 'moment';
import { createVendor } from '../utils/api';

const VendorCreation = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    gstin: '',
    name: '',
    address: '',
    pan: '',
    contact_person_name: '',
    contact_no: '',
    email_id: ''
  });
  const [errors, setErrors] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBackModalVisible, setIsBackModalVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(moment());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let updatedValue = value;

    // Convert GSTIN and PAN to uppercase
    if (name === 'gstin' || name === 'pan') {
      updatedValue = value.toUpperCase();
    }

    // Update form data
    setFormData((prev) => {
      const newFormData = { ...prev, [name]: updatedValue };

      // Derive PAN from GSTIN if GSTIN is being updated
      if (name === 'gstin' && updatedValue.length === 15) {
        const derivedPan = updatedValue.slice(2, -3); // Remove first 2 and last 3 characters
        newFormData.pan = derivedPan;
      } else if (name === 'gstin' && updatedValue.length !== 15) {
        newFormData.pan = ''; // Reset PAN if GSTIN is not 15 characters
      }

      return newFormData;
    });

    // Clear specific error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Validate form before submission
  const validateForm = () => {
    const newErrors = {};
    if (!formData.gstin) newErrors.gstin = 'GSTIN is required';
    else if (formData.gstin.length !== 15) newErrors.gstin = 'GSTIN must be 15 characters';
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.pan) newErrors.pan = 'PAN is required';
    else if (formData.pan.length !== 10) newErrors.pan = 'PAN must be 10 characters';
    if (formData.contact_no && !/^\d{10}$/.test(formData.contact_no)) {
      newErrors.contact_no = 'Contact number must be a 10-digit number';
    }
    if (formData.email_id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_id)) {
      newErrors.email_id = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsModalOpen(true);
    }
  };

  // Save vendor to backend
  const confirmSave = async () => {
    try {
      const vendorData = {
        gstin: formData.gstin,
        name: formData.name,
        address: formData.address,
        pan: formData.pan,
        contact_person_name: formData.contact_person_name || null,
        contact_no: formData.contact_no || null,
        email_id: formData.email_id || null
      };
      const response = await createVendor(vendorData);
      setIsModalOpen(false);
      setFormData({
        gstin: '',
        name: '',
        address: '',
        pan: '',
        contact_person_name: '',
        contact_no: '',
        email_id: ''
      });
      setErrors({});
      alert('Vendor created successfully!');
      navigate('/vendors');
    } catch (error) {
      setIsModalOpen(false);
      const errorMessage = error.response?.data?.error || error.message;
      if (error.response?.data?.error === 'Vendor with this GSTIN already exists') {
        setErrors((prev) => ({ ...prev, 'gstin': 'Vendor with this GSTIN already exists' }));
      } else {
        alert('Failed to create vendor: ' + errorMessage);
      }
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setFormData({
      gstin: '',
      name: '',
      address: '',
      pan: '',
      contact_person_name: '',
      contact_no: '',
      email_id: ''
    });
    setErrors({});
    navigate('/vendors');
  };

  // Handle back navigation with confirmation
  const handleBack = () => {
    setIsBackModalVisible(true);
  };

  const confirmBack = () => {
    setIsBackModalVisible(false);
    navigate('/vendors');
  };

  return (
    <div className="min-h-screen p-18 elegant-bg overflow-y-auto">
      <div className="pt-0 px-4">
        <div className="max-w-7xl mx-auto p-8">
          <div className="bg-white rounded-2xl shadow-xl p-12 transform transition-all hover:shadow-2xl fade-in outline-none focus:outline-none">
            <div className="flex justify-between items-center mb-8">
              <div className="flex flex-col justify-center">
                <h2 className="text-2xl font-semibold text-blue-800 border-l-4 border-green-600 pl-4 animate-slide-in">
                  Add New Vendor
                </h2>
                <div className="h-8" />
              </div>
              <div className="flex flex-col items-end space-y-2">
                <span className="text-sm font-medium text-gray-700 bg-gray-100 px-4 py-2 rounded-full shadow-sm">
                  {currentTime.format('MMMM DD, YYYY, hh:mm:ss A')}
                </span>
                <div className="flex space-x-4">
                  <button
                    onClick={handleBack}
                    className="text-gray-600 hover:text-blue-600 transition-all transform hover:scale-110 pulse"
                    title="Back to Vendors"
                  >
                    <ArrowLeftIcon className="h-9 w-9" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Form Container */}
            <div className="max-h-[70vh] overflow-y-auto scrollbar-custom">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* GSTIN */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    GSTIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleInputChange}
                    maxLength="15"
                    className="w-full h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:border-2 transition-all duration-200 hover:border-blue-300 shadow-sm outline-none"
                    placeholder=" Enter 15-digit GSTIN"
                  />
                  {errors.gstin && (
                    <p className="mt-1 text-sm text-red-500">{errors.gstin}</p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:border-2 transition-all duration-200 hover:border-blue-300 shadow-sm outline-none"
                    placeholder=" Enter vendor name"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full h-24 border border-gray-300 rounded-lg focus:border-blue-500 focus:border-2 transition-all duration-200 hover:border-blue-300 shadow-sm outline-none"
                    placeholder=" Enter vendor address"
                    rows="4"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-500">{errors.address}</p>
                  )}
                </div>

                {/* PAN */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    PAN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="pan"
                    value={formData.pan}
                    onChange={handleInputChange}
                    maxLength="10"
                    className="w-full h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:border-2 transition-all duration-200 hover:border-blue-300 shadow-sm outline-none"
                    placeholder=" Enter 10-digit PAN"
                  />
                  {errors.pan && <p className="mt-1 text-sm text-red-500">{errors.pan}</p>}
                </div>

                {/* Contact Person Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    name="contact_person_name"
                    value={formData.contact_person_name}
                    onChange={handleInputChange}
                    className="w-full h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:border-2 transition-all duration-200 hover:border-blue-300 shadow-sm outline-none"
                    placeholder=" Enter contact person name"
                  />
                </div>

                {/* Contact No. */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Contact No.
                  </label>
                  <input
                    type="text"
                    name="contact_no"
                    value={formData.contact_no}
                    onChange={handleInputChange}
                    className="w-full h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:border-2 transition-all duration-200 hover:border-blue-300 shadow-sm outline-none"
                    placeholder=" Enter contact number"
                  />
                  {errors.contact_no && (
                    <p className="mt-1 text-sm text-red-500">{errors.contact_no}</p>
                  )}
                </div>

                {/* Email ID */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Email ID
                  </label>
                  <input
                    type="email"
                    name="email_id"
                    value={formData.email_id}
                    onChange={handleInputChange}
                    className="w-full h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:border-2 transition-all duration-200 hover:border-blue-300 shadow-sm outline-none"
                    placeholder=" Enter email address"
                  />
                  {errors.email_id && (
                    <p className="mt-1 text-sm text-red-500">{errors.email_id}</p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 bg-gray-600 mb-10 text-white rounded-md hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 pulse shadow-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 mb-10 text-white rounded-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 pulse shadow-md"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Confirmation Modal for Save */}
        <Modal
          title="Confirm Save"
          visible={isModalOpen}
          onOk={confirmSave}
          onCancel={() => setIsModalOpen(false)}
          okText="Yes"
          cancelText="No"
          okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
          cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
        >
          <p>Are you sure you want to save these vendor details?</p>
        </Modal>

        {/* Confirmation Modal for Back Navigation */}
        <Modal
          title="Confirm Navigation"
          visible={isBackModalVisible}
          onOk={confirmBack}
          onCancel={() => setIsBackModalVisible(false)}
          okText="Yes"
          cancelText="No"
          okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
          cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
        >
          <p>Are you sure you want to go back? Any unsaved changes will be lost.</p>
        </Modal>
      </div>

      <style jsx global>{`
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: auto;
        }
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
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .min-h-screen {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
          padding-top: 60px;
        }
        .min-h-screen::-webkit-scrollbar {
          width: 10px;
        }
        .min-h-screen::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 12px;
        }
        .min-h-screen::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 12px;
          border: 2px solid #f1f1f1;
        }
        .min-h-screen::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .scrollbar-custom::-webkit-scrollbar {
          width: 10px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 12px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 12px;
          border: 2px solid #f1f1f1;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
        }
        .bg-white {
          margin: 0 auto;
          width: 100%;
          transition: transform 0.3s ease;
        }
        .bg-white:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        @keyframes slide-in {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default VendorCreation;