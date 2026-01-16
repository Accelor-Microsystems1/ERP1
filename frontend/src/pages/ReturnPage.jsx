import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { submitReturn } from '../utils/api';

const ReturnPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { components = [] } = location.state || {};
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [returnSequence, setReturnSequence] = useState(null);
  const [selectedComponents, setSelectedComponents] = useState([]);

  // Initialize components with isSelected based on failed_quantity
  useEffect(() => {
    const initializedComponents = components.map(component => ({
      ...component,
      isSelected: (parseInt(component.failed_quantity) || 0) > 0,
    }));
    setSelectedComponents(initializedComponents);
  }, [components]);

  // Handle toggle selection
  const handleToggleSelection = (index) => {
    setSelectedComponents(prev => {
      const updated = [...prev];
      const component = updated[index];
      if ((parseInt(component.failed_quantity) || 0) > 0) {
        updated[index].isSelected = !updated[index].isSelected;
      }
      return updated;
    });
  };

  const handleSubmitReturn = async () => {
    const componentsToSubmit = selectedComponents.filter(c => c.isSelected);
    if (componentsToSubmit.length === 0) {
      setError('Please select at least one component to create a return.');
      return;
    }
    try {
      setError(null);
      const response = await submitReturn(componentsToSubmit);
      setReturnSequence(response.items || response.returnSequence);
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      setError('Failed to submit return: ' + (err.response?.data?.error || err.message));
      setShowConfirmModal(false);
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setReturnSequence(null);
    navigate('/material-in');
  };

  const displayValue = (value) => {
    return value == null || value === '' ? '-' : value;
  };

  return (
    <div className="min-h-screen p-18 bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Create Return</h1>
          <button
            onClick={() => navigate('/material-in')}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors duration-200 text-sm font-medium"
          >
            Back to Material In
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md text-sm font-medium">
            {error}
          </div>
        )}

        {components.length === 0 ? (
          <div className="text-center bg-white p-8 rounded-lg shadow-sm">
            <p className="text-lg font-medium text-gray-600 mb-4">
              No components available for return.
            </p>
            <button
              onClick={() => navigate('/material-in')}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
            >
              Back to Material In
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Select
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PO Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      MPN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Failed Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedComponents.map((component, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={component.isSelected}
                          onChange={() => handleToggleSelection(index)}
                          disabled={!(parseInt(component.failed_quantity) || 0) > 0}
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {displayValue(component.po_number)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {displayValue(component.mpn)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {displayValue(component.item_description)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {displayValue(component.failed_quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 flex justify-end space-x-4 bg-gray-50">
              <button
                onClick={() => navigate('/material-in')}
                className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition-colors duration-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors duration-200 text-sm font-medium disabled:opacity-50"
                disabled={selectedComponents.filter(c => c.isSelected).length === 0}
              >
                Submit Return
              </button>
            </div>
          </div>
        )}

        {showConfirmModal && (
          <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Confirm Return</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to create a return for the selected components?
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors duration-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReturn}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors duration-200 text-sm font-medium"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {showSuccessModal && returnSequence && (
          <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Return Created Successfully
              </h2>
              <p className="text-gray-600 mb-4">
                Return submitted with the following sequences:
              </p>
              <ul className="mb-6 text-gray-600 list-disc list-inside">
                {returnSequence.map((item, index) => (
                  <li key={index}>
                    PO: {item.po_number}, MPN: {item.mpn}, Sequence: <span className="font-semibold">{item.return_sequence}</span>, Failed Qty: {item.failed_quantity}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <button
                  onClick={handleCloseSuccessModal}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ReturnPage;