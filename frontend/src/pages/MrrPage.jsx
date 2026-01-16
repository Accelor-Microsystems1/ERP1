import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import moment from 'moment';

const MaterialReceiptReportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { poNumber, components } = location.state || {};
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!poNumber || !components || components.length === 0) {
      setError('PO Number or components data is missing. Please select a PO and try again.');
    }
  }, [poNumber, components]);

  const handleBackToPOList = () => {
    navigate('/purchase-orders');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Material Receipt Report</h1>

        {/* Header Section */}
        <div className="flex justify-between mb-4">
          <div>
            <p className="text-gray-700"><strong>PO NO:</strong> {poNumber || '-'}</p>
            <p className="text-gray-700"><strong>Vendor Name:</strong> -</p>
          </div>
          <div>
            <p className="text-gray-700"><strong>Sequence No:</strong> MRR10001</p>
            <p className="text-gray-700"><strong>Date:</strong> {moment().format('hh:mm A IST, dddd, MMMM DD, YYYY')}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="text-red-500 mb-4">{error}</div>}

        {/* Components Table */}
        {components && components.length > 0 ? (
          <table className="w-full border-collapse border border-gray-300 mb-6">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 p-2">S No</th>
                <th className="border border-gray-300 p-2">UOM</th>
                <th className="border border-gray-300 p-2">Ordered Qty</th>
                <th className="border border-gray-300 p-2">Delivery Date</th>
                <th className="border border-gray-300 p-2">Received MPN</th>
                <th className="border border-gray-300 p-2">Received Make</th>
                <th className="border border-gray-300 p-2">Date Code</th>
                <th className="border border-gray-300 p-2">Lot Code</th>
                <th className="border border-gray-300 p-2">Received Qty</th>
                <th className="border border-gray-300 p-2">Passed Qty</th>
                <th className="border border-gray-300 p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {components.map((component, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2">{index + 1}</td>
                  <td className="border border-gray-300 p-2">{component.uom || '-'}</td>
                  <td className="border border-gray-300 p-2">{component.updated_requested_quantity || '-'}</td>
                  <td className="border border-gray-300 p-2">{component.expected_delivery_date || '-'}</td>
                  <td className="border border-gray-300 p-2">{component.received_mpn || '-'}</td>
                  <td className="border border-gray-300 p-2">{component.received_make || '-'}</td>
                  <td className="border border-gray-300 p-2">{component.date_code || '-'}</td>
                  <td className="border border-gray-300 p-2">{component.lot_code || '-'}</td>
                  <td className="border border-gray-300 p-2">{component.received_quantity || '-'}</td>
                  <td className="border border-gray-300 p-2">{component.passed_quantity || '-'}</td>
                  <td className="border border-gray-300 p-2">
                    <span className={`px-2 py-1 rounded ${component.status === 'QC Cleared' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {component.status || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !error && <div>No components available to display.</div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleBackToPOList}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Back to PO List
          </button>
          <button
            onClick={handlePrint}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialReceiptReportPage;