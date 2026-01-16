import React, { useState, useEffect, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchQualityInspectionComponents, fetchBackorderQualityInspectionComponents, updateQualityInspectionStatus, fetchCheckpoints } from '../utils/api';
import { Modal, Input } from 'antd';
import { v4 as uuidv4 } from 'uuid';

class ErrorBoundary extends Component {
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

const QualityInspection = () => {
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
  const [expandedRows, setExpandedRows] = useState({});
  const [quantityErrors, setQuantityErrors] = useState({});
  const [matchErrors, setMatchErrors] = useState({});
  const [componentData, setComponentData] = useState({});
  const [cocReceived, setCocReceived] = useState({});
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [currentNote, setCurrentNote] = useState({});
  const [noteErrors, setNoteErrors] = useState({});
  const [checkpoints, setCheckpoints] = useState([]);
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
        const [poResponse, backorderResponse, checkpointsResponse] = await Promise.all([
          fetchQualityInspectionComponents(),
          fetchBackorderQualityInspectionComponents(),
          fetchCheckpoints()
        ]);

        // Ensure valid data and add source identifier
        const validPoData = poResponse.data
          .filter(item => item.po_number)
          .map(item => ({ ...item, source: 'main' }));
        const validBackorderData = backorderResponse.data
          .filter(item => item.po_number && item.backorder_sequence)
          .map(item => ({ ...item, source: 'backorder' }));

        // Combine both main PO and backorder data
        const combinedData = [...validPoData, ...validBackorderData];

        // Create a unique list of POs for the PO list view
        const poMap = new Map();
        combinedData.forEach((item) => {
          const key = `${item.po_number}-${item.backorder_sequence || 'main'}`; // Unique key for PO and backorder
          if (!poMap.has(key)) {
            poMap.set(key, {
              po_number: item.po_number,
              mrf_no: item.mrf_no || '-',
              vendor_name: item.vendor_name || '-',
              status: item.status || '-',
              backorder_sequence: item.source === 'backorder' ? item.backorder_sequence : null,
              source: item.source
            });
          }
        });

        const poList = Array.from(poMap.values());
        setPos(poList);
        setFilteredPos(poList);
        setComponents(combinedData);
        setCheckpoints(checkpointsResponse);
        setFilteredComponents(combinedData);

        // Initialize componentData, cocReceived, and currentNote with unique keys
        const initialData = {};
        const initialCoc = {};
        const initialNotes = {};
        combinedData.forEach(item => {
          const key = `${item.po_number}-${item.mpn}-${item.backorder_sequence || 'main'}`;
          initialData[key] = {
            receivedMPN: item.received_mpn || '',
            receivedMake: item.received_make || '',
            dateCode: item.date_code || '',
            lotCode: item.lot_code || '',
            receivedQty: item.received_quantity || '',
            passedQty: item.passed_quantity || '',
            failedQty: item.failed_quantity || '0',
          };
          initialCoc[key] = item.coc_received || false;
          initialNotes[key] = item.note || '';
        });
        setComponentData(initialData);
        setCocReceived(initialCoc);
        setCurrentNote(initialNotes);

        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to fetch quality inspection components');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getApplicableCheckpoints = (part_no) => {
    if (!part_no) return checkpoints.filter(cp => cp.product_categories === 'General');
    
    const firstDigit = part_no.charAt(0);
    let category;
    switch (firstDigit) {
      case '1':
      case '8':
        category = 'Electronics';
        break;
      case '9':
      case '2':
        category = 'Mechanical';
        break;
      case '4':
        category = 'Consumable';
        break;
      case '6':
        category = 'Tool and Equipment';
        break;
      default:
        category = 'General';
    }
    
    return checkpoints.filter(cp => 
      cp.product_categories === category || 
      cp.product_categories === 'General'
    );
  };

  const getAllApplicableCheckpointsForPo = () => {
    if (!selectedPo || !filteredComponents.length) return [];

    const allCheckpoints = new Set();
    filteredComponents.forEach(component => {
      const applicableCheckpoints = getApplicableCheckpoints(component.part_no);
      applicableCheckpoints.forEach(point => {
        allCheckpoints.add(JSON.stringify(point));
      });
    });

    return Array.from(allCheckpoints).map(item => JSON.parse(item));
  };

  const applyFilters = (term) => {
    let filteredPoList = [...pos];
    let filteredComponentsList = [...components];

    if (term) {
      const searchTermLower = term.toLowerCase();
      filteredPoList = filteredPoList.filter((po) =>
        po.po_number.toLowerCase().includes(searchTermLower)
      );
      filteredComponentsList = filteredComponentsList.filter((component) =>
        filteredPoList.some((po) => 
          po.po_number === component.po_number && 
          (po.backorder_sequence === component.backorder_sequence || 
           (!po.backorder_sequence && !component.backorder_sequence))
        )
      );
    }

    filteredPoList.sort((a, b) => {
      const statusA = a.status || '';
      const statusB = b.status || '';
      const targetStatus = 'Material Delivered & Quality Check Pending';

      if (statusA === targetStatus && statusB !== targetStatus) return -1;
      if (statusB === targetStatus && statusA !== targetStatus) return 1;

      const poA = a.po_number || '';
      const poB = b.po_number || '';
      return poA.localeCompare(poB);
    });
    
    setFilteredPos(filteredPoList);
    setFilteredComponents(filteredComponentsList);
    if (selectedPo) {
      setFilteredComponents(
        filteredComponentsList.filter((component) => 
          component.po_number === selectedPo.po_number && 
          (component.backorder_sequence === selectedPo.backorder_sequence || 
           (!component.backorder_sequence && !selectedPo.backorder_sequence))
        )
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
      (component) =>
        component.po_number === po.po_number &&
        (component.backorder_sequence === po.backorder_sequence || 
         (!component.backorder_sequence && !po.backorder_sequence))
    );
    setFilteredComponents(relatedComponents);
  };

  const handleBackToPoList = () => {
    setSelectedPo(null);
    setFilteredComponents(components);
    applyFilters(searchTerm);
    setExpandedRows({});
  };

  const handleGenerateMRR = () => {
    if (!selectedPo) {
      setError('Please select a Purchase Order to generate MRR.');
      return;
    }
    navigate('/quality-inspection-components', { state: { poNumber: selectedPo.po_number } });
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === "N/A") return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).replace(/\//g, '/');
  };

  const toggleRowExpansion = (key) => {
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleInputChange = (component, field, value) => {
    const key = `${component.po_number}-${component.mpn}-${component.backorder_sequence || 'main'}`;
    const orderedQty = parseFloat(component.updated_requested_quantity) || 0;
    const currentData = componentData[key] || {};

    let newQuantityErrors = { ...quantityErrors };
    let newMatchErrors = { ...matchErrors };

    if (field === 'receivedMPN') {
      if (value && value !== component.mpn) {
        newMatchErrors[key] = { ...newMatchErrors[key], receivedMPN: 'Must match original MPN' };
      } else {
        newMatchErrors[key] = { ...newMatchErrors[key], receivedMPN: '' };
      }
    }

    if (field === 'receivedMake') {
      if (value && value !== component.make) {
        newMatchErrors[key] = { ...newMatchErrors[key], receivedMake: 'Must match original Make' };
      } else {
        newMatchErrors[key] = { ...newMatchErrors[key], receivedMake: '' };
      }
    }

    if (field === 'receivedQty') {
      const receivedQty = parseFloat(value) || 0;
      if (receivedQty > orderedQty) {
        newQuantityErrors[key] = { ...newQuantityErrors[key], receivedQty: 'Cannot exceed Ordered Quantity' };
      } else {
        newQuantityErrors[key] = { ...newQuantityErrors[key], receivedQty: '' };
        const passedQty = parseFloat(currentData.passedQty) || 0;
        if (passedQty > receivedQty) {
          newQuantityErrors[key] = { ...newQuantityErrors[key], passedQty: 'Cannot exceed Received Quantity' };
        } else {
          newQuantityErrors[key] = { ...newQuantityErrors[key], passedQty: '' };
        }
      }
    }

    if (field === 'passedQty') {
      const passedQty = parseFloat(value) || 0;
      const receivedQty = parseFloat(currentData.receivedQty) || 0;
      if (passedQty > receivedQty) {
        newQuantityErrors[key] = { ...newQuantityErrors[key], passedQty: 'Cannot exceed Received Quantity' };
      } else {
        newQuantityErrors[key] = { ...newQuantityErrors[key], passedQty: '' };
      }
      const failedQty = receivedQty - passedQty >= 0 ? (receivedQty - passedQty).toString() : '0';
      setComponentData(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          failedQty,
        },
      }));
    }

    setQuantityErrors(newQuantityErrors);
    setMatchErrors(newMatchErrors);
    setComponentData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleCocChange = (component, checked) => {
    const key = `${component.po_number}-${component.mpn}-${component.backorder_sequence || 'main'}`;
    setCocReceived(prev => ({
      ...prev,
      [key]: checked,
    }));
  };

  const handleNoteChange = (component, value) => {
    const key = `${component.po_number}-${component.mpn}-${component.backorder_sequence || 'main'}`;
    setCurrentNote(prev => ({
      ...prev,
      [key]: value,
    }));
    setNoteErrors(prev => ({
      ...prev,
      [key]: '',
    }));
  };

  const showNoteModal = (component) => {
    const key = `${component.po_number}-${component.mpn}-${component.backorder_sequence || 'main'}`;
    setEditingComponent(component);
    setNoteModalVisible(true);
    setCurrentNote(prev => ({
      ...prev,
      [key]: prev[key] || '',
    }));
  };

  const handleStatusUpdate = async (component) => {
    const key = `${component.po_number}-${component.mpn}-${component.backorder_sequence || 'main'}`;
    const quantityErrorsForKey = quantityErrors[key] || {};
    const matchErrorsForKey = matchErrors[key] || {};
    const note = currentNote[key] || '';

    if (['QC Hold', 'QC Rejected'].includes(newStatus) && !note.trim()) {
      setNoteErrors(prev => ({
        ...prev,
        [key]: 'Note is required for QC Hold or QC Rejected status',
      }));
      setError('Please provide a note for QC Hold or QC Rejected status.');
      return;
    }

    if (quantityErrorsForKey.receivedQty || quantityErrorsForKey.passedQty) {
      setError('Please resolve quantity errors before saving.');
      return;
    }

    if (matchErrorsForKey.receivedMPN || matchErrorsForKey.receivedMake) {
      setError('Please resolve MPN and Make matching errors before saving.');
      return;
    }

    try {
      const updatedData = componentData[key] || {};
      await updateQualityInspectionStatus({
        po_number: component.po_number,
        mpn: component.mpn,
        status: newStatus,
        received_mpn: updatedData.receivedMPN || '',
        received_make: updatedData.receivedMake || '',
        date_code: updatedData.dateCode || '',
        lot_code: updatedData.lotCode || '',
        received_quantity: updatedData.receivedQty || '',
        passed_quantity: updatedData.passedQty || '',
        failed_quantity: updatedData.failedQty || '0',
        coc_received: cocReceived[key] || false,
        note: note || '',
        source: component.source,
        backorder_sequence: component.backorder_sequence || null,
      });

      const updatedComponents = components.map((item) =>
        item.po_number === component.po_number &&
        item.mpn === component.mpn &&
        item.backorder_sequence === component.backorder_sequence
          ? {
              ...item,
              status: newStatus,
              received_mpn: updatedData.receivedMPN || '',
              received_make: updatedData.receivedMake || '',
              date_code: updatedData.dateCode || '',
              lot_code: updatedData.lotCode || '',
              received_quantity: updatedData.receivedQty || '',
              passed_quantity: updatedData.passedQty || '',
              failed_quantity: updatedData.failedQty || '0',
              coc_received: cocReceived[key] || false,
              note: note || '',
            }
          : item
      );
      setComponents(updatedComponents);
      setFilteredComponents(
        updatedComponents.filter((item) => 
          item.po_number === selectedPo.po_number && 
          (item.backorder_sequence === selectedPo.backorder_sequence || 
           (!item.backorder_sequence && !selectedPo.backorder_sequence))
        )
      );

      setEditingComponent(null);
      setNewStatus('');
      setMatchErrors(prev => ({ ...prev, [key]: {} }));
      setNoteModalVisible(false);
      setNoteErrors(prev => ({ ...prev, [key]: '' }));
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update status';
      setError(errorMessage);
    }
  };

  const showConfirmModal = (component) => {
    const key = `${component.po_number}-${component.mpn}-${component.backorder_sequence || 'main'}`;
    const quantityErrorsForKey = quantityErrors[key] || {};
    const matchErrorsForKey = matchErrors[key] || {};
    const note = currentNote[key] || '';

    if (['QC Hold', 'QC Rejected'].includes(newStatus) && !note.trim()) {
      setNoteErrors(prev => ({
        ...prev,
        [key]: 'Note is required for QC Hold or QC Rejected status',
      }));
      setError('Please provide a note for QC Hold or QC Rejected status.');
      return;
    }

    if (quantityErrorsForKey.receivedQty || quantityErrorsForKey.passedQty) {
      setError('Please resolve quantity errors before saving.');
      return;
    }

    if (matchErrorsForKey.receivedMPN || matchErrorsForKey.receivedMake) {
      setError('Please resolve MPN and Make matching errors before saving.');
      return;
    }

    setError(null);
    setIsModalVisible(true);
  };

  const confirmStatusUpdate = (component) => {
    handleStatusUpdate(component);
    setIsModalVisible(false);
  };

  const handleEditClick = (component) => {
    setEditingComponent(component);
    setNewStatus(component.status || '');
  };

  const handleCancelEdit = () => {
    setEditingComponent(null);
    setNewStatus('');
    setQuantityErrors({});
    setMatchErrors({});
    setNoteErrors({});
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 overflow-y-auto elegant-bg">
        <div className="max-w-full mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-lg p-10 min-h-[90vh]">
            <h1 className="text-4xl font-bold text-gray-800 border-l-4 border-indigo-600 pl-4 mb-8">
              Quality Inspection Components
            </h1>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-8">
                {error}
              </div>
            )}

            <div className="mb-8 flex flex-wrap gap-4 items-center">
              <input
                value={searchTerm}
                onChange={handleSearchChange}
                type="text"
                placeholder="Search by PO Number"
                className="p-3 border rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 w-80 transition-all duration-200 shadow-sm"
              />
              {selectedPo && (
                <div className="flex gap-4">
                  <button
                    onClick={handleBackToPoList}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-sm"
                  >
                    Back to PO List
                  </button>
                  <button
                    onClick={handleGenerateMRR}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
                  >
                    Generate MRR
                  </button>
                </div>
              )}
            </div>

            <div className="relative table-container">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-20">
                  <svg className="animate-spin h-10 w-10 text-indigo-600" viewBox="0 0 24 24">
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
                  <h2 className="text-2xl font-semibold text-gray-700 mb-6">
                    PO No: {selectedPo.po_number} | Backorder No: {selectedPo.backorder_sequence || 'Main'}
                  </h2>
                  <div className="table-wrapper">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Description
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            MPN
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Part No
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Make
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Ordered Qty
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            UoM
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Delivery Date
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Received MPN
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Received Make
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Date Code
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Lot Code
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Received Qty
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Passed Qty
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Failed Qty
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Status
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Action
                          </th>
                          <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                            Note
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredComponents.length === 0 && !loading ? (
                          <tr>
                            <td
                              colSpan="17"
                              className="px-8 py-6 text-center text-gray-500 text-lg"
                            >
                              No components found for this PO
                            </td>
                          </tr>
                        ) : (
                          filteredComponents.map((item) => {
                            const key = `${item.po_number}-${item.mpn}-${item.backorder_sequence || 'main'}`;
                            const data = componentData[key] || {};
                            const quantityErrorsForKey = quantityErrors[key] || {};
                            const matchErrorsForKey = matchErrors[key] || {};
                            const noteError = noteErrors[key] || '';
                            const applicableCheckpoints = getApplicableCheckpoints(item.part_no);
                            const isExpanded = expandedRows[key] || false;
                            return (
                              <React.Fragment key={key}>
                                <tr
                                  className={`hover:bg-indigo-50 transition-colors duration-200 ${
                                    item.source === 'backorder' ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {item.item_description || '-'}
                                    {item.source === 'backorder' && (
                                      <span className="ml-2 text-xs text-blue-600 font-medium">
                                        (Backorder: {item.backorder_sequence})
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {item.mpn || '-'}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {item.part_no || '-'}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {item.make || '-'}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {item.updated_requested_quantity || '-'}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {item.uom || '-'}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {formatDate(item.expected_delivery_date)}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {editingComponent && editingComponent.po_number === item.po_number && editingComponent.mpn === item.mpn && editingComponent.backorder_sequence === item.backorder_sequence ? (
                                      <div>
                                        <input
                                          type="text"
                                          value={data.receivedMPN || ''}
                                          onChange={(e) => handleInputChange(item, 'receivedMPN', e.target.value)}
                                          className={`p-2 border rounded-lg text-sm w-full transition-all duration-200 ${
                                            matchErrorsForKey.receivedMPN
                                              ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                              : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                                          }`}
                                        />
                                        {matchErrorsForKey.receivedMPN && (
                                          <p className="text-red-500 text-xs mt-1">{matchErrorsForKey.receivedMPN}</p>
                                        )}
                                      </div>
                                    ) : (
                                      data.receivedMPN || '-'
                                    )}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {editingComponent && editingComponent.po_number === item.po_number && editingComponent.mpn === item.mpn && editingComponent.backorder_sequence === item.backorder_sequence ? (
                                      <div>
                                        <input
                                          type="text"
                                          value={data.receivedMake || ''}
                                          onChange={(e) => handleInputChange(item, 'receivedMake', e.target.value)}
                                          className={`p-2 border rounded-lg text-sm w-full transition-all duration-200 ${
                                            matchErrorsForKey.receivedMake
                                              ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                              : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                                          }`}
                                        />
                                        {matchErrorsForKey.receivedMake && (
                                          <p className="text-red-500 text-xs mt-1">{matchErrorsForKey.receivedMake}</p>
                                        )}
                                      </div>
                                    ) : (
                                      data.receivedMake || '-'
                                    )}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {editingComponent && editingComponent.po_number === item.po_number && editingComponent.mpn === item.mpn && editingComponent.backorder_sequence === item.backorder_sequence ? (
                                      <input
                                        type="text"
                                        value={data.dateCode || ''}
                                        onChange={(e) => handleInputChange(item, 'dateCode', e.target.value)}
                                        className="p-2 border rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm w-full"
                                      />
                                    ) : (
                                      data.dateCode || '-'
                                    )}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {editingComponent && editingComponent.po_number === item.po_number && editingComponent.mpn === item.mpn && editingComponent.backorder_sequence === item.backorder_sequence ? (
                                      <input
                                        type="text"
                                        value={data.lotCode || ''}
                                        onChange={(e) => handleInputChange(item, 'lotCode', e.target.value)}
                                        className="p-2 border rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm w-full"
                                      />
                                    ) : (
                                      data.lotCode || '-'
                                    )}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {editingComponent && editingComponent.po_number === item.po_number && editingComponent.mpn === item.mpn && editingComponent.backorder_sequence === item.backorder_sequence ? (
                                      <div>
                                        <input
                                          type="number"
                                          value={data.receivedQty || ''}
                                          onChange={(e) => handleInputChange(item, 'receivedQty', e.target.value)}
                                          className={`p-2 border rounded-lg text-sm w-full transition-all duration-200 ${
                                            quantityErrorsForKey.receivedQty
                                              ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                              : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                                          }`}
                                          min="0"
                                        />
                                        {quantityErrorsForKey.receivedQty && (
                                          <p className="text-red-500 text-xs mt-1">{quantityErrorsForKey.receivedQty}</p>
                                        )}
                                      </div>
                                    ) : (
                                      data.receivedQty || '-'
                                    )}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {editingComponent && editingComponent.po_number === item.po_number && editingComponent.mpn === item.mpn && editingComponent.backorder_sequence === item.backorder_sequence ? (
                                      <div>
                                        <input
                                          type="number"
                                          value={data.passedQty || ''}
                                          onChange={(e) => handleInputChange(item, 'passedQty', e.target.value)}
                                          className={`p-2 border rounded-lg text-sm w-full transition-all duration-200 ${
                                            quantityErrorsForKey.passedQty
                                              ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                              : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                                          }`}
                                          min="0"
                                        />
                                        {quantityErrorsForKey.passedQty && (
                                          <p className="text-red-500 text-xs mt-1">{quantityErrorsForKey.passedQty}</p>
                                        )}
                                      </div>
                                    ) : (
                                      data.passedQty || '-'
                                    )}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {data.failedQty || '0'}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        item.status === 'QC Cleared'
                                          ? 'bg-green-100 text-green-800'
                                          : item.status === 'QC Rejected'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}
                                    >
                                      {item.status || '-'}
                                    </span>
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {editingComponent && editingComponent.po_number === item.po_number && editingComponent.mpn === item.mpn && editingComponent.backorder_sequence === item.backorder_sequence ? (
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-center gap-2">
                                          <select
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                            className="p-2 border rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm"
                                          >
                                            <option>Select Status</option>
                                            <option value="QC Cleared">QC Cleared</option>
                                            <option value="QC Rejected">QC Rejected</option>
                                            <option value="QC Hold">QC Hold</option>
                                          </select>
                                          <button
                                            onClick={() => showConfirmModal(item)}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 shadow-sm"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 shadow-sm"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                        <label className="flex items-center justify-center gap-2 text-sm text-gray-700">
                                          <input
                                            type="checkbox"
                                            checked={cocReceived[key] || false}
                                            onChange={(e) => handleCocChange(item, e.target.checked)}
                                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                          />
                                          CoC Received
                                        </label>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleEditClick(item)}
                                        className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors duration-200 shadow-sm"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                    <button
                                      onClick={() => showNoteModal(item)}
                                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 shadow-sm"
                                    >
                                      {currentNote[key] ? 'Edit Note' : 'Add Note'}
                                    </button>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="qc-points-container">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6">
                      Quality Control Points
                    </h3>
                    {getAllApplicableCheckpointsForPo().length > 0 ? (
                      <div className="space-y-4">
                        {getAllApplicableCheckpointsForPo().map((point) => (
                          <div
                            key={point.reference_no}
                            className="p-4 bg-white rounded-lg shadow-sm border border-gray-100"
                          >
                            <div className="flex flex-wrap gap-3 mb-3">
                              <span className="text-sm font-medium text-gray-600">
                                Reference No: <span className="text-gray-800">{point.reference_no}</span>
                              </span>
                              <span className="text-sm font-medium text-gray-600">
                                Control Per: <span className="text-gray-800">{point.control_per}</span>
                              </span>
                              <span className="text-sm font-medium text-gray-600">
                                Category: <span className="text-gray-800">{point.product_categories}</span>
                              </span>
                            </div>
                            <div>
                              <h4 className="text-base font-semibold text-gray-700 mb-1">
                                {point.title}
                              </h4>
                              <p className="text-sm text-gray-600">{point.instructions}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700">
                        No specific checkpoints available
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                          PO Number
                        </th>
                        <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                          Backorder Number
                        </th>
                        <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                          MRF No
                        </th>
                        <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                          Vendor
                        </th>
                        <th className="px-8 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPos.length === 0 && !loading ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-8 py-6 text-center text-gray-500 text-lg"
                          >
                            No purchase orders or backorders found for quality inspection
                          </td>
                        </tr>
                      ) : (
                        filteredPos.map((po) => (
                          <tr
                            key={`${po.po_number}-${po.backorder_sequence || 'main'}`}
                            onClick={() => handlePoClick(po)}
                            className="hover:bg-indigo-50 transition-colors duration-200 cursor-pointer"
                          >
                            <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {po.po_number}
                            </td>
                            <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {po.backorder_sequence || 'Main'}
                            </td>
                            <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {po.mrf_no}
                            </td>
                            <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {po.vendor_name}
                            </td>
                            <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  po.status === 'QC Cleared'
                                    ? 'bg-green-100 text-green-800'
                                    : po.status === 'QC Rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
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
          <p>Are you sure you want to update the status to "{newStatus}"?</p>
        </Modal>

        <Modal
          title="Add/Edit Note"
          open={noteModalVisible}
          onOk={() => setNoteModalVisible(false)}
          onCancel={() => setNoteModalVisible(false)}
          okText="Save Note"
          cancelText="Cancel"
          okButtonProps={{
            className: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg',
          }}
          cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
        >
          <Input.TextArea
            value={editingComponent ? currentNote[`${editingComponent.po_number}-${editingComponent.mpn}-${editingComponent.backorder_sequence || 'main'}`] || '' : ''}
            onChange={(e) => handleNoteChange(editingComponent, e.target.value)}
            placeholder="Enter your note here"
            rows={4}
            className={`p-2 border rounded-lg w-full transition-all duration-200 ${
              editingComponent && noteErrors[`${editingComponent.po_number}-${editingComponent.mpn}-${editingComponent.backorder_sequence || 'main'}`]
                ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
            }`}
          />
          {editingComponent && noteErrors[`${editingComponent.po_number}-${editingComponent.mpn}-${editingComponent.backorder_sequence || 'main'}`] && (
            <p className="text-red-500 text-xs mt-1">
              {noteErrors[`${editingComponent.po_number}-${editingComponent.mpn}-${editingComponent.backorder_sequence || 'main'}`]}
            </p>
          )}
        </Modal>

        <style jsx global>{`
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: auto;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          }
          .min-h-screen {
            min-height: 100vh;
            overflow-y: auto;
            padding-top: 24px;
            padding-bottom: 24px;
            background: linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%);
            position: relative;
          }
          .min-h-screen::-webkit-scrollbar {
            width: 8px;
          }
          .min-h-screen::-webkit-scrollbar-track {
            background: #e5e7eb;
            border-radius: 10px;
          }
          .min-h-screen::-webkit-scrollbar-thumb {
            background: #6b7280;
            border-radius: 10px;
          }
          .min-h-screen::-webkit-scrollbar-thumb:hover {
            background: #4b5563;
          }
          .table-container {
            position: relative;
            max-height: 80vh;
            overflow-y: auto;
            overflow-x: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            border-radius: 12px;
            background: #ffffff;
          }
          .table-wrapper {
            overflow-x: auto;
            width: 100%;
          }
          .qc-points-container {
            max-height: 30vh;
            overflow-y: auto;
            margin-top: 24px;
            padding: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #f9fafb;
          }
          .table-container::-webkit-scrollbar,
          .table-wrapper::-webkit-scrollbar,
          .qc-points-container::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .table-container::-webkit-scrollbar-track,
          .table-wrapper::-webkit-scrollbar-track,
          .qc-points-container::-webkit-scrollbar-track {
            background: #e5e7eb;
            border-radius: 10px;
          }
          .table-container::-webkit-scrollbar-thumb,
          .table-wrapper::-webkit-scrollbar-thumb,
          .qc-points-container::-webkit-scrollbar-thumb {
            background: #6b7280;
            border-radius: 10px;
          }
          .table-container::-webkit-scrollbar-thumb:hover,
          .table-wrapper::-webkit-scrollbar-thumb:hover,
          .qc-points-container::-webkit-scrollbar-thumb:hover {
            background: #4b5563;
          }
          table {
            border-radius: 12px;
            overflow: hidden;
            border-collapse: collapse;
            width: 100%;
            min-width: 1500px;
          }
          th, td {
            border-bottom: 1px solid #e5e7eb;
            color: #374151;
            padding: 16px 20px;
            font-size: 14px;
            transition: background 0.3s ease;
          }
          th {
            background: #f9fafb;
            font-weight: 600;
            color: #1f2937;
            border-bottom: 2px solid #d1d5db;
            text-align: center;
            white-space: nowrap;
            line-height: 1.2;
          }
          th:hover {
            background: #e0e7ff;
          }
          tr:hover td {
            background: #f5f3ff;
          }
          .bg-white {
            margin: 0 auto;
            width: 98vw;
            transition: transform 0.3s ease;
          }
          .bg-white:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          }
          .max-w-full {
            max-width: 100%;
          }
          button, select, input, textarea {
            transition: all 0.2s ease-in-out;
          }
          select, input, textarea {
            background: #f9fafb;
          }
          select:focus, input:focus, textarea:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
          }
          .elegant-bg {
            background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #e0f2fe 100%);
            animation: subtleMove 20s ease-in-out infinite;
            position: relative;
            overflow: hidden;
          }
          @keyframes subtleMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .elegant-bg::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
            animation: gentleFade 5s ease-in-out infinite;
          }
          @keyframes gentleFade {
            0% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
            100% { opacity: 0.4; transform: scale(1); }
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

export default QualityInspection;