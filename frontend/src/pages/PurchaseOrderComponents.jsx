import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPurchaseOrderComponents, updateBackorderStatus, updatePurchaseOrderStatus } from '../utils/api';
import { Modal, Tooltip } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
//import './TableStyling.css';

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
        <div className="bg-red-100 border-l-4 border-red-600 text-red-800 p-4 rounded-lg mb-6">
          Something went wrong. Please try again later.
        </div>
      );
    }
    return this.props.children;
  }
}

const PurchaseOrderComponents = () => {
  const [components, setComponents] = useState([]);
  const [pos, setPos] = useState([]);
  const [filteredPos, setFilteredPos] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingComponent, setEditingComponent] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [columnsToShow, setColumnsToShow] = useState({});
  const [backorderSequences, setBackorderSequences] = useState([]);
  const [isBackorderModalVisible, setIsBackorderModalVisible] = useState(false);
  const navigate = useNavigate();
  const tableContainerRef = useRef(null);
  const tableHeaderRef = useRef(null);
  const tableWrapperRef = useRef(null); // Added ref for table-wrapper

  // JavaScript fallback for sticky headers
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const tableHeader = tableHeaderRef.current;
    const tableWrapper = tableWrapperRef.current;

    if (!tableContainer || !tableHeader || !tableWrapper) {
      console.log('Table elements not found:', { tableContainer, tableHeader, tableWrapper });
      return;
    }

    const table = tableContainer.querySelector('table');
    if (!table) {
      console.log('Table not found inside tableContainer');
      return;
    }

    const applyStickyFallback = () => {
      console.log('Applying sticky fallback for table headers');

      // Function to set column widths
      const setColumnWidths = () => {
        const headerCells = tableHeader.querySelectorAll('th');
        const firstRow = table.querySelector('tbody tr');
        if (!firstRow) return;

        const bodyCells = firstRow.querySelectorAll('td');
        if (headerCells.length !== bodyCells.length) {
          console.warn('Header and body cell count mismatch:', headerCells.length, bodyCells.length);
          return;
        }

        headerCells.forEach((headerCell, index) => {
          const bodyCell = bodyCells[index];
          const bodyCellWidth = bodyCell.getBoundingClientRect().width;
          headerCell.style.width = `${bodyCellWidth}px`;
          headerCell.style.minWidth = `${bodyCellWidth}px`;
          headerCell.style.maxWidth = `${bodyCellWidth}px`;
          console.log(`Set width for column ${index}: ${bodyCellWidth}px`);
        });
      };

      const handleScroll = () => {
        const containerRect = tableContainer.getBoundingClientRect();
        const scrollTop = tableContainer.scrollTop;
        const scrollLeft = tableWrapper.scrollLeft;

        // Use scrollWidth to get the full content width of the table
        const tableWidth = table.scrollWidth;

        console.log('Scroll event triggered:', {
          containerTop: containerRect.top,
          scrollTop: scrollTop,
          scrollLeft: scrollLeft,
          tableWidth: tableWidth,
        });

        if (scrollTop > 0) {
          tableHeader.style.position = 'fixed';
          tableHeader.style.top = `${containerRect.top}px`;
          tableHeader.style.left = `${containerRect.left - scrollLeft}px`; // Adjust for horizontal scroll
          tableHeader.style.width = `${tableWidth}px`;
          tableHeader.style.zIndex = '10';
          tableHeader.style.background = '#f9fafb';
          tableHeader.style.boxShadow = '0 1px 0 0 #e2e8f0';
          tableHeader.style.borderBottom = '2px solid #d2d6dc';

          // Set column widths when header becomes fixed
          setColumnWidths();
        } else {
          tableHeader.style.position = 'relative';
          tableHeader.style.top = 'auto';
          tableHeader.style.left = 'auto';
          tableHeader.style.width = 'auto';
          tableHeader.style.boxShadow = 'none';

          // Reset column widths when returning to normal flow
          const headerCells = tableHeader.querySelectorAll('th');
          headerCells.forEach((cell) => {
            cell.style.width = 'auto';
            cell.style.minWidth = 'auto';
            cell.style.maxWidth = 'auto';
          });
        }
      };

      // Attach scroll listeners
      tableContainer.addEventListener('scroll', handleScroll);
      tableWrapper.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);

      // Initial call to set position
      handleScroll();

      return () => {
        tableContainer.removeEventListener('scroll', handleScroll);
        tableWrapper.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    };

    applyStickyFallback();
  }, [selectedPo]); // Re-run when selectedPo changes

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');

      if (!token) {
        setError('No authentication token found. Please log in.');
        setLoading(false);
        return;
      }

      if (!['inventory_head', 'inventory_employee', 'admin', 'purchase_head'].includes(role)) {
        setError('Unauthorized: Only inventory team, purchase head, or admin can access this page.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const fetchedComponents = await fetchPurchaseOrderComponents();

        if (!Array.isArray(fetchedComponents)) {
          throw new Error('Expected an array of purchase order components, but received an invalid format.');
        }

        console.log("Received components:", fetchedComponents);

        const filteredComponentsData = fetchedComponents.filter(
          (item) => item.status !== 'Material Delivered & Quality Check Pending'
        );

        filteredComponentsData.forEach((item, index) => {
          console.log(`Component ${index} created_at:`, item.created_at);
        });

        if (filteredComponentsData.length === 0) {
          setError('No purchase order components found with status "Material Delivery Pending" or related statuses.');
        }

        const poMap = new Map();
        const backorderSeqList = [];

        filteredComponentsData.forEach((item) => {
          const key = item.po_number;
          if (!poMap.has(key)) {
            poMap.set(key, {
              po_number: item.po_number,
              mrf_no: item.mrf_no || '-',
              vendor_name: item.vendor_name || '-',
              created_at: item.created_at || '-',
              status: item.status || 'Material Delivery Pending',
            });
          }

          if (item.backorder_sequence && item.backorder_sequence !== 'N/A') {
            backorderSeqList.push({
              po_number: item.po_number,
              backorder_sequence: item.backorder_sequence,
            });
            console.log(`Collected backorder_sequence ${item.backorder_sequence} for PO ${item.po_number}`);
          }
        });

        const poList = Array.from(poMap.values()).sort((a, b) => {
          const poA = a.po_number || '';
          const poB = b.po_number || '';
          return poB.localeCompare(poA);
        });

        const componentMap = new Map();
        filteredComponentsData.forEach((item) => {
          const key = `${item.po_number}-${item.mpn}`;
          if (!componentMap.has(key)) {
            componentMap.set(key, item);
          }
        });
        const uniqueComponents = Array.from(componentMap.values());

        console.log("PO List with created_at:", poList);

        const columns = {
          backorder_sequence: uniqueComponents.some(item => item.backorder_sequence && item.backorder_sequence !== 'N/A' && item.status.includes('material delivery pending')),
          backorder_pending_quantity: uniqueComponents.some(item => item.backorder_pending_quantity && item.backorder_pending_quantity !== 0),
          return_sequence: uniqueComponents.some(item => item.return_sequence && item.return_sequence !== 'N/A'),
          return_reordered_quantity: uniqueComponents.some(item => item.return_reordered_quantity && item.return_reordered_quantity !== 0),
        };

        setColumnsToShow(columns);
        setPos(poList);
        setFilteredPos(poList);
        setComponents(uniqueComponents);
        setFilteredComponents(uniqueComponents);
        setBackorderSequences(backorderSeqList);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to fetch purchase order components');
        setLoading(false);
        setPos([]);
        setFilteredPos([]);
        setComponents([]);
        setFilteredComponents([]);
        setBackorderSequences([]);
      }
    };
    fetchData();
  }, []);

  const applyFilters = (term) => {
    let filteredPoList = [...pos];
    let filteredComponentsList = [...components];
    let filteredBackorderSeqList = [...backorderSequences];

    if (term) {
      const searchTermLower = term.toLowerCase();
      filteredPoList = filteredPoList.filter((po) =>
        po.po_number.toLowerCase().includes(searchTermLower)
      );
      filteredComponentsList = filteredComponentsList.filter((component) =>
        filteredPoList.some((po) => po.po_number === component.po_number)
      );
      filteredBackorderSeqList = filteredBackorderSeqList.filter((seq) =>
        filteredPoList.some((po) => po.po_number === seq.po_number)
      );
    }

    setFilteredPos(filteredPoList);
    setFilteredComponents(filteredComponentsList);
    setBackorderSequences(filteredBackorderSeqList);

    if (selectedPo) {
      setFilteredComponents(
        filteredComponentsList.filter((component) => component.po_number === selectedPo.po_number)
      );
    }
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    applyFilters(term);
  };

  const handlePoClick = (po) => {
    setSelectedPo(po);
    const relatedComponents = components.filter(
      (component) => component.po_number === po.po_number
    );
    setFilteredComponents(relatedComponents);
  };

  const handleBackToPoList = () => {
    setSelectedPo(null);
    setFilteredComponents(components);
    applyFilters(searchTerm);
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A' || dateString === '-') return '-';

    if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      console.warn(`Invalid date format for ${dateString}, expected YYYY-MM-DD`);
      return '-';
    }

    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day || year.length !== 4 || month.length !== 2 || day.length !== 2) {
      console.warn(`Invalid date components in ${dateString}`);
      return '-';
    }

    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date: ${dateString}`);
      return '-';
    }

    console.log(`Formatting date ${dateString} to ${day}/${month}/${year}`);
    return `${day}/${month}/${year}`;
  };

  const handleStatusUpdate = async (component) => {
    try {
      let updatedComponents;
      if (component.status === 'Material Delivery Pending') {
        await updatePurchaseOrderStatus({
          po_number: component.po_number,
          mpn: component.mpn,
          status: newStatus,
        });
        updatedComponents = components.map((item) =>
          item.po_number === component.po_number && item.mpn === component.mpn
            ? { ...item, status: newStatus }
            : item
        );
      } else if (component.status.includes('material delivery pending')) {
        await updateBackorderStatus({
          po_number: component.po_number,
          mpn: component.mpn,
          backorder_sequence: component.backorder_sequence,
          status: newStatus,
        });
        updatedComponents = components.map((item) =>
          item.po_number === component.po_number && item.mpn === component.mpn
            ? { ...item, status: newStatus }
            : item
        );
      } else {
        throw new Error('Invalid status for update');
      }

      setComponents(updatedComponents);
      setFilteredComponents(
        updatedComponents.filter((item) => item.po_number === selectedPo.po_number)
      );

      setEditingComponent(null);
      setNewStatus('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update status');
    }
  };

  const showConfirmModal = (component) => {
    setEditingComponent(component);
    setIsModalVisible(true);
  };

  const confirmStatusUpdate = (component) => {
    handleStatusUpdate(component);
    setIsModalVisible(false);
  };

  const handleEditClick = (component) => {
    setEditingComponent(component);
    setNewStatus(component.status || 'Material Delivery Pending');
  };

  const handleCancelEdit = () => {
    setEditingComponent(null);
    setNewStatus('');
  };

  const handlePastPOReviewClick = () => {
    navigate('/past-po-review');
  };

  const handleShowBackorderModal = () => {
    setIsBackorderModalVisible(true);
  };

  const thStyle = {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: '#f9fafb',
    boxShadow: '0 1px 0 0 #e2e8f0',
    borderBottom: '2px solid #d2d6dc',
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-12 lg:px-8">
          <div className="bg-white shadow-xl rounded-xl p-8">
            <h1 className="text-2xl font-bold text-gray-900 border-l-4 border-indigo-600 pl-4 mb-6">
              Purchase Order Components (Material Delivery Pending)
            </h1>

            {error && (
              <div className="bg-red-100 border-l-4 border-red-600 text-red-800 p-4 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="mb-6 flex flex-wrap gap-4 items-center">
              <input
                value={searchTerm}
                onChange={handleSearchChange}
                type="text"
                placeholder="Search by PO Number"
                className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-80 transition-all duration-200"
              />
              {selectedPo && (
                <button
                  onClick={handleBackToPoList}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-sm"
                >
                  Back to PO List
                </button>
              )}
              <button
                onClick={handlePastPOReviewClick}
                className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-sm"
              >
                Past PO Review
              </button>
              {!selectedPo && backorderSequences.length > 0 && (
                <Tooltip title="View Backordered POs">
                  <button
                    onClick={handleShowBackorderModal}
                    className="bg-yellow-500 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 transition-colors duration-200 shadow-sm"
                  >
                    <WarningOutlined />
                  </button>
                </Tooltip>
              )}
            </div>

            <div className="relative table-container max-h-[65vh] overflow-y-auto border border-gray-200 rounded-lg shadow-sm" ref={tableContainerRef}>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-20 loading-overlay">
                  <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
              {selectedPo ? (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 px-6 pt-4">
                    Components for PO: {selectedPo.po_number}
                  </h2>
                  <div className="table-wrapper" ref={tableWrapperRef}>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50" ref={tableHeaderRef}>
                        <tr>
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                            MPN
                          </th>
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Description
                          </th>
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Part No
                          </th>
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Make
                          </th>
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 tracking-wider">
                            UoM
                          </th>
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Ordered Qty
                          </th>
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Delivery Date
                          </th>
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Status
                          </th>
                          {columnsToShow.backorder_sequence && (
                            <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Backorder Seq
                            </th>
                          )}
                          {columnsToShow.backorder_pending_quantity && (
                            <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Backorder Qty
                            </th>
                          )}
                          {columnsToShow.return_sequence && (
                            <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Return Seq
                            </th>
                          )}
                          {columnsToShow.return_reordered_quantity && (
                            <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Return Qty
                            </th>
                          )}
                          <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredComponents.length === 0 && !loading ? (
                          <tr>
                            <td
                              colSpan={
                                8 +
                                (columnsToShow.backorder_sequence ? 1 : 0) +
                                (columnsToShow.backorder_pending_quantity ? 1 : 0) +
                                (columnsToShow.return_sequence ? 1 : 0) +
                                (columnsToShow.return_reordered_quantity ? 1 : 0)
                              }
                              className="px-6 py-4 text-center text-gray-500 text-sm"
                            >
                              No components found for this PO
                            </td>
                          </tr>
                        ) : (
                          filteredComponents.map((item) => (
                            <tr
                              key={`${item.po_number}-${item.mpn}`}
                              className="hover:bg-indigo-50 transition-colors duration-200"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {item.mpn || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {item.item_description || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {item.part_no || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {item.make || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {item.uom || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {item.updated_requested_quantity || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {formatDate(item.expected_delivery_date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                <Tooltip title={item.status}>
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                                      item.status.includes('Backorder')
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {item.status || '-'}
                                  </span>
                                </Tooltip>
                              </td>
                              {columnsToShow.backorder_sequence && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.backorder_sequence && item.status.includes('material delivery pending') ? item.backorder_sequence : '-'}
                                </td>
                              )}
                              {columnsToShow.backorder_pending_quantity && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.backorder_pending_quantity || '-'}
                                </td>
                              )}
                              {columnsToShow.return_sequence && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.return_sequence || '-'}
                                </td>
                              )}
                              {columnsToShow.return_reordered_quantity && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.return_reordered_quantity || '-'}
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {editingComponent && editingComponent.po_number === item.po_number && editingComponent.mpn === item.mpn ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <select
                                      value={newStatus}
                                      onChange={(e) => setNewStatus(e.target.value)}
                                      className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-600"
                                    >
                                      <option value="Material Delivery Pending">Material Delivery Pending</option>
                                      <option value="Material Delivered & Quality Check Pending">
                                        Material Delivered & Quality Check Pending
                                      </option>
                                    </select>
                                    <Tooltip title="Save Changes">
                                      <button
                                        onClick={() => showConfirmModal(item)}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 shadow-sm"
                                      >
                                        Save
                                      </button>
                                    </Tooltip>
                                    <Tooltip title="Cancel Editing">
                                      <button
                                        onClick={handleCancelEdit}
                                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors duration-200 shadow-sm"
                                      >
                                        Cancel
                                      </button>
                                    </Tooltip>
                                  </div>
                                ) : (
                                  <Tooltip title="Edit Status">
                                    <button
                                      onClick={() => handleEditClick(item)}
                                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition-colors duration-200"
                                    >
                                      Edit
                                    </button>
                                  </Tooltip>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="table-wrapper" ref={tableWrapperRef}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50" ref={tableHeaderRef}>
                      <tr>
                        <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                          PO Number
                        </th>
                        <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                          MRF No
                        </th>
                        <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Vendor
                        </th>
                        <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Created At
                        </th>
                        <th style={thStyle} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPos.length === 0 && !loading ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-6 py-4 text-center text-gray-500 text-sm"
                          >
                            No purchase orders found
                          </td>
                        </tr>
                      ) : (
                        filteredPos.map((po) => (
                          <tr
                            key={po.po_number}
                            onClick={() => handlePoClick(po)}
                            className="hover:bg-indigo-50 transition-colors duration-200 cursor-pointer"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {po.po_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {po.mrf_no}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {po.vendor_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {formatDate(po.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              <Tooltip title={po.status}>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    po.status.includes('Backorder')
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {po.status}
                                </span>
                              </Tooltip>
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

        <Modal
          title="Confirm Status Update"
          open={isModalVisible}
          onOk={() => confirmStatusUpdate(editingComponent)}
          onCancel={() => setIsModalVisible(false)}
          okText="Yes"
          cancelText="No"
          okButtonProps={{
            className: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg',
          }}
          cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
        >
          <p className="text-gray-700">Are you sure you want to update the status to "{newStatus}"?</p>
        </Modal>

        <Modal
          title="Backordered Purchase Orders"
          open={isBackorderModalVisible}
          onCancel={() => setIsBackorderModalVisible(false)}
          footer={[
            <button
              key="close"
              onClick={() => setIsBackorderModalVisible(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-2 transition-colors duration-200 shadow-sm"
            >
              Close
            </button>,
          ]}
        >
          <div className="max-h-[50vh] overflow-y-auto">
            {[...new Set(backorderSequences.map(seq => seq.po_number))].map((poNumber) => {
              const sequences = backorderSequences
                .filter(seq => seq.po_number === poNumber)
                .map(seq => seq.backorder_sequence);
              return (
                <div key={poNumber} className="mb-4 border-b border-gray-200 pb-2">
                  <p className="text-gray-900 font-medium">PO: {poNumber}</p>
                  <p className="text-gray-700">Backorder Sequences: {[...new Set(sequences)].join(', ')}</p>
                </div>
              );
            })}
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default PurchaseOrderComponents;