import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchAllPurchaseOrders, updatePurchaseOrder } from '../utils/api';

const PORaisedComponents = () => {
  const [pos, setPos] = useState([]);
  const [components, setComponents] = useState([]);
  const [filteredPos, setFilteredPos] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [createdAtSearch, setCreatedAtSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'po_number', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [unlockedPOs, setUnlockedPOs] = useState(new Set());
  const [editingComponent, setEditingComponent] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingSubmitComponent, setPendingSubmitComponent] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDueTodayDetails, setShowDueTodayDetails] = useState(false);
  const [mrfColorSearch, setMrfColorSearch] = useState(false); // New state for MRF color filter
  const itemsPerPage = 10;
  const today = new Date('2025-11-30');
  today.setHours(0, 0, 0, 0);

  const tableContainerRef = useRef(null);
  const tableHeaderRef = useRef(null);

  const normalizeDateString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const getDeliveryStatus = (expectedDate, poStatus) => {
    if (poStatus === 'Delivered') return { status: 'Delivered', color: 'bg-green-100 text-green-800' };
    if (!expectedDate) return { status: poStatus || 'Unknown', color: 'bg-gray-100 text-gray-800' };

    const deliveryDate = new Date(expectedDate);
    deliveryDate.setHours(0, 0, 0, 0);
    const deliveryDateString = normalizeDateString(deliveryDate);
    const todayString = normalizeDateString(today);

    console.log(`Comparing dates: deliveryDateString=${deliveryDateString}, todayString=${todayString}`);

    if (deliveryDateString === todayString) {
      return { status: 'Expected Delivery Today', color: 'bg-yellow-100 text-yellow-800' };
    }

    const diffDays = (deliveryDate - today) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) {
      return { status: 'Delayed', color: 'bg-red-100 text-red-800' };
    } else if (diffDays <= 1) {
      return { status: 'Due Soon', color: 'bg-yellow-100 text-yellow-800' };
    }
    return { status: poStatus || 'On Time', color: 'bg-blue-100 text-blue-800' };
  };

  const isMrfFormat = (mrfNo) => {
    return /^MRF-\d+$/.test(mrfNo); // Regex to match MRF-@number format
  };

  const dueTodayPOs = useMemo(() => {
    const result = pos.filter((po) => {
      if (!po.expected_delivery_date) return false;
      const deliveryDate = new Date(po.expected_delivery_date);
      deliveryDate.setHours(0, 0, 0, 0);
      const deliveryDateString = normalizeDateString(deliveryDate);
      const todayString = normalizeDateString(today);
      const isDueToday = deliveryDateString === todayString;
      console.log(`PO ${po.po_number}: deliveryDateString=${deliveryDateString}, todayString=${todayString}, isDueToday=${isDueToday}`);
      return isDueToday;
    });
    console.log(`dueTodayPOs: ${JSON.stringify(result.map(po => po.po_number))}`);
    return result;
  }, [pos]);

  const poColumns = useMemo(
    () => [
      { key: 'po_number', label: 'PO Number', sortable: true },
      {
        key: 'mrf_no',
        label: 'MRF No',
        sortable: true,
        render: (value) => (
          <span className={isMrfFormat(value) ? 'text-red-800' : ''}>{value}</span>
        ),
      },
      { key: 'vendor_name', label: 'Vendor', sortable: true },
      {
        key: 'po_created_at',
        label: 'Created At',
        sortable: true,
        render: (value) => (value ? new Date(value).toLocaleDateString() : '-'),
      },
      {
        key: 'po_status',
        label: 'Status',
        sortable: true,
        render: (value, po) => {
          const { status, color } = getDeliveryStatus(po.expected_delivery_date, value);
          return (
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${color}`}>
              {status}
            </span>
          );
        },
      },
      {
        key: 'unlock_po',
        label: 'Unlock PO',
        sortable: false,
        render: (_, po) => {
          const { status } = getDeliveryStatus(po.expected_delivery_date, po.po_status);
          const canUnlock = status === 'Material Delivery Pending' || status === 'Delayed' || status === 'Expected Delivery Today' || status === 'Backordered';
          return canUnlock ? (
            <button
              onClick={() => handleUnlockToggle(po.po_number)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                unlockedPOs.has(po.po_number)
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {unlockedPOs.has(po.po_number) ? 'Unlocked' : 'Locked'}
            </button>
          ) : null;
        },
      },
    ],
    [unlockedPOs]
  );

  const componentColumns = useMemo(
    () => [
      {
        key: 'mrf_no',
        label: 'MRF No',
        sortable: true,
        render: (value) => (
          <span className={isMrfFormat(value) ? 'text-blue-800' : ''}>{value}</span>
        ),
      },
      { key: 'project_name', label: 'Project Name', sortable: true },
      { key: 'item_description', label: 'Item Description', sortable: true },
      { key: 'mpn', label: 'MPN', sortable: true },
      { key: 'make', label: 'Make', sortable: true },
      { key: 'part_no', label: 'Part No', sortable: true },
      {
        key: 'expected_delivery_date',
        label: 'Expected Delivery Date',
        sortable: true,
        render: (value, component) => {
          if (editingComponent === component.component_id && unlockedPOs.has(selectedPo.po_number)) {
            return (
              <input
                type="date"
                value={editedValues.expected_delivery_date || value}
                min={today.toISOString().split('T')[0]}
                onChange={(e) =>
                  setEditedValues({
                    ...editedValues,
                    expected_delivery_date: e.target.value,
                  })
                }
                className="border rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            );
          }
          return value ? new Date(value).toLocaleDateString() : '-';
        },
      },
      { key: 'initial_requested_quantity', label: 'Initial Qty', sortable: true },
      {
        key: 'updated_requested_quantity',
        label: 'Ordered Qty',
        sortable: true,
        render: (value, component) => {
          if (editingComponent === component.component_id && unlockedPOs.has(selectedPo.po_number)) {
            return (
              <input
                type="number"
                value={editedValues.updated_requested_quantity || value}
                onChange={(e) => {
                  const newQty = parseInt(e.target.value) || 0;
                  const newAmount = component.rate_per_unit * newQty;
                  const newGstAmount = newAmount * 0.18;
                  setEditedValues({
                    ...editedValues,
                    updated_requested_quantity: newQty,
                    amount: newAmount,
                    gst_amount: newGstAmount,
                  });
                }}
                className="border rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-24"
                min="1"
              />
            );
          }
          return value || '-';
        },
      },
      { key: 'uom', label: 'UoM', sortable: true },
      { key: 'rate_per_unit', label: 'Rate per Unit', sortable: true },
      {
        key: 'gst_amount',
        label: 'GST Amount',
        sortable: true,
        render: (value, component) => {
          const numericValue = parseFloat(value) || 0;
          const displayValue =
            editingComponent === component.component_id && unlockedPOs.has(selectedPo.po_number)
              ? parseFloat(editedValues.gst_amount) || numericValue
              : numericValue;
          return displayValue.toFixed(2);
        },
      },
      {
        key: 'amount',
        label: 'Amount',
        sortable: true,
        render: (value, component) => {
          const numericValue = parseFloat(value) || 0;
          const displayValue =
            editingComponent === component.component_id && unlockedPOs.has(selectedPo.po_number)
              ? parseFloat(editedValues.amount) || numericValue
              : numericValue;
          return displayValue.toFixed(2);
        },
      },
      {
        key: 'po_created_at',
        label: 'Created At',
        sortable: true,
        render: (value) => (value ? new Date(value).toLocaleDateString() : '-'),
      },
      {
        key: 'actions',
        label: 'Actions',
        sortable: false,
        render: (_, component) =>
          unlockedPOs.has(selectedPo.po_number) ? (
            editingComponent === component.component_id ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPendingSubmitComponent(component);
                    setShowConfirmationModal(true);
                  }}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 text-sm"
                >
                  Submit
                </button>
                <button
                  onClick={() => setEditingComponent(null)}
                  className="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleEdit(component)}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 text-sm"
              >
                Edit
              </button>
            )
          ) : null,
      },
    ],
    [editingComponent, editedValues, unlockedPOs, selectedPo]
  );

  const fetchPOs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAllPurchaseOrders();
      const validData = response.data.filter((item) => item.po_number);

      // Normalize the data for each component
      const normalizedData = validData.map((item) => ({
        ...item,
        amount: parseFloat(item.amount) || 0,
        gst_amount: parseFloat(item.gst_amount) || 0,
        rate_per_unit: parseFloat(item.rate_per_unit) || 0,
        updated_requested_quantity: parseInt(item.updated_requested_quantity) || 0,
        initial_requested_quantity: parseInt(item.initial_requested_quantity) || 0,
        project_name: item.project_name || '-',
        direct_sequence: item.direct_sequence || '-',
      }));

      // Group components by po_number
      const groupedByPo = normalizedData.reduce((acc, item) => {
        const key = item.po_number;
        if (!acc[key]) {
          acc[key] = {
            po_number: item.po_number,
            mrf_no: item.mrf_no || '-',
            vendor_name: item.vendor_name || '-',
            po_created_at: item.po_created_at,
            po_status: item.po_status || '-',
            expected_delivery_date: item.expected_delivery_date,
            components: [],
          };
        }
        acc[key].components.push(item);
        return acc;
      }, {});

      // Convert grouped data to list of POs
      const poList = Object.values(groupedByPo);
      
      console.log('Grouped POs:', poList);
      setPos(poList);
      setFilteredPos(poList);
      setComponents(normalizedData); // Keep all components for filtering
      setFilteredComponents(normalizedData);
      setSelectedPo(null);
    } catch (err) {
      console.error('Error fetching POs:', {
        message: err.message,
        stack: err.stack,
      });
      setError('Failed to fetch purchase orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token) {
      setError('No authentication token found. Please log in.');
      return;
    }
    if (role !== 'purchase_head') {
      setError('Unauthorized: Only users with the "purchase_head" role can access this page.');
      return;
    }
    fetchPOs();
  }, []);

  // JavaScript fallback for sticky headers with stable loading
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const tableHeader = tableHeaderRef.current;

    if (!tableContainer || !tableHeader) {
      console.log('Table elements not found:', { tableContainer, tableHeader });
      return;
    }

    const table = tableContainer.querySelector('table');
    if (!table) {
      console.log('Table not found inside tableContainer');
      return;
    }

    const applyStickyFallback = () => {
      console.log('Applying sticky fallback for table headers');

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

        const tableWidth = table.scrollWidth;

        console.log('Scroll event triggered:', {
          containerTop: containerRect.top,
          scrollTop: scrollTop,
          tableWidth: tableWidth,
        });

        if (scrollTop > 0) {
          tableHeader.style.position = 'fixed';
          tableHeader.style.top = `${containerRect.top}px`;
          tableHeader.style.left = `${containerRect.left}px`;
          tableHeader.style.width = `${tableWidth}px`;
          tableHeader.style.zIndex = '10';
          tableHeader.style.background = '#f3f4f6';
          tableHeader.style.borderBottom = '1px solid #e5e7eb';

          setColumnWidths();
        } else {
          tableHeader.style.position = 'relative';
          tableHeader.style.top = 'auto';
          tableHeader.style.left = 'auto';
          tableHeader.style.width = 'auto';
          tableHeader.style.borderBottom = 'none';

          const headerCells = tableHeader.querySelectorAll('th');
          headerCells.forEach((cell) => {
            cell.style.width = 'auto';
            cell.style.minWidth = 'auto';
            cell.style.maxWidth = 'auto';
          });
        }
      };

      tableContainer.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);

      handleScroll();

      return () => {
        tableContainer.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    };

    applyStickyFallback();
  }, [selectedPo]);

  const sortData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      const valA = a[key] || '';
      const valB = b[key] || '';
      if (key === 'po_created_at' || key === 'expected_delivery_date') {
        const dateA = valA ? new Date(valA) : new Date(0);
        const dateB = valB ? new Date(valB) : new Date(0);
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (typeof valA === 'string') {
        return direction === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return direction === 'asc' ? valA - valB : valB - valA;
    });
  };

  const handleSort = (key) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    setFilteredPos(sortData(filteredPos, key, direction));
    setFilteredComponents(sortData(filteredComponents, key, direction));
  };

  const applyFilters = (textTerm, dateTerm, colorFilter) => {
    let filteredPoList = [...pos];
    let filteredComponentsList = [...components];

    // Apply text-based search (po_number, vendor_name, item_description, mpn)
    if (textTerm) {
      const searchTermLower = textTerm.toLowerCase();
      // First, find components that match item_description or mpn
      const matchingComponents = components.filter(
        (component) =>
          component.item_description.toLowerCase().includes(searchTermLower) ||
          component.mpn.toLowerCase().includes(searchTermLower)
      );
      // Get unique PO numbers from matching components
      const matchingPoNumbers = new Set(matchingComponents.map((comp) => comp.po_number));
      // Filter POs by po_number, vendor_name, or those containing matching components
      filteredPoList = filteredPoList.filter(
        (po) =>
          po.po_number.toLowerCase().includes(searchTermLower) ||
          po.vendor_name.toLowerCase().includes(searchTermLower) ||
          matchingPoNumbers.has(po.po_number)
      );
      // Filter components to include only those in filtered POs or matching the search term
      filteredComponentsList = filteredComponentsList.filter(
        (component) =>
          filteredPoList.some((po) => po.po_number === component.po_number) ||
          component.item_description.toLowerCase().includes(searchTermLower) ||
          component.mpn.toLowerCase().includes(searchTermLower)
      );
    }

    // Apply date-based search (po_created_at)
    if (dateTerm) {
      filteredPoList = filteredPoList.filter(
        (po) => normalizeDateString(po.po_created_at) === dateTerm
      );
      filteredComponentsList = filteredComponentsList.filter(
        (component) => filteredPoList.some((po) => po.po_number === component.po_number)
      );
    }

    // Apply MRF color filter (MRF-@number format)
    if (colorFilter) {
      filteredPoList = filteredPoList.filter((po) => isMrfFormat(po.mrf_no));
      filteredComponentsList = filteredComponentsList.filter((component) =>
        filteredPoList.some((po) => po.po_number === component.po_number)
      );
    }

    setFilteredPos(sortData(filteredPoList, sortConfig.key, sortConfig.direction));
    setFilteredComponents(
      selectedPo
        ? filteredComponentsList.filter(
            (component) => component.po_number === selectedPo.po_number
          )
        : filteredComponentsList
    );
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    applyFilters(term, createdAtSearch, mrfColorSearch);
    setCurrentPage(1);
  };

  const handleCreatedAtChange = (e) => {
    const date = e.target.value;
    setCreatedAtSearch(date);
    applyFilters(searchTerm, date, mrfColorSearch);
    setCurrentPage(1);
  };

  const handleMrfColorSearchChange = (e) => {
    const checked = e.target.checked;
    setMrfColorSearch(checked);
    applyFilters(searchTerm, createdAtSearch, checked);
    setCurrentPage(1);
  };

  const handlePoClick = (po) => {
    setSelectedPo(po);
    const relatedComponents = po.components;
    setFilteredComponents(sortData(relatedComponents, sortConfig.key, sortConfig.direction));
    setCurrentPage(1);
  };

  const handleBackToPoList = () => {
    setSelectedPo(null);
    setFilteredComponents(sortData(components, sortConfig.key, sortConfig.direction));
    setCurrentPage(1);
    applyFilters(searchTerm, createdAtSearch, mrfColorSearch);
  };

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return (selectedPo ? filteredComponents : filteredPos).slice(startIndex, endIndex);
  }, [filteredPos, filteredComponents, currentPage, selectedPo]);

  const totalPages = Math.ceil(
    (selectedPo ? filteredComponents : filteredPos).length / itemsPerPage
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    if (isSearchVisible) {
      setSearchTerm('');
      setCreatedAtSearch('');
      setMrfColorSearch(false);
      applyFilters('', '', false);
    }
  };

  const handleUnlockToggle = (poNumber) => {
    setUnlockedPOs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(poNumber)) {
        newSet.delete(poNumber);
      } else {
        newSet.add(poNumber);
      }
      return newSet;
    });
  };

  const handleEdit = (component) => {
    setEditingComponent(component.component_id);
    const initialAmount = component.rate_per_unit * component.updated_requested_quantity;
    const initialGstAmount = initialAmount * 0.18;
    setEditedValues({
      expected_delivery_date: component.expected_delivery_date,
      updated_requested_quantity: component.updated_requested_quantity,
      amount: initialAmount,
      gst_amount: initialGstAmount,
    });
  };

  const handleSubmit = async (component) => {
    try {
      const response = await updatePurchaseOrder(
        selectedPo.po_number,
        component.component_id,
        editedValues.expected_delivery_date,
        editedValues.updated_requested_quantity
      );

      const updatedComponents = components.map((comp) =>
        comp.component_id === component.component_id
          ? {
              ...comp,
              expected_delivery_date: editedValues.expected_delivery_date,
              updated_requested_quantity: editedValues.updated_requested_quantity,
              amount: response.data.amount,
              gst_amount: response.data.gst_amount,
            }
          : comp
      );
      setComponents(updatedComponents);
      setFilteredComponents(
        updatedComponents.filter((comp) => comp.po_number === selectedPo.po_number)
      );
      setEditingComponent(null);
      setEditedValues({});
      setShowConfirmationModal(false);
      setSuccessMessage('Purchase order updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message);
      setShowConfirmationModal(false);
    }
  };

  const DynamicTable = ({ data, columns, onRowClick }) => (
    <table className="w-full text-sm text-left text-gray-700 table-auto border-collapse">
      <thead className="text-xs bg-gray-100 text-gray-800 sticky" ref={tableHeaderRef}>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className="px-4 py-3 border-b border-gray-200"
              onClick={col.sortable ? () => handleSort(col.key) : undefined}
            >
              <div className="flex items-center">
                {col.label}
                {col.sortable && (
                  <span className="ml-2 text-gray-400">
                    {sortConfig.key === col.key
                      ? sortConfig.direction === 'asc'
                        ? '↑'
                        : '↓'
                        : '↕'
                    }
                  </span>
                )}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 && !loading ? (
          <tr>
            <td colSpan={columns.length} className="px-4 py-3 text-center text-gray-500 border-b border-gray-200">
              No {selectedPo ? 'components' : 'purchase orders'} found
            </td>
          </tr>
        ) : (
          data.map((item) => {
            const statusInfo = selectedPo ? null : getDeliveryStatus(item.expected_delivery_date, item.po_status);
            const isDelayed = statusInfo && statusInfo.status === 'Delayed';
            const isToday = statusInfo && statusInfo.status === 'Expected Delivery Today';
            return (
              <tr
                key={item.po_number + (item.component_id || '')}
                onClick={() => onRowClick && onRowClick(item)}
                className={`border-b border-gray-200 ${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                } ${isDelayed ? 'text-red-600' : isToday ? 'text-yellow-600' : 'text-gray-700'}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render ? col.render(item[col.key], item) : item[col.key] || '-'}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto bg-white shadow-lg rounded-xl p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 border-l-4 border-blue-600 pl-4">
            Raised Purchase Orders
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSearch}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
            {isSearchVisible && (
              <div className="flex gap-3 flex-wrap">
                <input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  type="text"
                  placeholder="Search by PO Number, Vendor, Description, or MPN"
                  className="px-4 py-2 border rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-72 text-sm"
                />
                <input
                  type="date"
                  value={createdAtSearch}
                  onChange={handleCreatedAtChange}
                  className="px-4 py-2 border rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-72 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={mrfColorSearch}
                    onChange={handleMrfColorSearchChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  Show only Direct Purchase Requests
                </label>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-red-200">
            {successMessage}
          </div>
        )}

        {dueTodayPOs.length > 0 && !selectedPo && (
          <div
            className="relative mb-4 bg-yellow-50 border-l-4 border-yellow-400 px-4 py-2 rounded-r-lg shadow-sm flex items-center justify-between cursor-pointer hover:bg-yellow-100"
            onClick={() => setShowDueTodayDetails(!showDueTodayDetails)}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium text-yellow-800">
                Reminder: Contact the vendor today! {dueTodayPOs.length} PO{dueTodayPOs.length > 1 ? 's' : ''} due for delivery.
              </p>
            </div>
            <svg
              className={`w-4 h-4 text-yellow-600 ${showDueTodayDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
            {showDueTodayDetails && (
              <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">POs Due Today:</p>
                <ul className="space-y-1 text-sm text-gray-600">
                  {dueTodayPOs.map((po) => (
                    <li key={po.po_number} className="flex items-center gap-2">
                      <span className="font-medium">PO {po.po_number}</span>
                      <span>-</span>
                      <span>Vendor: {po.vendor_name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div
          className="relative overflow-x-auto rounded-lg shadow-sm border border-gray-200 table-container"
          ref={tableContainerRef}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-10">
              <svg className="h-8 w-8 text-blue-600" viewBox="0 0 24 24">
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
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    PO No.: {selectedPo.po_number}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Vendor: {selectedPo.vendor_name}
                  </p>
                </div>
                <button
                  onClick={handleBackToPoList}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to PO List
                </button>
              </div>
              <DynamicTable data={paginatedData} columns={componentColumns} onRowClick={null} />
            </div>
          ) : (
            <DynamicTable data={paginatedData} columns={poColumns} onRowClick={handlePoClick} />
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}

        {showConfirmationModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-opacity-30 z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Confirm Changes
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to save the changes to this purchase order?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmit(pendingSubmitComponent)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box; /* Ensure padding and borders don’t affect layout */
        }
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        .min-h-screen {
          min-height: 100vh;
          background: #f5f5f5;
        }
        .table-container {
          position: relative;
          min-height: 300px; /* Prevent layout shift during loading */
          max-height: 65vh;
          overflow-y: auto;
          overflow-x: auto;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          isolation: isolate; /* Create a new stacking context */
        }
        .table-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .table-container::-webkit-scrollbar-track {
          background: #e5e7eb;
          border-radius: 4px;
        }
        .table-container::-webkit-scrollbar-thumb {
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
          z-index: 10;
          background: #f3f4f6; /* Match bg-gray-100 */
          border-bottom: 1px solid #e5e7eb;
        }
        .sticky th {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #f3f4f6;
          font-weight: 600;
          color: #1f2937;
          text-align: left;
          white-space: nowrap;
          border-bottom: 1px solid #e5e7eb;
        }
        button, input {
          outline: none; /* Remove any default focus animations */
        }
      `}</style>
    </div>
  );
};

export default PORaisedComponents;