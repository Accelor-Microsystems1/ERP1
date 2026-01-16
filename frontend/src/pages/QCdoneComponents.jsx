import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchQCdoneComponents } from '../utils/api';

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught in Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
          Something went wrong. Please try again later.
        </div>
      );
    }
    return this.props.children;
  }
}

const QCdoneComponents = () => {
  const [overview, setOverview] = useState([]);
  const [filteredOverview, setFilteredOverview] = useState([]);
  const [components, setComponents] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('main');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');

      if (!token) {
        setError('No authentication token found. Please log in.');
        setLoading(false);
        return;
      }

      if (!['quality_head', 'quality_employee', 'admin'].includes(role)) {
        setError('Unauthorized: Only quality team or admin can access this page.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetchQCdoneComponents();
        const { overview, components } = response.data;

        const enhancedOverview = overview.map(item => ({
          ...item,
          receiptType: item.backorder_sequence ? 'Backorder' : 'Main',
          receiptReference: item.backorder_sequence || item.po_number,
          ordered_quantity: item.backorder_sequence ? item.reordered_quantity : item.ordered_quantity,
          received_quantity: item.backorder_sequence ? item.received_quantity : item.received_quantity,
          passed_quantity: item.backorder_sequence ? item.passed_quantity : item.passed_quantity,
          failed_quantity: item.backorder_sequence ? item.failed_quantity : item.failed_quantity,
          mrr_no: item.mrr_no, // Simplified to use mrr_no directly
        }));

        setOverview(enhancedOverview);
        setFilteredOverview(enhancedOverview);
        setComponents(components);
        setFilteredComponents(components);
      } catch (err) {
        const errorMessage = err.response?.status === 401
          ? 'Session expired. Please log in again.'
          : err.response?.data?.error || err.message || 'Failed to fetch QC done components';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const applyFilters = useCallback((term, currentOverview, currentComponents, currentSelectedItem) => {
    let filteredOverviewList = [...currentOverview];
    let filteredComponentsList = [...currentComponents];

    if (term) {
      const searchTermLower = term.toLowerCase();
      filteredOverviewList = filteredOverviewList.filter((item) =>
        item.po_number?.toLowerCase().includes(searchTermLower)
      );
      filteredComponentsList = filteredComponentsList.filter((component) =>
        filteredOverviewList.some(
          (item) =>
            item.po_number === component.po_number &&
            item.backorder_sequence === component.backorder_sequence
        )
      );
    }

    filteredOverviewList.sort((a, b) => {
      const poCompare = (a.po_number || '').localeCompare(b.po_number || '');
      if (poCompare !== 0) return poCompare;
      return (a.backorder_sequence || '').localeCompare(b.backorder_sequence || '');
    });

    setFilteredOverview(filteredOverviewList);
    setFilteredComponents(filteredComponentsList);

    if (currentSelectedItem) {
      setFilteredComponents(
        currentComponents.filter(
          (component) =>
            component.po_number === currentSelectedItem.po_number &&
            component.backorder_sequence === currentSelectedItem.backorder_sequence
        )
      );
    }
  }, []);

  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const handleSearchChange = useCallback(
    debounce((term) => {
      setSearchTerm(term);
      applyFilters(term, overview, components, selectedItem);
    }, 300),
    [applyFilters, overview, components, selectedItem]
  );

  const handleInputChange = (e) => {
    handleSearchChange(e.target.value);
  };

  const handleItemClick = useCallback((item) => {
    setSelectedItem(item);
    const relatedComponents = components.filter(
      (component) =>
        component.po_number === item.po_number &&
        component.backorder_sequence === item.backorder_sequence
    );
    setFilteredComponents(relatedComponents);
  }, [components]);

  const handleBackToList = useCallback(() => {
    setSelectedItem(null);
    setFilteredComponents(components);
    applyFilters(searchTerm, overview, components, null);
  }, [applyFilters, components, overview, searchTerm]);

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date
        .toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        .replace(/\//g, '/');
    } catch {
      return '-';
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 overflow-y-auto">
        <div className="max-w-[95vw] mx-auto p-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-semibold text-gray-800 mb-6">
              QC Done Components
            </h1>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="mb-6 flex flex-wrap gap-4 items-center">
              {selectedItem && (
                <button
                  onClick={handleBackToList}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  title="Back to All Receipts"
                  aria-label="Back to All Receipts"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}
              <input
                value={searchTerm}
                onChange={handleInputChange}
                type="text"
                placeholder="Search by PO Number"
                className="p-3 border rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-80"
                aria-label="Search by PO Number"
              />
            </div>

            {!selectedItem ? (
              <div>
                <ul className="flex mb-4 border-b border-gray-200" role="tablist">
                  <li className="mr-1">
                    <button
                      className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                        activeTab === 'main'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-600 hover:text-blue-600'
                      }`}
                      onClick={() => setActiveTab('main')}
                      aria-selected={activeTab === 'main'}
                      role="tab"
                    >
                      Main Receipts
                    </button>
                  </li>
                  <li className="mr-1">
                    <button
                      className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                        activeTab === 'backorder'
                          ? 'text-purple-600 border-b-2 border-purple-600'
                          : 'text-gray-600 hover:text-purple-600'
                      }`}
                      onClick={() => setActiveTab('backorder')}
                      aria-selected={activeTab === 'backorder'}
                      role="tab"
                    >
                      Backorder Receipts
                    </button>
                  </li>
                </ul>
                <div className="tab-content">
                  <div
                    className={`tab-pane ${activeTab === 'main' ? 'block' : 'hidden'}`}
                    role="tabpanel"
                  >
                    <div className="table-container max-h-[65vh] overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
                      {loading ? (
                        <div className="animate-pulse p-6">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="h-12 bg-gray-200 rounded mb-2"></div>
                          ))}
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">PO Number</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Receipt Type</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">MRF No</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Vendor</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">MRR No</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {filteredOverview
                                .filter(item => item.receiptType === 'Main')
                                .length === 0 ? (
                                <tr>
                                  <td
                                    colSpan="6"
                                    className="px-6 py-4 text-center text-gray-500 text-lg"
                                  >
                                    No main receipts found
                                  </td>
                                </tr>
                              ) : (
                                filteredOverview
                                  .filter(item => item.receiptType === 'Main')
                                  .map((item) => (
                                    <tr
                                      key={`${item.po_number}-${item.backorder_sequence || 'po'}`}
                                      onClick={() => handleItemClick(item)}
                                      className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                                    >
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                        {item.po_number || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <span className="text-blue-600">
                                          {item.receiptType}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                        {item.mrf_no || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                        {item.vendor_name || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                        {item.mrr_no || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <span
                                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            item.status === 'QC Cleared'
                                              ? 'bg-green-100 text-gray-800'
                                              : 'bg-yellow-100 text-gray-800'
                                          }`}
                                        >
                                          {item.status || '-'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`tab-pane ${activeTab === 'backorder' ? 'block' : 'hidden'}`}
                    role="tabpanel"
                  >
                    <div className="table-container max-h-[65vh] overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
                      {loading ? (
                        <div className="animate-pulse p-6">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="h-12 bg-gray-200 rounded mb-2"></div>
                          ))}
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">PO Number</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Receipt Type</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">MRF No</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Vendor</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">MRR No</th>
                                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {filteredOverview
                                .filter(item => item.receiptType === 'Backorder')
                                .length === 0 ? (
                                <tr>
                                  <td
                                    colSpan="6"
                                    className="px-6 py-4 text-center text-gray-500 text-lg"
                                  >
                                    No backorder receipts found
                                  </td>
                                </tr>
                              ) : (
                                filteredOverview
                                  .filter(item => item.receiptType === 'Backorder')
                                  .map((item) => (
                                    <tr
                                      key={`${item.po_number}-${item.backorder_sequence || 'po'}`}
                                      onClick={() => handleItemClick(item)}
                                      className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                                    >
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                        {item.po_number || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <span className="text-purple-600">
                                          Backorder: {item.backorder_sequence}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                        {item.mrf_no || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                        {item.vendor_name || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                        {item.mrr_no || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <span
                                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            item.status === 'QC Cleared'
                                              ? 'bg-green-100 text-gray-800'
                                              : 'bg-yellow-100 text-gray-800'
                                          }`}
                                        >
                                          {item.status || '-'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4 px-6">
                  Items for PO: {selectedItem.po_number} {selectedItem.backorder_sequence ? `(Backorder: ${selectedItem.backorder_sequence})` : ''}
                </h2>
                <div className="table-container max-h-[65vh] overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
                  {loading ? (
                    <div className="animate-pulse p-6">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="h-12 bg-gray-200 rounded mb-2"></div>
                      ))}
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">MPN</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Part No</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Make</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Ordered Qty</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">UoM</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Delivery Date</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Received MPN</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Received Make</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Date Code</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Lot Code</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Received Qty</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Passed Qty</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Failed Qty</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">MRR No</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Note</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredComponents.length === 0 ? (
                            <tr>
                              <td
                                colSpan="17"
                                className="px-6 py-4 text-center text-gray-500 text-lg"
                              >
                                No components found for this PO/Backorder
                              </td>
                            </tr>
                          ) : (
                            filteredComponents.map((item) => (
                              <tr
                                key={`${item.po_number}-${item.mpn}-${item.backorder_sequence || 'po'}`}
                                className="hover:bg-gray-50 transition-colors duration-150"
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.item_description || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.mpn || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.part_no || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.make || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {(item.backorder_sequence ? item.reordered_quantity : item.updated_requested_quantity) || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.uom || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {formatDate(item.expected_delivery_date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.received_mpn || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.received_make || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.date_code || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.lot_code || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.received_quantity || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.passed_quantity || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.failed_quantity || '0'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                                      item.status === 'QC Cleared'
                                        ? 'bg-green-100 text-gray-800'
                                        : 'bg-yellow-100 text-gray-800'
                                    }`}
                                  >
                                    {item.status || '-'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.mrr_no || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.note || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <style jsx global>{`
          * {
            box-sizing: border-box;
          }
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: auto;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          }
          .min-h-screen {
            min-height: 100vh;
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            position: relative;
            overflow-y: auto;
          }
          .bg-white {
            margin: 0 auto;
            width: 100%;
            max-width: 95vw;
            overflow: visible;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          .table-container {
            position: relative;
            max-height: 65vh;
            overflow-y: auto;
            overflow-x: auto;
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          }
          .table-wrapper {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .table-container::-webkit-scrollbar,
          .table-wrapper::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .table-container::-webkit-scrollbar-track,
          .table-wrapper::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
          }
          .table-container::-webkit-scrollbar-thumb,
          .table-wrapper::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
          }
          .table-container::-webkit-scrollbar-thumb:hover,
          .table-wrapper::-webkit-scrollbar-thumb:hover {
            background: #b0b0b0;
          }
          table {
            border-collapse: collapse;
            border-spacing: 0;
            width: 100%;
            min-width: 1000px;
            table-layout: auto;
          }
          th, td {
            border-bottom: 1px solid #e5e7eb;
            padding: 12px 16px;
            font-size: 14px;
          }
          th {
            position: sticky;
            top: 0;
            background: #f9fafb;
            z-index: 10;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }
          button, input {
            transition: all 0.2s ease-in-out;
          }
          input {
            background: #ffffff;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 14px;
          }
          input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          .tab-content .tab-pane {
            transition: opacity 0.3s ease-in-out;
          }
          .tab-pane.hidden {
            opacity: 0;
            display: none;
          }
          .tab-pane.block {
            opacity: 1;
            display: block;
          }
          h1, h2 {
            font-weight: 600;
            color: #1f2937;
          }
          h1 {
            font-size: 1.75rem;
            line-height: 2.25rem;
          }
          h2 {
            font-size: 1.25rem;
            line-height: 1.75rem;
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

export default QCdoneComponents;