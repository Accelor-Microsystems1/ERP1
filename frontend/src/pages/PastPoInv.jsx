import React, { useState, useEffect, useRef } from 'react';
import { fetchPurchaseOrders } from '../utils/api';
import { Modal } from 'antd';

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

const PastPOReview = () => {
  const [pos, setPos] = useState([]);
  const [filteredPos, setFilteredPos] = useState([]);
  const [components, setComponents] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [columnsToShow, setColumnsToShow] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [receiptRows, setReceiptRows] = useState([]);
  const [compactReceipts, setCompactReceipts] = useState([]);
  const [initialState, setInitialState] = useState({}); // To store initial state for reset

// Add refs at the top of the PastPOReview component
const tableContainerRef = useRef(null);
const tableHeaderRef = useRef(null);
const tableWrapperRef = useRef(null);

// Add useEffect for the JavaScript fallback
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
        tableHeader.style.left = `${containerRect.left - scrollLeft}px`;
        tableHeader.style.width = `${tableWidth}px`;
        tableHeader.style.zIndex = '10';
        tableHeader.style.background = '#f9fafb';
        tableHeader.style.boxShadow = '0 2px 2px -1px rgba(0, 0, 0, 0.1)';
         tableHeader.style.borderBottom = '2px solid #d2d6dc';

        setColumnWidths();
      } else {
        tableHeader.style.position = 'relative';
        tableHeader.style.top = 'auto';
        tableHeader.style.left = 'auto';
        tableHeader.style.width = 'auto';
        tableHeader.style.boxShadow = 'none';

        const headerCells = tableHeader.querySelectorAll('th');
        headerCells.forEach((cell) => {
          cell.style.width = 'auto';
          cell.style.minWidth = 'auto';
          cell.style.maxWidth = 'auto';
        });
      }
    };

    tableContainer.addEventListener('scroll', handleScroll);
    tableWrapper.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    handleScroll();

    return () => {
      tableContainer.removeEventListener('scroll', handleScroll);
      tableWrapper.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  };

  applyStickyFallback();
}, [selectedPo, selectedReceipt]);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');

      if (!token) {
        setError('No authentication token found. Please log in.');
        setLoading(false);
        return;
      }

      if (!['inventory_head', 'inventory_employee', 'admin', 'purchase_head', 'quality_head', 'quality_employee'].includes(role)) {
        setError('Unauthorized: Only inventory team, purchase head, quality team, or admin can access this page.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const fetchedPos = await fetchPurchaseOrders();
        console.log('Raw fetchedPos data:', fetchedPos);

        if (!Array.isArray(fetchedPos)) {
          throw new Error('Expected an array of purchase orders, but received an invalid format.');
        }

        if (fetchedPos.length === 0) {
          setError('No purchase orders found.');
        }

        const poMap = new Map();
        const receiptMap = new Map();
        const enhancedComponents = [];

        fetchedPos.forEach((item) => {
          const key = item.po_number;

          // Main receipt component
          enhancedComponents.push({
            ...item,
            receiptType: 'Main',
            receiptReference: item.po_number,
            backorder_sequence: null,
            backorder_pending_quantity: null,
            received_quantity: item.received_quantity || 0,
            material_in_quantity: item.material_in_quantity || 0,
            created_at: item.created_at || null,
          });

          // Backorder components
          if (Array.isArray(item.backorder_sequences) && item.backorder_sequences.length > 0) {
            item.backorder_sequences.forEach((backorder) => {
              enhancedComponents.push({
                ...item,
                receiptType: 'Backorder',
                receiptReference: backorder.backorder_sequence,
                backorder_sequence: backorder.backorder_sequence,
                backorder_pending_quantity: backorder.reordered_quantity || 0,
                updated_requested_quantity: backorder.reordered_quantity || 0,
                received_quantity: backorder.received_quantity || 0,
                material_in_quantity: backorder.material_in_quantity || 0,
                status: backorder.status || item.status || 'Unknown',
                return_sequence: null,
                return_reordered_quantity: null,
                created_at: backorder.created_at || null, // Use backorder-specific created_at
              });
            });
          }

          // Return components
          if (item.return_sequence) {
            enhancedComponents.push({
              ...item,
              receiptType: 'Return',
              receiptReference: item.return_sequence,
              backorder_sequence: null,
              backorder_pending_quantity: null,
              received_quantity: item.received_quantity || 0,
              material_in_quantity: item.material_in_quantity || 0,
              created_at: null,
            });
          }

          if (!poMap.has(key)) {
            // Calculate QC status for each receipt type
            const receiptsList = [];
            const mainComponents = enhancedComponents.filter(
              (comp) => comp.po_number === key && comp.receiptType === 'Main'
            );
            const hasPendingMainQC = mainComponents.some(
              (comp) => comp.status === 'Material Delivered & Quality Check Pending'
            );
            const mainStatus = hasPendingMainQC ? 'Pending' : 'Done';

            receiptsList.push({
              type: 'Main',
              reference: item.po_number,
              status: mainStatus,
              created_at: item.created_at || null,
            });

            if (Array.isArray(item.backorder_sequences) && item.backorder_sequences.length > 0) {
              item.backorder_sequences.forEach((backorder) => {
                const backorderComponents = enhancedComponents.filter(
                  (comp) =>
                    comp.po_number === key &&
                    comp.receiptType === 'Backorder' &&
                    comp.receiptReference === backorder.backorder_sequence
                );
                const hasPendingBackorderQC = backorderComponents.some(
                  (comp) => comp.status === 'Material Delivered & Quality Check Pending'
                );
                const backorderStatus = hasPendingBackorderQC ? 'Pending' : 'Done';

                receiptsList.push({
                  type: 'Backorder',
                  reference: backorder.backorder_sequence,
                  status: backorderStatus,
                  created_at: backorder.created_at || null,
                });
              });
            }

            if (item.return_sequence) {
              const returnComponents = enhancedComponents.filter(
                (comp) =>
                  comp.po_number === key &&
                  comp.receiptType === 'Return' &&
                  comp.receiptReference === item.return_sequence
              );
              const hasPendingReturnQC = returnComponents.some(
                (comp) => comp.status === 'Material Delivered & Quality Check Pending'
              );
              const returnStatus = hasPendingReturnQC ? 'Pending' : 'Done';

              receiptsList.push({
                type: 'Return',
                reference: item.return_sequence,
                status: returnStatus,
                created_at: null,
              });
            }

            receiptsList.sort((a, b) => {
              if (a.type === 'Main') return -1;
              if (b.type === 'Main') return 1;
              if (a.type === 'Backorder' && b.type === 'Return') return -1;
              if (a.type === 'Return' && b.type === 'Backorder') return 1;
              return a.reference.localeCompare(b.reference);
            });

            // Overall PO status based on all receipts
            const overallStatus = receiptsList.some((receipt) => receipt.status === 'Pending')
              ? 'Pending'
              : 'Done';

            poMap.set(key, {
              po_number: item.po_number,
              mrf_no: item.mrf_no || '-',
              vendor_name: item.vendor_name || '-',
              status: overallStatus,
              created_at: item.created_at || null,
            });

            receiptMap.set(key, receiptsList);
          }
        });

        const poList = Array.from(poMap.values()).sort((a, b) => {
          const poA = a.po_number || '';
          const poB = b.po_number || '';
          return poB.localeCompare(poA);
        });

        const columns = {
          note: fetchedPos.some(item => item.status === 'QC Rejected' || item.status === 'QC Hold'),
          backorder: fetchedPos.some(item => item.backorder_sequence || item.backorder_sequences?.length > 0),
          return: fetchedPos.some(item => item.return_sequence),
        };

        const receiptRowsData = [];
        poList.forEach((po) => {
          const receipts = receiptMap.get(po.po_number) || [];
          receipts.sort((a, b) => (a.type === 'Main' ? -1 : b.type === 'Main' ? 1 : a.reference.localeCompare(b.reference)));
          receipts.forEach((receipt) => {
            // Use the created_at directly from the receipt object
            const createdAt = receipt.created_at;
            console.log(`Receipt for PO ${po.po_number} - Type: ${receipt.type}, Reference: ${receipt.reference}, created_at: ${createdAt}, formatted: ${formatDate(createdAt)}`);

            receiptRowsData.push({
              po_number: po.po_number,
              mrf_no: po.mrf_no,
              vendor_name: po.vendor_name,
              status: receipt.status,
              receipt_type: receipt.type,
              receipt_reference: receipt.reference,
              created_at: createdAt,
            });
          });
        });

        const compactReceiptsData = poList.map((po) => {
          const receipts = receiptMap.get(po.po_number) || [];
          const sortedReceipts = receipts.sort((a, b) => {
            if (a.type === 'Main') return -1;
            if (b.type === 'Main') return 1;
            if (a.type === 'Backorder' && b.type === 'Return') return -1;
            if (a.type === 'Return' && b.type === 'Backorder') return 1;
            return a.reference.localeCompare(b.reference);
          });
          return {
            po_number: po.po_number,
            mrf_no: po.mrf_no,
            vendor_name: po.vendor_name,
            status: po.status,
            receipts: sortedReceipts,
            created_at: po.created_at,
          };
        });

        setPos(poList);
        setFilteredPos(poList);
        setComponents(enhancedComponents);
        setFilteredComponents(enhancedComponents);
        setColumnsToShow(columns);
        setReceiptRows(receiptRowsData);
        setCompactReceipts(compactReceiptsData);

        // Store initial state for reset
        setInitialState({
          filteredPos: poList,
          filteredComponents: enhancedComponents,
          receiptRows: receiptRowsData,
          compactReceipts: compactReceiptsData,
          columnsToShow: columns,
        });

        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to fetch purchase orders');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const applyFilters = (term) => {
    let filteredPoList = [...pos];
    let filteredComponentsList = [...components];
    let filteredReceiptRows = [...receiptRows];
    let filteredCompactReceipts = [...compactReceipts];

    if (term) {
      const searchTermLower = term.toLowerCase();
      filteredPoList = filteredPoList.filter((po) =>
        po.po_number.toLowerCase().includes(searchTermLower)
      );
      filteredComponentsList = filteredComponentsList.filter((component) =>
        filteredPoList.some((po) => po.po_number === component.po_number)
      );
      filteredReceiptRows = filteredReceiptRows.filter((row) =>
        row.po_number.toLowerCase().includes(searchTermLower)
      );
      filteredCompactReceipts = filteredCompactReceipts.filter((row) =>
        row.po_number.toLowerCase().includes(searchTermLower)
      );
    }

    setFilteredPos(filteredPoList);
    setFilteredComponents(filteredComponentsList);
    setReceiptRows(filteredReceiptRows);
    setCompactReceipts(filteredCompactReceipts);

    if (selectedPo) {
      let relatedComponents = filteredComponentsList.filter(
        (component) => component.po_number === selectedPo.po_number
      );

      if (selectedReceipt && selectedReceipt.type !== 'Main') {
        relatedComponents = relatedComponents.filter(
          (component) =>
            component.receiptType === selectedReceipt.type &&
            component.receiptReference === selectedReceipt.reference
        );
      }

      setFilteredComponents(relatedComponents);

      const columns = {
        note: relatedComponents.some(item => item.status === 'QC Rejected' || item.status === 'QC Hold'),
        backorder: relatedComponents.some(item => item.backorder_sequence || item.backorder_sequences?.length > 0),
        return: relatedComponents.some(item => item.return_sequence),
      };
      setColumnsToShow(columns);
    }
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    applyFilters(term);
  };

  const handlePoClick = (po, receipt) => {
    setSelectedPo(po);
    setSelectedReceipt(receipt);

    let relatedComponents = components.filter(
      (component) => component.po_number === po.po_number && component.receiptType === 'Main'
    );

    if (receipt.type !== 'Main') {
      relatedComponents = components.filter(
        (component) =>
          component.po_number === po.po_number &&
          component.receiptType === receipt.type &&
          component.receiptReference === receipt.reference
      );
    }

    setFilteredComponents(relatedComponents);

    const columns = {
      note: relatedComponents.some(item => item.status === 'QC Rejected' || item.status === 'QC Hold'),
      backorder: components.some(item => item.po_number === po.po_number && (item.backorder_sequence || item.backorder_sequences?.length > 0)),
      return: components.some(item => item.po_number === po.po_number && item.return_sequence),
    };
    setColumnsToShow(columns);
  };

  const handleBackToPoList = () => {
    setSelectedPo(null);
    setSelectedReceipt(null);
    setSearchTerm('');
    setFilteredPos(initialState.filteredPos);
    setFilteredComponents(initialState.filteredComponents);
    setReceiptRows(initialState.receiptRows);
    setCompactReceipts(initialState.compactReceipts);
    setColumnsToShow(initialState.columnsToShow);
  };

  const handleBackToPastPOs = () => {
    setSearchTerm('');
    setSelectedReceipt(null);
    applyFilters('');
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).replace(/\//g, '/');
  };

  const handleViewDetails = (item, type) => {
    let backorderStatus = item.status;
    let backorderReceivedQuantity = item.backorder_pending_quantity;
    if (type === 'backorder') {
      const backorder = item.backorder_sequences.find(
        (bo) => bo.backorder_sequence === item.backorder_sequence
      );
      if (backorder) {
        backorderStatus = backorder.status || item.status || 'Unknown';
        backorderReceivedQuantity = backorder.received_quantity || 0;
      }
    }

    const content = (
      <div>
        <h3 className="text-lg font-semibold mb-4">{type === 'backorder' ? 'Backorder Details' : 'Return Details'}</h3>
        <p><strong>PO Number:</strong> {item.po_number}</p>
        <p><strong>MPN:</strong> {item.mpn || '-'}</p>
        <p><strong>{type === 'backorder' ? 'Backorder No.' : 'Return Order No.'}:</strong> {type === 'backorder' ? item.backorder_sequence : item.return_sequence}</p>
        <p><strong>{type === 'backorder' ? 'Received Quantity' : 'Reordered Quantity'}:</strong> {type === 'backorder' ? backorderReceivedQuantity || '-' : item.return_reordered_quantity || '0'}</p>
        <p><strong>Status:</strong> {type === 'backorder' ? backorderStatus : item.status || '-'}</p>
      </div>
    );
    setModalContent(content);
    setModalVisible(true);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-[95vw] mx-auto p-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-semibold text-gray-800 mb-6">
              Past Purchase Order Review
            </h1>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="mb-6 flex flex-wrap gap-4 items-center">
              {selectedPo && (
                <button
                  onClick={handleBackToPoList}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  title="Back to All Receipts"
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
                onChange={handleSearchChange}
                type="text"
                placeholder="Search by PO Number"
                className="p-3 border rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-80"
              />
              <button
              onClick={() => window.location.href = '/purchase-order-components'}
              className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Live Receipts
            </button>
              {/* {selectedPo && (
                <button
                  onClick={handleBackToPastPOs}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-800 transition-colors"
                >
                  Back to PO List
                </button>
              )} */}
            </div>
            {selectedPo && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Receipts for PO: {selectedPo.po_number} {selectedReceipt && selectedReceipt.type !== 'Main' ? `(${selectedReceipt.type}: ${selectedReceipt.reference})` : ''}
                </h3>
                <div className="flex flex-col gap-1">
                  {receiptRows
                    .filter((row) => row.po_number === selectedPo.po_number && row.receipt_type === 'Main')
                    .map((row, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900"
                      >
                        {row.receipt_type} Receipt: {row.receipt_reference}
                      </div>
                    ))}
                  {receiptRows.some((row) => row.po_number === selectedPo.po_number && row.receipt_type === 'Backorder') && (
                    <div className="text-sm text-purple-600 mt-2">
                      Backorder Receipts:
                      {receiptRows
                        .filter((row) => row.po_number === selectedPo.po_number && row.receipt_type === 'Backorder')
                        .map((row, index) => (
                          <div
                            key={index}
                            className="ml-4 cursor-pointer hover:underline"
                            onClick={() =>
                              handlePoClick(
                                {
                                  po_number: row.po_number,
                                  mrf_no: row.mrf_no,
                                  vendor_name: row.vendor_name,
                                  status: row.status,
                                },
                                { type: row.receipt_type, reference: row.receipt_reference }
                              )
                            }
                          >
                            {row.receipt_reference}
                          </div>
                        ))}
                    </div>
                  )}
                  {receiptRows.some((row) => row.po_number === selectedPo.po_number && row.receipt_type === 'Return') && (
                    <div className="text-sm text-red-600 mt-2">
                      Return Receipts:
                      {receiptRows
                        .filter((row) => row.po_number === selectedPo.po_number && row.recept_type === 'Return')
                        .map((row, index) => (
                          <div
                            key={index}
                            className="ml-4 cursor-pointer hover:underline"
                            onClick={() =>
                              handlePoClick(
                                {
                                  po_number: row.po_number,
                                  mrf_no: row.mrf_no,
                                  vendor_name: row.vendor_name,
                                  status: row.status,
                                },
                                { type: row.receipt_type, reference: row.receipt_reference }
                              )
                            }
                          >
                            {row.receipt_reference}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
           <div className="relative table-container max-h-[65vh] overflow-y-auto border border-gray-200 rounded-lg shadow-sm" ref={tableContainerRef}>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-30">
                  <svg className="animate-spin h-10 w-10 text-blue-800" viewBox="0 0 24 24">
                    <circle className="opacity-50" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
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
                  <h2 className="text-xl font-semibold text-gray-700 mb-4">
                    Items for PO: {selectedPo.po_number}
                  </h2>
                  <div className="table-wrapper" ref={tableWrapperRef}>
                    <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-50" ref={tableHeaderRef}>
                        <tr>
                          <th className="px-6 py-3 text-center text-sm font-medium text-gray-700 uppercase tracking-wider">MPN</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Part No</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Make</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 tracking-wider">UoM</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Ordered Quantity</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Received Quantity</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Material In Quantity</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Status</th>
                          {columnsToShow.backorder && selectedReceipt?.type === 'Backorder' && (
                            <>
                              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Backorder No.</th>
                            </>
                          )}
                          {columnsToShow.return && selectedReceipt?.type === 'Return' && (
                            <>
                              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Return Order No.</th>
                              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Reordered Quantity</th>
                            </>
                          )}
                          {columnsToShow.note && (
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Note</th>
                          )}
                          {columnsToShow.backorder && (
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Backorder Details</th>
                          )}
                          {columnsToShow.return && (
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Return Details</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredComponents.length === 0 && !loading ? (
                          <tr>
                            <td
                              colSpan={
                                9 +
                                (columnsToShow.note ? 1 : 0) +
                                (columnsToShow.backorder && selectedReceipt?.type === 'Backorder' ? 1 : columnsToShow.backorder ? 1 : 0) +
                                (columnsToShow.return && selectedReceipt?.type === 'Return' ? 2 : columnsToShow.return ? 1 : 0)
                              }
                              className="px-6 py-4 text-center text-gray-500 text-lg"
                            >
                              No components found for this {selectedReceipt?.type || 'PO'}
                            </td>
                          </tr>
                        ) : (
                          filteredComponents.map((item, index) => (
                            <tr key={`${item.po_number}-${item.mpn || 'no-mpn'}-${index}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.mpn || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.item_description || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.part_no || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.make || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.uom || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.updated_requested_quantity || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.received_quantity || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.material_in_quantity !== null ? item.material_in_quantity : '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    item.status === 'QC Cleared' ? 'bg-green-100 text-green-800' :
                                    item.status === 'QC Rejected' ? 'bg-red-100 text-red-800' :
                                    item.status === 'QC Hold' ? 'bg-yellow-100 text-purple-500' :
                                    item.status === 'Returned' ? 'bg-orange-100 text-orange-800' :
                                    item.status === 'Backordered' ? 'bg-purple-100 text-purple-800' :
                                    item.status === 'Returned and Backordered' ? 'bg-yellow-100 text-purple-600' :
                                    item.status === 'Material Delivered & Quality Check Pending' ? 'bg-blue-100 text-blue-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {item.status || 'Unknown'}
                                </span>
                              </td>
                              {columnsToShow.backorder && selectedReceipt?.type === 'Backorder' && (
                                <>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.backorder_sequence || '-'}</td>
                                </>
                              )}
                              {columnsToShow.return && selectedReceipt?.type === 'Return' && (
                                <>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.return_sequence || '-'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.return_reordered_quantity || '-'}</td>
                                </>
                              )}
                              {columnsToShow.note && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {(item.status === 'QC Rejected' || item.status === 'QC Hold') ? item.note || '-' : '-'}
                                </td>
                              )}
                              {columnsToShow.backorder && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.backorder_sequence ? (
                                    <button
                                      onClick={() => handleViewDetails(item, 'backorder')}
                                      className="text-blue-600 hover:underline"
                                    >
                                      View Details
                                    </button>
                                  ) : '-'}
                                </td>
                              )}
                              {columnsToShow.return && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {item.return_sequence ? (
                                    <button
                                      onClick={() => handleViewDetails(item, 'return')}
                                      className="text-blue-600 hover:underline"
                                    >
                                      View Details
                                    </button>
                                  ) : '-'}
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div>
                  {filteredPos.length === 1 && searchTerm && (
                    <div className="mb-4">
                      <button
                        onClick={handleBackToPoList}
                        className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-800 transition-colors"
                      >
                        Back to Past POs
                      </button>
                    </div>
                  )}
                 <div className="table-wrapper" ref={tableWrapperRef}>
                    <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-50" ref={tableHeaderRef}>
                        <tr>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">PO Number</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">MRF No</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Vendor</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">QC Status</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Created At</th>
                          {searchTerm && filteredPos.length === 1 ? (
                            <>
                              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Receipt Type</th>
                              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Receipt Reference</th>
                            </>
                          ) : (
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-800 uppercase tracking-wider">Receipts</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(searchTerm && filteredPos.length === 1 ? receiptRows : compactReceipts).length === 0 && !loading ? (
                          <tr>
                            <td colSpan={searchTerm && filteredPos.length === 1 ? 7 : 6} className="px-6 py-4 text-center text-gray-500 text-lg">
                              No purchase orders found
                            </td>
                          </tr>
                        ) : searchTerm && filteredPos.length === 1 ? (
                          receiptRows.map((row, index) => (
                            <tr
                              key={`${row.po_number}-${row.receipt_type}-${row.receipt_reference}-${index}`}
                              onClick={() =>
                                handlePoClick(
                                  {
                                    po_number: row.po_number,
                                    mrf_no: row.mrf_no,
                                    vendor_name: row.vendor_name,
                                    status: row.status,
                                  },
                                  { type: row.receipt_type, reference: row.receipt_reference }
                                )
                              }
                              className="hover:bg-gray-50 cursor-pointer"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{row.po_number}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{row.mrf_no}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{row.vendor_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    row.status === 'Pending' ? 'bg-red-100 text-red-800' :
                                    row.status === 'Done' ? 'bg-green-100 text-green-800' :
                                    'bg-yellow-100 text-purple-600'
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{formatDate(row.created_at)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                <span
                                  className={`${
                                    row.receipt_type === 'Main' ? 'text-gray-900' :
                                    row.receipt_type === 'Backorder' ? 'text-purple-600' :
                                    'text-red-600'
                                  }`}
                                >
                                  {row.receipt_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                <span
                                  className={`${
                                    row.receipt_type === 'Main' ? 'text-gray-900' :
                                    row.receipt_type === 'Backorder' ? 'text-purple-600' :
                                    'text-red-600'
                                  }`}
                                >
                                  {row.receipt_reference}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          compactReceipts.map((row, index) => (
                            <tr
                              key={`${row.po_number}-${index}`}
                              onClick={() =>
                                handlePoClick(
                                  {
                                    po_number: row.po_number,
                                    mrf_no: row.mrf_no,
                                    vendor_name: row.vendor_name,
                                    status: row.status,
                                  },
                                  { type: 'Main', reference: row.po_number }
                                )
                              }
                              className="hover:bg-gray-50 cursor-pointer"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{row.po_number}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{row.mrf_no}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{row.vendor_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    row.status === 'Pending' ? 'bg-red-100 text-red-800' :
                                    row.status === 'Done' ? 'bg-green-100 text-green-800' :
                                    'bg-yellow-100 text-purple-600'
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{formatDate(row.created_at)}</td>
                              <td className="px-6 py-4 text-sm text-center">
                                {row.receipts.map((receipt, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() =>
                                      handlePoClick(
                                        {
                                          po_number: row.po_number,
                                          mrf_no: row.mrf_no,
                                          vendor_name: row.vendor_name,
                                          status: row.status,
                                        },
                                        { type: receipt.type, reference: receipt.reference }
                                      )
                                    }
                                    className={`cursor-pointer mb-1 ${
                                      receipt.type === 'Main' ? 'text-gray-900' :
                                      receipt.type === 'Backorder' ? 'text-purple-600' :
                                      'text-red-600'
                                    }`}
                                  >
                                    {receipt.type}: {receipt.reference}
                                  </div>
                                ))}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Modal
          title="Details"
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={[
            <button
              key="close"
              onClick={() => setModalVisible(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
            >
              Close
            </button>,
          ]}
        >
          {modalContent}
        </Modal>

<style jsx global>{`
  * {
    box-sizing: border-box; /* Ensure padding doesn’t affect widths */
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
    background: #f5f5f5;
  }
  .table-container {
    position: relative;
    max-height: 500px;
    overflow-y: auto;
    overflow-x: auto;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    isolation: isolate; /* Create a new stacking context */
  }
  .table-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .table-container::-webkit-scrollbar,
  .table-wrapper::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .table-container::-webkit-scrollbar-track,
  .table-wrapper::-webkit-scrollbar-track {
    background: #e5e7eb;
    border-radius: 4px;
  }
  .table-container::-webkit-scrollbar-thumb,
  .table-wrapper::-webkit-scrollbar-thumb {
    background: #9ca3af;
    border-radius: 4px;
  }
  table {
    border-collapse: collapse;
    border-spacing: 0;
    width: 100%;
    min-width: 1000px;
    table-layout: auto; /* Allow columns to size based on content */
  }
  th, td {
    border-bottom: 1px solid #e5e7eb;
    padding: 12px 16px;
    font-size: 14px;
  }
  .sticky {
    position: sticky;
    top: 0;
    z-index: 20;
    background: #f9fafb;
    box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.1);
  }
  .sticky th {
    position: sticky;
    top: 0;
    z-index: 20;
    background: #f9fafb;
    font-weight: 600;
    color: #1f2937;
    text-align: center;
    white-space: nowrap;
    box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.1);
  }
  .bg-white {
    margin: 0 auto;
    width: 100%;
    max-width: 95vw;
    overflow: visible; /* Prevent interference with sticky */
  }
  button, select {
    transition: all 0.2s ease-in-out;
  }
  select {
    background: #f9fafb;
  }
  select:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`}</style>
      </div>
    </ErrorBoundary>
  );
};

export default PastPOReview;