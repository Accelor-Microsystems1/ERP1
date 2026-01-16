import React, { useState, useEffect, useMemo } from 'react';
import { fetchBackorderedReturnedPOs, updateBackorderItem } from '../utils/api';

const BackorderedReturnedPOs = () => {
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
  const [currentPage, setCurrentPage] = useState(1);
  const [unlockedPOs, setUnlockedPOs] = useState(new Set());
  const [editingComponent, setEditingComponent] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingSubmitComponent, setPendingSubmitComponent] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const itemsPerPage = 10;
  const today = new Date('2025-06-04');
  today.setHours(0, 0, 0, 0);

  const normalizeDateString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const getStatusStyle = (status) => {
    if (status.includes('Backordered') && status.includes('Returned')) {
      return 'bg-purple-100 text-purple-800';
    } else if (status.includes('Backordered')) {
      return 'bg-orange-100 text-orange-800';
    } else if (status === 'Returned') {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const poColumns = useMemo(
    () => [
      { key: 'po_number', label: 'PO Number' },
      {
        key: 'backorder_return_sequence',
        label: 'Backorder/Return No.',
        render: (_, po) => {
          const status = po.po_status;
          const isBackordered = status.includes('Backordered');
          const isReturned = status === 'Returned' || status.includes('Returned');
          
          if (isBackordered && isReturned) {
            return `${po.backorder_sequence || '-'} / ${po.return_sequence || '-'}`;
          } else if (isBackordered) {
            return po.backorder_sequence || '-';
          } else if (isReturned) {
            return po.return_sequence || '-';
          }
          return '-';
        },
      },
      { key: 'mrf_no', label: 'MRF No' },
      { key: 'vendor_name', label: 'Vendor' },
      {
        key: 'po_created_at',
        label: 'Created At',
        render: (value) => (value ? new Date(value).toLocaleDateString() : '-'),
      },
      {
        key: 'po_status',
        label: 'Status',
        render: (value) => (
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(value)}`}>
            {value}
          </span>
        ),
      },
      {
        key: 'unlock_po',
        label: 'Unlock PO',
        render: (_, po) => (
          <button
            onClick={() => handleUnlockToggle(po.po_number)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              unlockedPOs.has(po.po_number)
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {unlockedPOs.has(po.po_number) ? 'Unlocked' : 'Locked'}
          </button>
        ),
      },
    ],
    [unlockedPOs]
  );

  const componentColumns = useMemo(
    () => [
      { key: 'mrf_no', label: 'MRF No' },
      { key: 'item_description', label: 'Item Description' },
      { key: 'mpn', label: 'MPN' },
      { key: 'make', label: 'Make' },
      { key: 'part_no', label: 'Part No' },
      { key: 'uom', label: 'UoM' },
      {
        key: 'updated_requested_quantity',
        label: 'Ordered Qty',
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
                className="border rounded px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none w-24"
                min="1"
              />
            );
          }
          return value || '-';
        },
      },
      {
        key: 'received_quantity',
        label: 'Received Quantity',
        render: (value, component) => {
          const displayValue = component.received_quantity !== undefined && component.received_quantity !== null 
            ? component.received_quantity 
            : 0;
          return displayValue;
        },
      },
      {
        key: 'pending_quantity',
        label: 'Pending Quantity',
        render: (value, component) => {
          const displayValue = component.pending_quantity !== undefined && component.pending_quantity !== null 
            ? component.pending_quantity 
            : 0;
          return displayValue;
        },
      },
      { key: 'rate_per_unit', label: 'Rate per Unit' },
      {
        key: 'expected_delivery_date',
        label: 'Expected Delivery Date',
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
                className="border rounded px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            );
          }
          return value ? new Date(value).toLocaleDateString() : '-';
        },
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (_, component) =>
          unlockedPOs.has(selectedPo?.po_number) ? (
            editingComponent === component.component_id ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPendingSubmitComponent(component);
                    setShowConfirmationModal(true);
                  }}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm"
                >
                  Submit
                </button>
                <button
                  onClick={() => setEditingComponent(null)}
                  className="bg-gray-600 text-white px-3 py-1 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleEdit(component)}
                className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm"
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
      const data = await fetchBackorderedReturnedPOs();
      console.log("Data received in fetchPOs:", data);

      if (!Array.isArray(data)) {
        throw new Error('Received data is not in the expected array format');
      }

      const poMap = new Map();
      data.forEach((item) => {
        const key = item.po_number;
        if (!poMap.has(key)) {
          poMap.set(key, {
            po_number: item.po_number,
            mrf_no: item.mrf_no || '-',
            vendor_name: item.vendor_name || '-',
            po_created_at: item.po_created_at,
            po_status: item.po_status || '-',
            expected_delivery_date: item.expected_delivery_date,
            backorder_sequence: item.backorder_sequence || null,
            return_sequence: item.return_sequence || null,
            received_quantity: item.received_quantity || 0,
          });
        }
      });

      const poList = Array.from(poMap.values());
      console.log("Processed PO list:", poList);

      const updatedComponents = data.map((item) => ({
        ...item,
        received_quantity: item.received_quantity || 0,
        pending_quantity: (item.updated_requested_quantity || 0) - (item.received_quantity || 0),
      }));
      console.log("Updated components with quantities:", updatedComponents);

      setPos(poList);
      setFilteredPos(poList);
      setComponents(updatedComponents);
      setFilteredComponents(updatedComponents);
      setSelectedPo(null);
    } catch (err) {
      console.error("Error in fetchPOs:", err);
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

  const applyFilters = (textTerm, dateTerm) => {
    let filteredPoList = [...pos];
    let filteredComponentsList = [...components];

    if (textTerm) {
      const searchTermLower = textTerm.toLowerCase();
      const matchingComponents = components.filter(
        (component) =>
          component.item_description.toLowerCase().includes(searchTermLower) ||
          component.mpn.toLowerCase().includes(searchTermLower)
      );
      const matchingPoNumbers = new Set(matchingComponents.map((comp) => comp.po_number));
      filteredPoList = filteredPoList.filter(
        (po) =>
          po.po_number.toLowerCase().includes(searchTermLower) ||
          po.vendor_name.toLowerCase().includes(searchTermLower) ||
          matchingPoNumbers.has(po.po_number)
      );
      filteredComponentsList = filteredComponentsList.filter(
        (component) =>
          filteredPoList.some((po) => po.po_number === component.po_number) ||
          component.item_description.toLowerCase().includes(searchTermLower) ||
          component.mpn.toLowerCase().includes(searchTermLower)
      );
    }

    if (dateTerm) {
      filteredPoList = filteredPoList.filter(
        (po) => normalizeDateString(po.po_created_at) === dateTerm
      );
      filteredComponentsList = filteredComponentsList.filter(
        (component) => filteredPoList.some((po) => po.po_number === component.po_number)
      );
    }

    setFilteredPos(filteredPoList);
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
    applyFilters(term, createdAtSearch);
    setCurrentPage(1);
  };

  const handleCreatedAtChange = (e) => {
    const date = e.target.value;
    setCreatedAtSearch(date);
    applyFilters(searchTerm, date);
    setCurrentPage(1);
  };

  const handlePoClick = (po) => {
    setSelectedPo(po);
    const relatedComponents = components.filter(
      (component) => component.po_number === po.po_number
    );
    setFilteredComponents(relatedComponents);
    setCurrentPage(1);
  };

  const handleBackToPoList = () => {
    setSelectedPo(null);
    setFilteredComponents(components);
    setCurrentPage(1);
    applyFilters(searchTerm, createdAtSearch);
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
      applyFilters('', '');
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
      const response = await updateBackorderItem(
        selectedPo.po_number,
        component.component_id,
        editedValues.expected_delivery_date,
      );

      const updatedComponents = components.map((comp) =>
        comp.component_id === component.component_id
          ? {
              ...comp,
              expected_delivery_date: editedValues.expected_delivery_date,
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-700 table-auto border-collapse">
        <thead className="text-xs uppercase bg-indigo-50 text-indigo-900 sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-6 py-4 border-b border-gray-200"
              >
                <div className="flex items-center font-semibold">
                  {col.label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && !loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-4 text-center text-gray-600 border-b border-gray-200"
              >
                No {selectedPo ? 'components' : 'purchase orders'} found
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.po_number + (item.component_id || '')}
                onClick={() => onRowClick && onRowClick(item)}
                className={`border-b border-gray-200 ${
                  onRowClick ? 'cursor-pointer' : ''
                } text-gray-800`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4">
                    {col.render ? col.render(item[col.key], item) : item[col.key] || '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="h-screen w-screen p-12 bg-gray-50 flex flex-col">
      <div className="bg-white shadow-xl rounded-xl p-8 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 border-l-4 border-indigo-600 pl-4">
            Backordered & Returned Purchase Orders
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSearch}
              className="p-2 rounded-full bg-indigo-100"
            >
              <svg
                className="w-5 h-5 text-indigo-600"
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
              <div className="flex gap-3">
                <input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  type="text"
                  placeholder="Search by PO Number, Vendor, Description, or MPN"
                  className="px-4 py-2 border rounded-lg border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 w-72 text-sm font-medium text-gray-700 placeholder-gray-400"
                />
                <input
                  type="date"
                  value={createdAtSearch}
                  onChange={handleCreatedAtChange}
                  className="px-4 py-2 border rounded-lg border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 w-48 text-sm font-medium text-gray-700"
                />
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
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
            {successMessage}
          </div>
        )}

        <div className="relative flex-1 overflow-y-auto rounded-lg shadow-sm border border-gray-200">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-10">
              <svg className="h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
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
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    PO No.: {selectedPo.po_number}
                  </h2>
                  <p className="text-sm font-medium text-gray-600">
                    Vendor: {selectedPo.vendor_name}
                  </p>
                </div>
                <button
                  onClick={handleBackToPoList}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
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
              <div className="flex-1 overflow-y-auto">
                <DynamicTable data={paginatedData} columns={componentColumns} onRowClick={null} />
              </div>
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
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}

        {showConfirmationModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-opacity-30 z-50">
            <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Confirm Changes
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to save the changes to this purchase order?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmit(pendingSubmitComponent)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackorderedReturnedPOs;