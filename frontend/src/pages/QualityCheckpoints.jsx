import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import moment from 'moment';
import axios from 'axios';

const QualityCheckpoints = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    product_categories: '',
    control_per: '',
    instructions: '',
  });
  const [checkpoints, setCheckpoints] = useState([]);
  const [errors, setErrors] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBackModalVisible, setIsBackModalVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(moment());
  const [showForm, setShowForm] = useState(false); // State to toggle form visibility

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch existing checkpoints on mount
  useEffect(() => {
    fetchCheckpoints();
  }, []);

  const fetchCheckpoints = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/quality-checkpoints');
      setCheckpoints(response.data);
    } catch (error) {
      setErrors((prev) => ({ ...prev, fetch: 'Failed to fetch checkpoints' }));
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.product_categories) newErrors.product_categories = 'Product Categories is required';
    if (!formData.control_per) newErrors.control_per = 'Control Per is required';
    if (!formData.instructions) newErrors.instructions = 'Instructions are required';
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

  // Save quality check points
  const confirmSave = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/quality-checkpoints/create', formData);
      setIsModalOpen(false);
      setFormData({ title: '', product_categories: '', control_per: '', instructions: '' });
      setErrors({});
      setShowForm(false); // Hide form after successful submission
      alert(response.data.message);
      fetchCheckpoints();
      navigate('/quality-checks');
    } catch (error) {
      setIsModalOpen(false);
      const errorMessage = error.response?.data?.error || error.message;
      alert('Failed to create quality check points: ' + errorMessage);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setFormData({ title: '', product_categories: '', control_per: '', instructions: '' });
    setErrors({});
    setShowForm(false); // Hide form on cancel
  };

  // Handle back navigation
  const handleBack = () => {
    setIsBackModalVisible(true);
  };

  const confirmBack = () => {
    setIsBackModalVisible(false);
    navigate('/quality-checks');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 p-6 mt-12">
      <div className="w-full mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-3xl font-bold text-gray-800">Quality Checkpoints</h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-full shadow">
              {currentTime.format('MMMM DD, YYYY, hh:mm:ss A')}
            </span>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105 shadow"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              {showForm ? 'Hide Form' : 'Add New'}
            </button>
          </div>
        </div>

        {/* Form Section (Conditionally Rendered) */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8 animate-fade-in ">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Add New Quality Checkpoint</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Enter title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-500">{errors.title}</p>
                )}
              </div>

              {/* Product Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Categories <span className="text-red-500">*</span>
                </label>
                <select
                  name="product_categories"
                  value={formData.product_categories}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select product categories</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Consumable">Consumable</option>
                  <option value="Tool and Equipment">Tool and Equipment</option>
                  <option value="General">General</option>
                </select>
                {errors.product_categories && (
                  <p className="mt-1 text-sm text-red-500">{errors.product_categories}</p>
                )}
              </div>

              {/* Control Per */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Control Per <span className="text-red-500">*</span>
                </label>
                <select
                  name="control_per"
                  value={formData.control_per}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select Control Per</option>
                  <option value="Product">Product</option>
                  <option value="Quantity">Quantity</option>
                </select>
                {errors.control_per && (
                  <p className="mt-1 text-sm text-red-500">{errors.control_per}</p>
                )}
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instructions <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  rows="4"
                  placeholder="Enter instructions"
                />
                {errors.instructions && (
                  <p className="mt-1 text-sm text-red-500">{errors.instructions}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-transform transform hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Checkpoints Table */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {errors.fetch && (
            <p className="mb-4 text-sm text-red-500">{errors.fetch}</p>
          )}
          {checkpoints.length === 0 ? (
            <p className="text-gray-600">No checkpoints found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Categories</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Control Per</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {checkpoints.map((checkpoint) => (
                    <tr key={checkpoint.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{checkpoint.reference_no}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{checkpoint.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{checkpoint.product_categories}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{checkpoint.control_per}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{checkpoint.instructions}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {moment(checkpoint.created_at).format('MMMM DD, YYYY, hh:mm:ss A')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirmation Modal for Save */}
        <Modal
          title="Confirm Save"
          open={isModalOpen}
          onOk={confirmSave}
          onCancel={() => setIsModalOpen(false)}
          okText="Yes"
          cancelText="No"
          okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
          cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
        >
          <p>Are you sure you want to save these quality check points?</p>
        </Modal>

        {/* Confirmation Modal for Back Navigation */}
        <Modal
          title="Confirm Navigation"
          open={isBackModalVisible}
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
    </div>
  );
};

export default QualityCheckpoints;