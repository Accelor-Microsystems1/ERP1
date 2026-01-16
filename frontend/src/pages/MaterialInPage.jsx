import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPurchaseOrders, fetchPurchaseOrderComponents, updateMaterialIn, updateNonCOCLocation, fetchAllLocations } from '../utils/api';

const MaterialInPage = () => {
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [components, setComponents] = useState([]);
  const [filteredPos, setFilteredPos] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [materialInData, setMaterialInData] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [newLocationPath, setNewLocationPath] = useState('');
  const [allLocations, setAllLocations] = useState([]);
  const [filteredLocationOptions, setFilteredLocationOptions] = useState([]);
  const [isSaveLocationModalOpen, setIsSaveLocationModalOpen] = useState(false);
  const [isCancelLocationModalOpen, setIsCancelLocationModalOpen] = useState(false);
  const [locationUpdated, setLocationUpdated] = useState(new Set());
  const [backorderReturnSelections, setBackorderReturnSelections] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [poResponse, componentsResponse, locationsResponse] = await Promise.all([
        fetchPurchaseOrders().catch(err => {
          console.error("Failed to fetch purchase orders:", err);
          return [];
        }),
        fetchPurchaseOrderComponents().catch(err => {
          console.error("Failed to fetch components:", err);
          setError("Unable to load component data. Some features may be limited.");
          return [];
        }),
        fetchAllLocations().catch(err => {
          console.error("Failed to fetch locations:", err);
          return [];
        }),
      ]);

      console.log("Purchase Orders Response:", poResponse);
      console.log("Components Response:", componentsResponse);
      console.log("Locations Response:", locationsResponse);

      if (!poResponse || poResponse.length === 0) {
        console.warn("No purchase orders found in the response.");
        setError("No purchase orders found.");
        setLoading(false);
        return;
      }

      const validData = poResponse.filter(item => 
        item.po_number && item.status && (
          ['qc cleared', 'backordered', 'returned', 'backordered and returned'].includes(item.status.toLowerCase()) ||
          item.status.toLowerCase().includes('warehouse') ||
          item.status.toLowerCase().includes('backordered')
        )
      );
      if (validData.length === 0) {
        setError("No valid purchase orders found for Material In.");
        setLoading(false);
        return;
      }

      const componentMap = new Map(componentsResponse.length > 0 ? 
        componentsResponse.map(comp => [comp.po_number + comp.mpn, comp]) : []
      );
      const formattedComponents = validData.map(item => {
        const key = item.po_number + item.mpn;
        const compData = componentMap.get(key) || {};
        return {
          ...item,
          location: compData.location || item.location || 'N/A',
          mrr_no: item.mrr_no || '-',
          component_id: compData.component_id || item.component_id || null,
          note: item.note || '-',
          failed_quantity: item.failed_quantity || 0,
          status: item.status || 'Unknown',
        };
      });

      // Group components by PO to determine PO status
      const poComponentMap = new Map();
      formattedComponents.forEach(comp => {
        if (!poComponentMap.has(comp.po_number)) {
          poComponentMap.set(comp.po_number, []);
        }
        poComponentMap.get(comp.po_number).push(comp);
      });

      const poMap = new Map();
      validData.forEach((item) => {
        const key = item.po_number;
        if (!poMap.has(key)) {
          const comps = poComponentMap.get(key) || [];
          let poStatus = item.status || 'Unknown';
          // Check if any component is QC Cleared
          const anyQCCleared = comps.some(comp => comp.status.toLowerCase() === 'qc cleared');
          if (anyQCCleared) {
            poStatus = 'QC Cleared';
          } else {
            // Check if all components have the same status
            const allSameStatus = comps.length > 0 && comps.every(comp => 
              comp.status.toLowerCase() === comps[0].status.toLowerCase()
            );
            if (allSameStatus && comps.length > 0) {
              poStatus = comps[0].status;
            }
          }
          poMap.set(key, {
            po_number: item.po_number,
            mrf_no: item.mrf_no || '-',
            vendor_name: item.vendor_name || '-',
            status: poStatus,
          });
        }
      });

      const poList = Array.from(poMap.values()).sort((a, b) => {
        const poA = a.po_number || '';
        const poB = b.po_number || '';
        return poB.localeCompare(poA);
      });

      setPurchaseOrders(poList);
      setFilteredPos(poList);
      setComponents(formattedComponents);
      setFilteredComponents(formattedComponents);

      const locationOptions = locationsResponse.map(loc => ({
        value: loc.path || loc.location_path || '',
      })).filter(loc => loc.value);
      setAllLocations(locationOptions);
      setFilteredLocationOptions(locationOptions);

      const initialData = {};
      validData.forEach(item => {
        const key = `${item.po_number}-${item.mpn}`;
        initialData[key] = {
          showInput: false,
          material_in_quantity: item.material_in_quantity || '0',
        };
      });
      setMaterialInData(initialData);

      const initialSelections = {};
      formattedComponents.forEach(comp => {
        const key = `${comp.po_number}-${comp.mpn}`;
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

  const applyFilters = (term) => {
    let filteredPoList = [...purchaseOrders];
    let filteredComponentsList = [...components];

    if (term) {
      const searchTermLower = term.toLowerCase();
      filteredPoList = filteredPoList.filter((po) =>
        po.po_number.toLowerCase().includes(searchTermLower)
      );
      filteredComponentsList = filteredComponentsList.filter((component) =>
        filteredPoList.some((po) => po.po_number === component.po_number)
      );
    }

    setFilteredPos(filteredPoList);
    setFilteredComponents(filteredComponentsList);
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

  const handleMaterialInClick = (component) => {
    const key = `${component.po_number}-${component.mpn}`;
    setMaterialInData((prev) => ({
      ...prev,
      [key]: { ...prev[key], showInput: !prev[key]?.showInput },
    }));
  };

  const handleInputChange = (component, field, value) => {
    const key = `${component.po_number}-${component.mpn}`;
    let updatedValue = value;

    if (field === 'material_in_quantity') {
      const maxQuantity = parseFloat(component.updated_requested_quantity) || 0;
      updatedValue = Math.min(parseFloat(value) || 0, maxQuantity);
    }

    setMaterialInData((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: updatedValue },
    }));
  };

  const handleUpdateClick = (component) => {
    setSelectedComponent(component);
    setShowModal(true);
  };

  const confirmUpdate = async () => {
    if (!selectedComponent) return;
    const key = `${selectedComponent.po_number}-${selectedComponent.mpn}`;
    const data = materialInData[key] || {};

    try {
      await updateMaterialIn({
        po_number: selectedComponent.po_number,
        mpn: selectedComponent.mpn,
        material_in_quantity: data.material_in_quantity || 0,
        mrf_no: selectedComponent.mrf_no || null,
      });

      // Update local state to reflect changes immediately
      setComponents(prev =>
        prev.map(comp =>
          comp.po_number === selectedComponent.po_number && comp.mpn === selectedComponent.mpn
            ? { ...comp, material_in_quantity: data.material_in_quantity || 0 }
            : comp
        )
      );
      setFilteredComponents(prev =>
        prev.map(comp =>
          comp.po_number === selectedComponent.po_number && comp.mpn === selectedComponent.mpn
            ? { ...comp, material_in_quantity: data.material_in_quantity || 0 }
            : comp
        )
      );

      // Update PO status based on new component statuses
      const poComponents = components.filter(comp => comp.po_number === selectedComponent.po_number);
      const anyQCCleared = poComponents.some(comp => comp.status.toLowerCase() === 'qc cleared');
      const allSameStatus = poComponents.every(comp => 
        comp.status.toLowerCase() === poComponents[0].status.toLowerCase()
      );
      const newPoStatus = anyQCCleared ? 'QC Cleared' : (allSameStatus && poComponents.length > 0 ? poComponents[0].status : selectedPo.status);

      setPurchaseOrders(prev =>
        prev.map(po =>
          po.po_number === selectedComponent.po_number
            ? { ...po, status: newPoStatus }
            : po
        )
      );
      setFilteredPos(prev =>
        prev.map(po =>
          po.po_number === selectedComponent.po_number
            ? { ...po, status: newPoStatus }
            : po
        )
      );

      setMaterialInData((prev) => ({
        ...prev,
        [key]: {
          showInput: false,
          material_in_quantity: data.material_in_quantity || 0,
        },
      }));
      setSuccessMessage(`Material In for component ${selectedComponent.mpn} has been successfully completed.`);
      setShowSuccessModal(true);
      setShowModal(false);
      setSelectedComponent(null);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError('Failed to update material in: ' + errorMessage);
    }
  };

  const openEditLocationModal = (component) => {
    if (!component.component_id) {
      setError('Component ID is missing. Unable to edit location.');
      return;
    }
    setSelectedComponent(component);
    setNewLocationPath('');
    const currentLocationOption = component.location && component.location !== 'N/A'
      ? [{ value: component.location }]
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
    if (!newLocationPath || !selectedComponent?.component_id) {
      setError('Missing required info: location path or component ID');
      return;
    }
    try {
      await updateNonCOCLocation(selectedComponent.component_id, newLocationPath);
      const key = `${selectedComponent.po_number}-${selectedComponent.mpn}`;
      setLocationUpdated(prev => new Set(prev).add(key));

      // Update local state to reflect location change
      setComponents(prev =>
        prev.map(comp =>
          comp.po_number === selectedComponent.po_number && comp.mpn === selectedComponent.mpn
            ? { ...comp, location: newLocationPath }
            : comp
        )
      );
      setFilteredComponents(prev =>
        prev.map(comp =>
          comp.po_number === selectedComponent.po_number && comp.mpn === selectedComponent.mpn
            ? { ...comp, location: newLocationPath }
            : comp
        )
      );

      setShowEditLocationModal(false);
      setIsSaveLocationModalOpen(false);
      setNewLocationPath('');
      setSelectedComponent(null);
    } catch (err) {
      setError('Failed to update location: ' + (err.response?.data?.error || err.message));
    }
  };

  const confirmCancelLocation = () => {
    setIsCancelLocationModalOpen(false);
    setShowEditLocationModal(false);
    setNewLocationPath('');
    setSelectedComponent(null);
  };

  const handleBackorderReturnChange = (component, type, checked) => {
    const key = `${component.po_number}-${component.mpn}`;
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
    const selectedComponents = filteredComponents.filter(comp => {
      const key = `${comp.po_number}-${comp.mpn}`;
      const orderedQty = parseFloat(comp.updated_requested_quantity) || 0;
      const receivedQty = parseFloat(comp.received_quantity) || 0;
      const isEligibleForBackorder = orderedQty > receivedQty;
      return backorderReturnSelections[key]?.backorder && isEligibleForBackorder;
    });

    if (selectedComponents.length === 0) {
      setError("No components eligible for backorder selected (ensure components are selected and ordered quantity exceeds received quantity).");
      return;
    }

    navigate('/backorder', { state: { components: selectedComponents } });
  };

  const handleCreateReturn = () => {
    const selectedComponents = filteredComponents.filter(comp => {
      const key = `${comp.po_number}-${comp.mpn}`;
      return backorderReturnSelections[key]?.return && comp.failed_quantity > 0;
    });
    if (selectedComponents.length === 0) {
      setError("No components selected for return with failed quantity.");
      return;
    }
    navigate('/return', { state: { components: selectedComponents } });
  };

  const displayValue = (value) => {
    return value == null || value === '' ? '-' : value;
  };

  const isMaterialInDone = (component) => {
    return (component.material_in_quantity || 0) > 0;
  };

  const isLocationUpdated = (component) => {
    const key = `${component.po_number}-${component.mpn}`;
    return locationUpdated.has(key);
  };

  const isMaterialInCompletedForPO = (po) => {
    const poComponents = components.filter(comp => comp.po_number === po.po_number);
    if (poComponents.length === 0) return false;
    return poComponents.every(comp => isMaterialInDone(comp));
  };

  return (
    <div className="min-h-screen p-12 bg-gray-50 flex flex-col font-sans">
      <div className="container mx-auto px-4 py-6 max-w-7xl flex-1 overflow-y-auto">
        <div className="bg-white shadow-md rounded-xl p-6 flex flex-col h-[calc(100vh-4rem)]">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Material In</h1>

          {/* Optimized Flash Cards */}
          {!selectedPo && (
            <div className="mb-4 flex flex-row gap-3 overflow-x-auto pb-2">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg shadow-sm text-blue-600 text-xs sm:text-sm font-medium flex-1 min-w-[200px]">
                Material In button disabled if completed.
              </div>
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg shadow-sm text-purple-600 text-xs sm:text-sm font-medium flex-1 min-w-[200px]">
                Edit Location updates component storage.
              </div>
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg shadow-sm text-green-600 text-xs sm:text-sm font-medium flex-1 min-w-[200px]">
                ✔ Icon: All components’ Material In done.
              </div>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-4 items-center">
            <input
              value={searchTerm}
              onChange={handleSearchChange}
              type="text"
              placeholder="Search by PO Number"
              className="p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-full sm:w-80 transition-all duration-200 shadow-sm text-sm font-medium"
            />
            {selectedPo && (
              <button
                onClick={handleBackToPoList}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md text-sm font-medium"
              >
                Back to PO List
              </button>
            )}
          </div>

          {error && <div className="text-red-600 mb-6 text-sm font-medium">{error}</div>}

          {loading ? (
            <div className="text-center text-gray-600 text-sm font-medium">Loading...</div>
          ) : selectedPo ? (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Components for PO: {selectedPo.po_number}</h2>
              <div className="mb-4 flex gap-4">
                <button
                  onClick={handleCreateBackorder}
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 shadow-md text-sm font-medium"
                >
                  Create Backorder
                </button>
                <button
                  onClick={handleCreateReturn}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-md text-sm font-medium"
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
                    {filteredComponents.length === 0 ? (
                      <tr>
                        <td colSpan="19" className="border border-gray-200 p-3 text-center text-gray-600">
                          No components found for this PO
                        </td>
                      </tr>
                    ) : (
                      filteredComponents.map((component) => {
                        const key = `${component.po_number}-${component.mpn}`;
                        const data = materialInData[key] || {};
                        const selections = backorderReturnSelections[key] || { backorder: false, return: false };
                        const materialInDone = isMaterialInDone(component);
                        const locationIsUpdated = isLocationUpdated(component);
                        const orderedQty = parseFloat(component.updated_requested_quantity) || 0;
                        const receivedQty = parseFloat(component.received_quantity) || 0;
                        const isEligibleForBackorder = orderedQty > receivedQty;
                        const isEligibleForReturn = component.failed_quantity > 0;

                        return (
                          <tr key={key} className="hover:bg-gray-50 transition-colors duration-150">
                            <td className="border border-gray-200 p-3">{displayValue(component.mpn)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.item_description)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.make_received)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.part_no)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.date_code)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.lot_code)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.uom)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.updated_requested_quantity)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.material_in_quantity)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.received_quantity)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.passed_quantity)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.failed_quantity)}</td>
                            <td className="border border-gray-200 p-3">
                              {(isEligibleForBackorder || isEligibleForReturn) ? (
                                <div className="flex gap-2">
                                  {isEligibleForBackorder && (
                                    <label className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={selections.backorder}
                                        onChange={(e) => handleBackorderReturnChange(component, 'backorder', e.target.checked)}
                                        className="mr-1 h-4 w-4 text-orange-600 rounded focus:ring-orange-500"
                                      />
                                      Backorder
                                    </label>
                                  )}
                                  {isEligibleForReturn && (
                                    <label className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={selections.return}
                                        onChange={(e) => handleBackorderReturnChange(component, 'return', e.target.checked)}
                                        className="mr-1 h-4 w-4 text-red-600 rounded focus:ring-red-500"
                                      />
                                      Return
                                    </label>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="border border-gray-200 p-3">
                              {component.coc_received ? 'Yes' : 'No'}
                            </td>
                            <td className="border border-gray-200 p-3">{displayValue(component.location)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.mrr_no)}</td>
                            <td className="border border-gray-200 p-3">{displayValue(component.note)}</td>
                            <td className="border border-gray-200 p-3">
                              <span
                                className={`px-2 py-1 rounded text-sm font-medium ${
                                  component.status.toLowerCase() === 'qc cleared'
                                    ? 'bg-green-100 text-green-800'
                                    : component.status.toLowerCase().includes('backordered')
                                    ? 'bg-orange-100 text-orange-800'
                                    : component.status.toLowerCase() === 'backordered and returned'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : component.status.toLowerCase() === 'returned'
                                    ? 'bg-red-100 text-red-800'
                                    : component.status.toLowerCase().includes('warehouse')
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {component.status}
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
                                  onClick={() => handleMaterialInClick(component)}
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
                                  onClick={() => openEditLocationModal(component)}
                                  disabled={locationIsUpdated}
                                >
                                  Edit Location
                                </button>
                                {data.showInput && !materialInDone && (
                                  <div className="mt-2 flex flex-col gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max={component.updated_requested_quantity || 0}
                                      value={data.material_in_quantity || ''}
                                      onChange={(e) => handleInputChange(component, 'material_in_quantity', e.target.value)}
                                      className="border border-gray-200 p-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-full transition-all duration-200 shadow-sm text-sm"
                                      placeholder="Material In Qty"
                                    />
                                    <button
                                      className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition-colors duration-200 shadow-sm text-sm font-medium"
                                      onClick={() => handleUpdateClick(component)}
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
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">PO Number</th>
                    <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">MRF No</th>
                    <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Vendor</th>
                    <th className="border border-gray-200 p-3 font-semibold text-gray-700 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPos.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="border border-gray-200 p-3 text-center text-gray-600">
                        No purchase orders found for material in
                      </td>
                    </tr>
                  ) : (
                    filteredPos.map((po) => (
                      <tr
                        key={po.po_number}
                        onClick={() => handlePoClick(po)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                      >
                        <td className="border border-gray-200 p-3">
                          {po.po_number}
                          {isMaterialInCompletedForPO(po) && (
                            <span
                              className="ml-2 text-green-600 text-sm relative group"
                              title="Material In Completed for All Components"
                            >
                              ✔
                              <span className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 -mt-8 -ml-10">
                                Material In Completed for All Components
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="border border-gray-200 p-3">{po.mrf_no}</td>
                        <td className="border border-gray-200 p-3">{po.vendor_name}</td>
                        <td className="border border-gray-200 p-3">
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              po.status.toLowerCase() === 'qc cleared'
                                ? 'bg-green-100 text-green-800'
                                : po.status.toLowerCase().includes('backordered')
                                ? 'bg-orange-100 text-orange-800'
                                : po.status.toLowerCase() === 'backordered and returned'
                                ? 'bg-yellow-100 text-yellow-800'
                                : po.status.toLowerCase() === 'returned'
                                ? 'bg-red-100 text-red-800'
                                : po.status.toLowerCase().includes('warehouse')
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showModal && selectedComponent && (
            <div className="fixed inset-0 bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Confirm Material In</h2>
                <p className="text-gray-600 text-sm">
                  Are you sure you want to update the material in for PO{' '}
                  <span className="font-semibold">{selectedComponent.po_number}</span> (MPN:{' '}
                  <span className="font-semibold">{selectedComponent.mpn}</span>) with the following details?
                </p>
                <ul className="mt-3 text-gray-600 text-sm">
                  <li>
                    Material In Quantity:{' '}
                    <span className="font-semibold">
                      {materialInData[`${selectedComponent.po_number}-${selectedComponent.mpn}`]?.material_in_quantity || 0}
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

          {showSuccessModal && (
            <div className="fixed inset-0 bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Success</h2>
                <p className="text-gray-600 text-sm">{successMessage}</p>
                <div className="mt-6 flex justify-end">
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm text-sm font-medium"
                    onClick={() => setShowSuccessModal(false)}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {showEditLocationModal && selectedComponent && (
            <div className="fixed inset-0 bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Location</h2>
                <p className="text-gray-600 text-sm font-medium">
                  Previous Location: {selectedComponent.location}
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
                  <div className="fixed inset-0 bg-opacity-30 flex items-center justify-center z-50">
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
                  <div className="fixed inset-0 bg-opacity-30 flex items-center justify-center z-50">
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

export default MaterialInPage;