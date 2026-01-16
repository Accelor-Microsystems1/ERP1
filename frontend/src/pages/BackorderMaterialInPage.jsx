import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBackorderItems, updateBackorderMaterialIn, fetchAllLocations } from '../utils/api';

const BackorderMaterialInPage = () => {
  const navigate = useNavigate();
  const [backorderItems, setBackorderItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBackorder, setSelectedBackorder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [materialInData, setMaterialInData] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newLocationPath, setNewLocationPath] = useState('');
  const [allLocations, setAllLocations] = useState([]);
  const [filteredLocationOptions, setFilteredLocationOptions] = useState([]);
  const [isSaveLocationModalOpen, setIsSaveLocationModalOpen] = useState(false);
  const [isCancelLocationModalOpen, setIsCancelLocationModalOpen] = useState(false);
  const [locationUpdated, setLocationUpdated] = useState(new Set());
  const [backorderReturnSelections, setBackorderReturnSelections] = useState({});
  const [isReturnCreated, setIsReturnCreated] = useState(false);
  const [isBackorderCreated, setIsBackorderCreated] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [itemsResponse, locationsResponse] = await Promise.all([
        fetchBackorderItems().catch(err => {
          console.error("Failed to fetch backorder items:", err);
          setError("Unable to load backorder items. Some features may be limited.");
          return [];
        }),
        fetchAllLocations().catch(err => {
          console.error("Failed to fetch locations:", err);
          return [];
        }),
      ]);

      console.log("Backorder Items Response:", itemsResponse);
      console.log("Locations Response:", locationsResponse);

      if (!itemsResponse || itemsResponse.length === 0) {
        console.warn("No backorder items found in the response.");
        setError("No backorder items found.");
        setLoading(false);
        return;
      }

      // Map the API response to the expected structure
      const formattedItems = itemsResponse.map(item => ({
        backorder_number: item.po_number || 'N/A',
        mpn: item.mpn || 'N/A',
        item_description: item.item_description || 'N/A',
        part_no: item.mpn_received || 'N/A',
        make: item.make_received || 'N/A',
        received_quantity: item.received_quantity || 0,
        passed_quantity: item.passed_quantity || 0,
        failed_quantity: item.failed_quantity || 0,
        status: item.status || 'Unknown',
        expected_delivery_date: item.expected_delivery_date || 'N/A',
        component_id: item.component_id || null,
        location: item.location || 'N/A',
        mrr_no: item.mrr_no || '-',
        note: item.note || '-',
        vendor_name: item.vendor_name || 'Unknown Vendor',
        mrf_no: item.mrf_no || '-',
        reordered_quantity: item.reordered_quantity || 0,
        material_in_quantity: item.material_in_quantity || 0,
        coc_received: item.coc_received || false,
        date_code: item.date_code || 'N/A',
        lot_code: item.lot_code || 'N/A',
        uom: item.uom || 'N/A',
        return_sequence: item.return_sequence || null,
        backorder_sequence: item.backorder_sequence || null,
      }));

      // Filter for valid items with status 'QC Cleared' or 'QC Rejected'
      const validData = formattedItems.filter(item => 
        item.backorder_number !== 'N/A' && 
        item.status && 
        ['qc cleared', 'qc rejected'].includes(item.status.toLowerCase())
      );

      if (validData.length === 0) {
        setError("No valid backorder items found for Material In.");
        setLoading(false);
        return;
      }

      // Group items by backorder_number
      const backorderMap = new Map();
      validData.forEach((item) => {
        const key = item.backorder_number;
        if (!backorderMap.has(key)) {
          backorderMap.set(key, {
            backorder_number: item.backorder_number,
            mrf_no: item.mrf_no || '-',
            vendor_name: item.vendor_name || 'Unknown Vendor',
            status: item.status || 'Unknown',
          });
        }
      });

      const backorderList = Array.from(backorderMap.values()).sort((a, b) => {
        const backorderA = a.backorder_number || '';
        const backorderB = b.backorder_number || '';
        return backorderB.localeCompare(backorderA);
      });

      setBackorderItems(backorderList);
      setFilteredItems(validData);

      const locationOptions = locationsResponse.map(loc => ({
        value: loc.path || loc.location_path || '',
      })).filter(loc => loc.value);
      setAllLocations(locationOptions);
      setFilteredLocationOptions(locationOptions);

      const initialData = {};
      validData.forEach(item => {
        const key = `${item.backorder_number}-${item.mpn}`;
        initialData[key] = {
          showInput: false,
          material_in_quantity: item.material_in_quantity || 0,
        };
      });
      setMaterialInData(initialData);

      const initialSelections = {};
      validData.forEach(item => {
        const key = `${item.backorder_number}-${item.mpn}`;
        initialSelections[key] = { backorder: false, return: false };
      });
      setBackorderReturnSelections(initialSelections);
      setLoading(false);
    } catch (err) {
      console.error("Fetch data error:", err);
      setError(`Failed to load data: ${err.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const hasReturn = filteredItems.some(item => item.return_sequence);
    const hasBackorder = filteredItems.some(item => item.backorder_sequence);
    setIsReturnCreated(hasReturn);
    setIsBackorderCreated(hasBackorder);
  }, [filteredItems]);

  const applyFilters = (term) => {
    let filteredBackorderList = [...backorderItems];
    let filteredItemsList = [...filteredItems];

    if (term) {
      const searchTermLower = term.toLowerCase();
      filteredBackorderList = filteredBackorderList.filter((bo) =>
        bo.backorder_number.toLowerCase().includes(searchTermLower)
      );
      filteredItemsList = filteredItemsList.filter((item) =>
        filteredBackorderList.some((bo) => bo.backorder_number === item.backorder_number)
      );
    }

    setBackorderItems(filteredBackorderList);
    setFilteredItems(filteredItemsList);
    if (selectedBackorder) {
      setFilteredItems(
        filteredItemsList.filter((item) => item.backorder_number === selectedBackorder.backorder_number)
      );
    }
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    applyFilters(term);
  };

  const handleBackorderClick = (backorder) => {
    setSelectedBackorder(backorder);
    const relatedItems = filteredItems.filter(
      (item) => item.backorder_number === backorder.backorder_number
    );
    setFilteredItems(relatedItems);
  };

  const handleBackToBackorderList = () => {
    setSelectedBackorder(null);
    setFilteredItems(filteredItems);
    applyFilters(searchTerm);
  };

  const handleMaterialInClick = (item) => {
    const key = `${item.backorder_number}-${item.mpn}`;
    setMaterialInData((prev) => ({
      ...prev,
      [key]: { ...prev[key], showInput: !prev[key]?.showInput },
    }));
  };

  const handleInputChange = (item, field, value) => {
    const key = `${item.backorder_number}-${item.mpn}`;
    let updatedValue = value;

    if (field === 'material_in_quantity') {
      console.log(`handleInputChange - Item: ${key}, Value: ${value}, reordered_quantity: ${item.reordered_quantity}`);

      if (value === '') {
        updatedValue = '';
      } else {
        const parsedValue = parseFloat(value);
        const maxQuantity = parseFloat(item.reordered_quantity) || 0;
        if (!isNaN(parsedValue)) {
          updatedValue = Math.min(Math.max(parsedValue, 0), maxQuantity);
        } else {
          updatedValue = 0;
        }
      }
    }

    setMaterialInData((prev) => {
      const newData = {
        ...prev,
        [key]: { ...prev[key], [field]: updatedValue },
      };
      console.log(`Updated materialInData[${key}]:`, newData[key]);
      return newData;
    });
  };

  const handleUpdateClick = (item) => {
    const key = `${item.backorder_number}-${item.mpn}`;
    const data = materialInData[key] || {};
    const quantityToUpdate = data.material_in_quantity === '' ? 0 : parseFloat(data.material_in_quantity) || 0;
    setMaterialInData((prev) => ({
      ...prev,
      [key]: { ...prev[key], material_in_quantity: quantityToUpdate },
    }));
    setSelectedItem(item);
    setShowModal(true);
  };

  const confirmUpdate = async () => {
    if (!selectedItem) return;
    const key = `${selectedItem.backorder_number}-${selectedItem.mpn}`;
    const data = materialInData[key] || {};

    const materialInQuantity = data.material_in_quantity === '' ? 0 : parseFloat(data.material_in_quantity) || 0;

    try {
      console.log(`Updating material_in_quantity for ${key}: ${materialInQuantity}`);
      await updateBackorderMaterialIn({
        mpn: selectedItem.mpn,
        material_in_quantity: materialInQuantity,
        mrf_no: selectedItem.mrf_no || null,
      });

      await fetchData();
      setMaterialInData((prev) => ({
        ...prev,
        [key]: {
          showInput: false,
          material_in_quantity: materialInQuantity,
        },
      }));

      setShowModal(false);
      setSelectedItem(null);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError('Failed to update material in: ' + errorMessage);
    }
  };

  const openEditLocationModal = (item) => {
    if (!item.component_id) {
      setError('Component ID is missing. Unable to edit location.');
      return;
    }
    setSelectedItem(item);
    setNewLocationPath('');
    const currentLocationOption = item.location && item.location !== 'N/A'
      ? [{ value: item.location }]
      : [];
    setFilteredLocationOptions([...currentLocationOption, ...allLocations]);
    setShowEditLocationModal(true);
  };

  const handleLocationSearch = (value) => {
    const upperValue = value.toUpperCase();
    setNewLocationPath(upperValue);
    if (upperValue) {
      const filtered = allLocations.filter(option =>
        option.value.toUpperCase().includes(upperValue)
      );
      setFilteredLocationOptions(filtered);
    } else {
      setFilteredLocationOptions(allLocations);
    }
  };

  const handleLocationChange = (e) => {
    setNewLocationPath(e.target.value.toUpperCase());
  };

  const handleSaveLocationClick = () => {
    setIsSaveLocationModalOpen(true);
  };

  const handleCancelLocationClick = () => {
    setIsCancelLocationModalOpen(true);
  };

  const confirmSaveLocation = async () => {
    if (!newLocationPath || !selectedItem?.component_id) {
      setError('Missing required info: location path or component ID');
      return;
    }
    try {
      await updateNonCOCLocation(selectedItem.component_id, newLocationPath);
      const key = `${selectedItem.backorder_number}-${selectedItem.mpn}`;
      setLocationUpdated(prev => new Set(prev).add(key));
      await fetchData();
      setShowEditLocationModal(false);
      setIsSaveLocationModalOpen(false);
      setNewLocationPath('');
      setSelectedItem(null);
    } catch (err) {
      setError('Failed to update location: ' + (err.response?.data?.error || err.message));
    }
  };

  const confirmCancelLocation = () => {
    setIsCancelLocationModalOpen(false);
    setShowEditLocationModal(false);
    setNewLocationPath('');
    setSelectedItem(null);
  };

  const handleBackorderReturnChange = (item, type, checked) => {
    const key = `${item.backorder_number}-${item.mpn}`;
    setBackorderReturnSelections(prev => {
      const updated = { ...prev };
      if (type === 'backorder') {
        updated[key] = { backorder: checked, return: checked ? false : prev[key].return };
      } else {
        updated[key] = { backorder: checked ? false : prev[key].backorder, return: checked };
      }
      return updated;
    });
  };

  const handleCreateBackorder = () => {
    const selectedItems = filteredItems.filter(item => {
      const key = `${item.backorder_number}-${item.mpn}`;
      const orderedQty = parseFloat(item.reordered_quantity) || 0;
      const receivedQty = parseFloat(item.received_quantity) || 0;
      const isEligibleForBackorder = orderedQty > receivedQty;
      return backorderReturnSelections[key]?.backorder && isEligibleForBackorder;
    });

    if (selectedItems.length === 0) {
      setError("No items eligible for backorder selected (ensure items are selected and ordered quantity exceeds received quantity).");
      return;
    }

    navigate('/backorder', { state: { components: selectedItems } });
  };

  const handleCreateReturn = () => {
    const selectedItems = filteredItems.filter(item => {
      const key = `${item.backorder_number}-${item.mpn}`;
      return backorderReturnSelections[key]?.return && item.failed_quantity > 0 && item.status.toLowerCase() === 'qc rejected';
    });
    if (selectedItems.length === 0) {
      setError("No QC Rejected items with failed quantity selected for return.");
      return;
    }
    navigate('/return', { state: { components: selectedItems } });
  };

  const displayValue = (value) => {
    return value == null || value === '' ? '-' : value;
  };

  const isMaterialInDone = (item) => {
    return (item.material_in_quantity || 0) > 0;
  };

  const isLocationUpdated = (item) => {
    const key = `${item.backorder_number}-${item.mpn}`;
    return locationUpdated.has(key);
  };

  const isMaterialInCompletedForBackorder = (backorder) => {
    const backorderItems = filteredItems.filter(item => item.backorder_number === backorder.backorder_number);
    if (backorderItems.length === 0) return false;
    return backorderItems.every(item => isMaterialInDone(item));
  };

  return (
    <div className="min-h-screen p-12 bg-gray-50 flex flex-col font-sans">
      <div className="container mx-auto px-4 py-6 max-w-7xl flex-1 overflow-y-auto">
        <div className="bg-white shadow-md rounded-xl p-6 flex flex-col h-[calc(100vh-4rem)]">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Backorder Material In</h1>

          {/* Flash Cards */}
          {!selectedBackorder && (
            <div className="mb-6 space-y-3">
              <div className="bg-blue-50 border-l-4 border-blue-600 text-blue-800 p-4 rounded-r-lg shadow-sm">
                <p className="text-sm font-medium">
                  <span className="font-semibold">Note:</span> If the "Material In" button is disabled, it means the material in process for that item has already been completed.
                </p>
              </div>
              <div className="bg-purple-50 border-l-4 border-purple-600 text-purple-800 p-4 rounded-r-lg shadow-sm">
                <p className="text-sm font-medium">
                  <span className="font-semibold">Note:</span> Edit Location allows you to update the storage location of an item. Once updated, the button will be disabled.
                </p>
              </div>
              <div className="bg-green-50 border-l-4 border-green-600 text-green-700 p-4 rounded-r-lg shadow-sm">
                <p className="text-sm font-medium">
                  <span className="font-semibold">Note:</span> ✔ Icon indicates all items’ Material In is completed.
                </p>
              </div>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-4 items-center">
            <input
              value={searchTerm}
              onChange={handleSearchChange}
              type="text"
              placeholder="Search by Backorder Number"
              className="p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-full sm:w-80 transition-all duration-200 shadow-sm text-sm font-medium"
            />
            {selectedBackorder && (
              <button
                onClick={handleBackToBackorderList}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md text-sm font-medium"
              >
                Back to Backorder List
              </button>
            )}
          </div>

          {error && <div className="text-red-600 mb-6 text-sm font-medium">{error}</div>}

          {loading ? (
            <div className="text-center text-gray-600 text-sm font-medium">Loading...</div>
          ) : selectedBackorder ? (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Items for Backorder: {selectedBackorder.backorder_number}</h2>
              <div className="mb-4 flex gap-4">
                <button
                  onClick={handleCreateBackorder}
                  className={`px-6 py-2 rounded-lg transition-colors duration-200 shadow-md text-sm font-medium ${
                    isBackorderCreated
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                  disabled={isBackorderCreated}
                >
                  Create Backorder
                </button>
                <button
                  onClick={handleCreateReturn}
                  className={`px-6 py-2 rounded-lg transition-colors duration-200 shadow-md text-sm font-medium ${
                    isReturnCreated
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                  disabled={isReturnCreated}
                >
                  Create Return
                </button>
              </div>
              <div className="relative overflow-x-auto max-h-[60vh]">
                <table className="w-full border-collapse border border-gray-200 text-sm">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">MPN</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Description</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Make</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Part No</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Date Code</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Lot Code</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">UoM</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Ordered Qty</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Material In Qty</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Received Qty</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Passed Qty</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Failed Qty</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Backorder/Return</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">COC Received</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Location</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">MRR No</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Note</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Status</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan="19" className="border border-gray-200 p-3 text-center text-gray-600">
                          No items found for this backorder
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const key = `${item.backorder_number}-${item.mpn}`;
                        const data = materialInData[key] || {};
                        const selections = backorderReturnSelections[key] || { backorder: false, return: false };
                        const materialInDone = isMaterialInDone(item);
                        const locationIsUpdated = isLocationUpdated(item);
                        const orderedQty = parseFloat(item.reordered_quantity) || 0;
                        const receivedQty = parseFloat(item.received_quantity) || 0;
                        const isEligibleForBackorder = orderedQty > receivedQty;

                        return (
                          <tr key={key} className="hover:bg-gray-50 transition-colors duration-150">
                            <td className="border border-gray-200 p-3">{displayValue(item.mpn)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.item_description)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.make)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.part_no)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.date_code)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.lot_code)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.uom)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.reordered_quantity)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.material_in_quantity)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.received_quantity)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.passed_quantity)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.failed_quantity)}</td>
                            <td className="border border-gray-200 p-3">
                              <div className="flex gap-2">
                                {isEligibleForBackorder ? (
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={selections.backorder}
                                      onChange={(e) => handleBackorderReturnChange(item, 'backorder', e.target.checked)}
                                      className="mr-1 h-4 w-4 text-orange-600 rounded focus:ring-orange-500"
                                    />
                                    Backorder
                                  </label>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                                {item.status.toLowerCase() === 'qc rejected' && item.failed_quantity > 0 ? (
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={selections.return}
                                      onChange={(e) => handleBackorderReturnChange(item, 'return', e.target.checked)}
                                      className="mr-1 h-4 w-4 text-red-600 rounded focus:ring-red-500"
                                    />
                                    Return
                                  </label>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </div>
                            </td>
                            <td className="border border-gray-200 p-3">
                              {item.coc_received ? 'Yes' : 'No'}
                            </td>
                            <td className="border border-gray-200 p-3">{displayValue(item.location)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.mrr_no)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(item.note)}</td>
                            <td className="border border-gray-200 p-3">
                              <span
                                className={`px-2 py-1 rounded text-sm font-medium ${
                                  item.status.toLowerCase() === 'qc cleared'
                                    ? 'bg-green-100 text-green-800'
                                    : item.status.toLowerCase() === 'qc rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="border border-gray-200 p-3">
                              <div className="flex flex-col gap-2">
                                <button
                                  className={`px-4 py-1.5 rounded-lg transition-colors duration-200 shadow-sm text-sm font-medium ${
                                    materialInDone
                                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                  onClick={() => handleMaterialInClick(item)}
                                  disabled={materialInDone}
                                >
                                  Material In
                                </button>
                                <button
                                  className={`px-4 py-1.5 rounded-lg transition-colors duration-200 shadow-sm text-sm font-medium ${
                                    locationIsUpdated
                                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                      : 'bg-purple-600 text-white hover:bg-purple-700'
                                  }`}
                                  onClick={() => openEditLocationModal(item)}
                                  disabled={locationIsUpdated}
                                >
                                  Edit Location
                                </button>
                                {data.showInput && !materialInDone && (
                                  <div className="mt-2 flex flex-col gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.reordered_quantity|| 0}
                                      value={data.material_in_quantity === 0 && data.material_in_quantity !== '' ? '' : data.material_in_quantity}
                                      onChange={(e) => handleInputChange(item, 'material_in_quantity', e.target.value)}
                                      className="border border-gray-200 p-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-full transition-all duration-200 shadow-sm text-sm"
                                      placeholder="Material In Qty"
                                    />
                                    <button
                                      className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition-colors duration-200 shadow-sm text-sm font-medium"
                                      onClick={() => handleUpdateClick(item)}
                                    >
                                      Update
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div>
                <table className="w-full border-collapse border border-gray-200 text-sm">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Backorder Number</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">MRF No</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Vendor</th>
                      <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backorderItems.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="border border-gray-200 p-3 text-center text-gray-600">
                          No backorder items found for material in
                        </td>
                      </tr>
                    ) : (
                      backorderItems.map((backorder) => (
                        <tr
                          key={backorder.backorder_number}
                          onClick={() => handleBackorderClick(backorder)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                        >
                          <td className="border border-gray-200 p-3">
                            {backorder.backorder_number}
                            {isMaterialInCompletedForBackorder(backorder) && (
                              <span
                                className="ml-2 text-green-600 text-sm relative group"
                                title="Material In Completed for All Items"
                              >
                                ✔
                                <span className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 -mt-8 -ml-10">
                                  Material In Completed for All Items
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-200 p-3">{backorder.mrf_no}</td>
                          <td className="border border-gray-200 p-3">{backorder.vendor_name}</td>
                          <td className="border border-gray-200 p-3">
                            <span
                              className={`px-2 py-1 rounded text-sm font-medium ${
                                backorder.status.toLowerCase() === 'qc cleared'
                                  ? 'bg-green-100 text-green-800'
                                  : backorder.status.toLowerCase() === 'qc rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {backorder.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showModal && selectedItem && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Confirm Material In</h2>
                <p className="text-gray-600 text-sm">
                  Are you sure you want to update the material in for Backorder{' '}
                  <span className="font-semibold">{selectedItem.backorder_number}</span> (MPN:{' '}
                  <span className="font-semibold">{selectedItem.mpn}</span>) with the following details?
                </p>
                <ul className="mt-3 text-gray-600 text-sm">
                  <li>
                    Material In Quantity:{' '}
                    <span className="font-semibold">
                      {materialInData[`${selectedItem.backorder_number}-${selectedItem.mpn}`]?.material_in_quantity || 0}
                    </span>
                  </li>
                </ul>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 shadow-sm text-sm font-medium"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm text-sm font-medium"
                    onClick={confirmUpdate}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

          {showEditLocationModal && selectedItem && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Location</h2>
                <p className="text-gray-600 text-sm font-medium">
                  Previous Location: {selectedItem.location}
                </p>
                <input
                  value={newLocationPath}
                  onChange={handleLocationChange}
                  onInput={(e) => handleLocationSearch(e.target.value)}
                  type="text"
                  placeholder="Enter new location path"
                  className="w-full border border-gray-200 p-2 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 mt-4 transition-all duration-200 shadow-sm text-sm uppercase"
                  list="location-options"
                />
                <datalist id="location-options">
                  {filteredLocationOptions.map((option, index) => (
                    <option key={index} value={option.value} />
                  ))}
                </datalist>
                {!newLocationPath && (
                  <p className="text-red-600 text-sm mt-1">Please enter a valid location path</p>
                )}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors duration-200 shadow-sm text-sm font-medium"
                    onClick={handleCancelLocationClick}
                  >
                    Cancel
                  </button>
                  <button
                    className={`bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-sm text-sm font-medium ${!newLocationPath ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleSaveLocationClick}
                    disabled={!newLocationPath}
                  >
                    Save
                  </button>
                </div>
                {isSaveLocationModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Save</h3>
                      <p className="text-gray-600 text-sm">
                        Please confirm: Do you want to update the location to{' '}
                        <span className="font-semibold">{newLocationPath}</span>?
                      </p>
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 shadow-sm text-sm font-medium flex items-center gap-2"
                          onClick={() => setIsSaveLocationModalOpen(false)}
                        >
                          <span>✖</span> Cancel
                        </button>
                        <button
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-sm text-sm font-medium flex items-center gap-2"
                          onClick={confirmSaveLocation}
                        >
                          <span>✔</span> Confirm
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {isCancelLocationModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Cancel</h3>
                      <p className="text-gray-600 text-sm">
                        Are you sure you want to cancel? Any unsaved changes will be lost.
                      </p>
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 shadow-sm text-sm font-medium"
                          onClick={() => setIsCancelLocationModalOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors duration-200 shadow-sm text-sm font-medium"
                          onClick={confirmCancelLocation}
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackorderMaterialInPage;