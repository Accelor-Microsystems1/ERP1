import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Table, Input, Button, Space, message, Select, DatePicker, InputNumber, Modal, Form, Checkbox } from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import { EnvelopeIcon, ArrowDownTrayIcon, EyeIcon } from '@heroicons/react/24/outline';
import { searchMrfComponentsForPurchaseHead, raisePurchaseOrder, getPaymentTerms, getOtherTermsConditions, fetchAllVendors, createPaymentTerm, createOtherTermCondition, fetchPreviousPurchases } from '../utils/api';
import moment from 'moment';
import jsPDF from 'jspdf';
import { autoTable } from "jspdf-autotable";
//import 'jspdf-autotable';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import logo from '../assets/accelor-nobg.png';
import Loader from '../components/loading';

// Dynamically set the worker source using the local pdfjs-dist worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min',
  import.meta.url
).href;

const { Option } = Select;

const PurchaseHeadMrfSearchPage = () => {
  const [filters, setFilters] = useState(() => {
    const savedFilters = sessionStorage.getItem('mrfFilters');
    return savedFilters ? JSON.parse(savedFilters) : { search: '', vendorSearch: '' };
  });
  const [components, setComponents] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [selectedMpns, setSelectedMpns] = useState(() => {
    const savedMpns = sessionStorage.getItem('selectedMpns');
    return savedMpns ? JSON.parse(savedMpns) : [];
  });
  const [selectedVendors, setSelectedVendors] = useState(() => {
    const savedVendors = sessionStorage.getItem('selectedVendors');
    return savedVendors ? JSON.parse(savedVendors) : [];
  });
  const [editingVendorKey, setEditingVendorKey] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isEmailConfirmModalVisible, setIsEmailConfirmModalVisible] = useState(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [isAddPaymentTermModalVisible, setIsAddPaymentTermModalVisible] = useState(false);
  const [isAddOtherTermModalVisible, setIsAddOtherTermModalVisible] = useState(false);
  const [isPreviousPurchasesModalVisible, setIsPreviousPurchasesModalVisible] = useState(false);
  const [columnVisibilityModalVisible, setColumnVisibilityModalVisible] = useState(false);
  const [isVendorFilterModalVisible, setIsVendorFilterModalVisible] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [emailComponents, setEmailComponents] = useState([]);
  const [componentsToRaise, setComponentsToRaise] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [previousPurchasesData, setPreviousPurchasesData] = useState([]);
  const [quotationRefNo, setQuotationRefNo] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(null);
  const [selectedPaymentTerm, setSelectedPaymentTerm] = useState(null);
  const [selectedOtherTerm, setSelectedOtherTerm] = useState(null);
  const [isMpnFilterModalVisible, setIsMpnFilterModalVisible] = useState(false);
  const [mpnSearch, setMpnSearch] = useState('');
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [otherTerms, setOtherTerms] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
 
  const [poNumber, setPoNumber] = useState("");
  const [vendorDetails, setVendorDetails] = useState({
  contactNo: "",
  email: "",
  contactPerson: "",
  address: "",
  gstin: "",
  pan: "",
});
 const [updatedItems, setUpdatedItems] = useState([]);
  const [currentTime, setCurrentTime] = useState(moment());
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [purchaseHead, setPurchaseHead] = useState({ signature: null, name: 'N/A', designation: 'N/A' });
  const [errors, setErrors] = useState({
    quotationRefNo: false,
    expectedDeliveryDate: false,
    vendor: false,
    ratePerUnit: false,
    uom: false,
    selectedPaymentTerm: false,
    selectedOtherTerm: false,
  });
  const [columnVisibility, setColumnVisibility] = useState({
    s_no: true,
    select: true,
    mrf_no: true,
    item_description: true,
    mpn: true,
    make: true,
    part_no: true,
    uom: true,
    vendor: true,
    taxType: true,
    updated_requested_quantity: true,
    ratePerUnit: true,
    amount: true,
    taxAmount: true,
    totalpo_cost: true, // New field
    status: true,
    previous_purchases: true,
    actions: true,
  });
  const [paymentTermForm] = Form.useForm();
  const [otherTermForm] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();



  const taxOptions = [
    '1% GST', '2% GST', '5% GST', '12% GST', '18% GST', '28% GST',
    '1% GST RC', '2% GST RC', '5% GST RC', '12% GST RC', '18% GST RC', '28% GST RC',
    '1% IGST', '2% IGST', '5% IGST', '12% IGST', '18% IGST', '28% IGST',
    '1% IGST RC', '2% IGST RC', '5% IGST RC', '12% IGST RC', '18% IGST RC', '28% IGST RC',
  ];

  useEffect(() => {
  if (selectedComponents.length > 0) {
    const generatePoNumber = () => {
      const date = moment().format("YYYYMMDD");
      const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      return `ACC/ADMIN/PO/${sequence}`;
    };
    setPoNumber(generatePoNumber());
  }
}, [selectedComponents]);

  // Compute distinct MPN and Part No combinations
  const distinctMpns = useMemo(() => {
    const mpnSet = new Set();
    components.forEach((component) => {
      const key = `${component.mpn || '-'}-${component.part_no || '-'}`;
      mpnSet.add(JSON.stringify({ mpn: component.mpn || '-', part_no: component.part_no || '-', key }));
    });
    return Array.from(mpnSet).map(item => JSON.parse(item)).sort((a, b) => a.mpn.localeCompare(b.mpn));
  }, [components]);

  // Compute distinct Vendors
  const distinctVendors = useMemo(() => {
    const vendorSet = new Set();
    components.forEach((component) => {
      if (component.vendor_name && component.vendor_name !== 'N/A') {
        vendorSet.add(component.vendor_name);
      }
    });
    return Array.from(vendorSet).sort((a, b) => a.localeCompare(b));
  }, [components]);

  useEffect(() => {
    message.config({
      top: 80,
      duration: 5,
      maxCount: 3,
    });
    fetchComponents();
    fetchPaymentTerms();
    fetchOtherTermsConditions();
    fetchVendors();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('mrfFilters', JSON.stringify(filters));
    sessionStorage.setItem('selectedMpns', JSON.stringify(selectedMpns));
    sessionStorage.setItem('selectedVendors', JSON.stringify(selectedVendors));
  }, [filters, selectedMpns, selectedVendors]);

    // Start: Fetch vendors, payment terms, and other terms on mount
  useEffect(() => {
    message.config({
      top: 80,
      duration: 5,
      maxCount: 3,
      prefixCls: "ant-message",
    });
    const loadData = async () => {
      setVendorLoading(true);
      try {
        const [vendorData, paymentTermsData, otherTermsData, usersData] = await Promise.all([
          fetchAllVendors(),
          getPaymentTerms(),
          getOtherTermsConditions(),
          fetchUsers(),
        ]);
        setVendors(vendorData);
        setPaymentTerms(paymentTermsData);
        setOtherTerms(otherTermsData);
       setUsers(Array.isArray(usersData) ? usersData : []);
      const purchaseHeadUser = usersData.find(user => user.role === 'purchase_head') || {};
        setPurchaseHead({
          signature: purchaseHeadUser.signature || null,
          name: purchaseHeadUser.name || 'N/A',
          designation: purchaseHeadUser.designation || 'N/A'
        });
      } catch (error) {
        message.error("Failed to fetch data. Please try again.", 5);
      } finally {
        setVendorLoading(false);
      }
    };
    loadData();
  }, []);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const data = await searchMrfComponentsForPurchaseHead({});
      const mappedData = data.map((component, index) => {
        const ratePerUnit = component.ratePerUnit || 0;
        const updatedQty = component.updated_requested_quantity || component.initial_requested_quantity || 0;
        const amount = updatedQty * ratePerUnit;
        const taxType = component.taxType || '18% GST';
        const taxRate = parseFloat(taxType.match(/(\d+\.?\d*)%/)?.[1] || 0) / 100;
        const taxAmount = amount * taxRate;
        const totalpo_cost = amount + taxAmount; // New field: sum of amount and taxAmount

return {
        ...component,
        key: `${component.mrf_no}-${component.part_no || 'no-part'}-${index}`,
        vendor_name: component.vendor || 'N/A',
        taxType,
        updated_requested_quantity: updatedQty,
        ratePerUnit,
        amount,
        uom: component.uom && component.uom.trim() !== '' ? component.uom : '-',
        taxAmount,
        make: component.make || '',
        status: component.status || 'CEO Approval Done',
        component_id: component.component_id || index,
        isRaised: false, // Initialize isRaised flag
        totalpo_cost, // New field
      };
    });
      setComponents(mappedData);
      setFilteredComponents(mappedData);
    } catch (error) {
      console.error('Error fetching components:', error);
      message.error('Failed to fetch components');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentTerms = async () => {
    try {
      const terms = await getPaymentTerms();
      setPaymentTerms(terms);
    } catch (error) {
      console.error('Error fetching payment terms:', error);
      message.error('Failed to fetch payment terms');
    }
  };

  const fetchOtherTermsConditions = async () => {
    try {
      const terms = await getOtherTermsConditions();
      setOtherTerms(terms);
    } catch (error) {
      console.error('Error fetching other terms/conditions:', error);
      message.error('Failed to fetch other terms/conditions');
    }
  };

  const fetchVendors = async () => {
    try {
      const vendorData = await fetchAllVendors();
      setVendors(vendorData);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      message.error('Failed to fetch vendors');
    }
  };

  const fetchComponentPreviousPurchases = async (component_id) => {
    setModalLoading(true);
    try {
      const filters = { componentId: component_id, limit: 5, sort: "created_at DESC" };
      const data = await fetchPreviousPurchases(filters);
      if (!data || !Array.isArray(data)) {
        setModalData([]);
        return;
      }
      const enhancedData = data.slice(0, 5).map(item => ({
        po_number: item.po_number || 'N/A',
        created_at: item.created_at ? moment(item.created_at).format('YYYY-MM-DD') : 'N/A',
        vendor_name: item.vendor_name || 'N/A',
        updated_requested_quantity: item.updated_requested_quantity || 'N/A',
        rate_per_unit: isNaN(parseFloat(item.rate_per_unit)) ? 0 : parseFloat(item.rate_per_unit),
        amount: isNaN(parseFloat(item.amount)) ? 0 : parseFloat(item.amount),
        key: item.po_number || Math.random().toString(),
      }));
      setModalData(enhancedData);
    } catch (error) {
      console.error('Error fetching previous purchases:', error.message);
      message.error('Failed to fetch previous purchase details.');
      setModalData([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddPaymentTerm = async (values) => {
    try {
      const newTerm = await createPaymentTerm({ description: values.description });
      setPaymentTerms([...paymentTerms, newTerm]);
      setSelectedPaymentTerm(newTerm.id);
      setIsAddPaymentTermModalVisible(false);
      paymentTermForm.resetFields();
      message.success('Payment term added successfully');
    } catch (error) {
      console.error('Error adding payment term:', error);
      message.error('Failed to add payment term');
    }
  };

  const handleAddOtherTerm = async (values) => {
    try {
      const newTerm = await createOtherTermCondition({ description: values.description });
      setOtherTerms([...otherTerms, newTerm]);
      setSelectedOtherTerm(newTerm.id);
      setIsAddOtherTermModalVisible(false);
      otherTermForm.resetFields();
      message.success('Other term added successfully');
    } catch (error) {
      console.error('Error adding other term:', error);
      message.error('Failed to add other term');
    }
  };

  const handleSearchChange = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    setFilters(prev => ({ ...prev, search: searchTerm }));
    setCurrentPage(1);
  };

  const handleVendorSearchChange = (e) => {
    const vendorSearchTerm = e.target.value.toLowerCase();
    setFilters(prev => ({ ...prev, vendorSearch: vendorSearchTerm }));
    setCurrentPage(1);
  };

  const filterComponents = () => {
    let filtered = components.filter((component) => {
      const matchesGeneralSearch = filters.search
        ? [
            component.mrf_no?.toLowerCase(),
            component.item_description?.toLowerCase(),
            component.mpn?.toLowerCase(),
            component.part_no?.toLowerCase(),
            component.status?.toLowerCase(),
          ].some(field => field?.includes(filters.search))
        : true;

      const matchesVendorSearch = filters.vendorSearch
        ? component.vendor_name?.toLowerCase().includes(filters.vendorSearch)
        : true;

      return matchesGeneralSearch && matchesVendorSearch;
    });

    if (selectedMpns.length > 0) {
      filtered = filtered.filter((component) => {
        const key = `${component.mpn || '-'}-${component.part_no || '-'}`;
        return selectedMpns.includes(key);
      });
    }

    if (selectedVendors.length > 0) {
      filtered = filtered.filter((component) => {
        return selectedVendors.includes(component.vendor_name);
      });
    }

    setFilteredComponents(filtered);
  };

  useEffect(() => {
    filterComponents();
  }, [filters, selectedMpns, selectedVendors, components]);

  const handleMpnCheckboxChange = (key) => {
    setSelectedMpns(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleVendorCheckboxChange = (vendorName) => {
    setSelectedVendors(prev => {
      if (prev.includes(vendorName)) {
        return prev.filter(v => v !== vendorName);
      }
      return [...prev, vendorName];
    });
  };

  const handleSelectComponent = (component) => {
    setSelectedComponents(prev => {
      const isSelected = prev.some(c => c.key === component.key);
      if (isSelected) {
        return prev.filter(c => c.key !== component.key);
      }
      return [...prev, component];
    });
  };

  const handleSelectAll = () => {
    if (selectedComponents.length === filteredComponents.length) {
      setSelectedComponents([]);
      message.info('All components deselected');
    } else {
      setSelectedComponents([...filteredComponents]);
      message.success('All filtered components selected');
    }
  };
const handleVendorChange = (value, record) => {
  const updatedComponents = components.map(component =>
    component.key === record.key ? { ...component, vendor_name: value } : component
  );
  setComponents(updatedComponents);
  setFilteredComponents(updatedComponents);
  setSelectedComponents(prev =>
    prev.map(component =>
      component.key === record.key ? { ...component, vendor_name: value } : component
    )
  );
  const selectedVendor = vendors.find(v => v.name === value);
  setVendorDetails({
    contactNo: selectedVendor?.contactNo || "",
    email: selectedVendor?.email || "",
    contactPerson: selectedVendor?.contactPerson || "",
    address: selectedVendor?.address || "",
    gstin: selectedVendor?.gstin || "",
    pan: selectedVendor?.pan || "",
  });
  setEditingVendorKey(null);
  message.success(`Vendor updated to ${value}`);
};

  const handleVendorSelectFromPrevious = (vendorName) => {
    const selectedKeys = selectedComponents.map(c => c.key);
    const updatedComponents = components.map(component =>
      selectedKeys.includes(component.key) ? { ...component, vendor_name: vendorName } : component
    );
    setComponents(updatedComponents);
    setFilteredComponents(updatedComponents);
    setSelectedComponents(prev =>
      prev.map(component =>
        selectedKeys.includes(component.key) ? { ...component, vendor_name: vendorName } : component
      )
    );
    setIsPreviousPurchasesModalVisible(false);
    message.success(`Vendor set to ${vendorName} for selected components`);
  };

  const calculateTaxAmount = (amount, taxType) => {
    const taxRate = parseFloat(taxType.match(/(\d+\.?\d*)%/)?.[1] || 0) / 100;
    return amount * taxRate;
  };

  const handleQuantityChange = (key, value) => {
    const parsedValue = parseInt(value) || 0;
    const updatedComponents = components.map(component => {
      if (component.key === key) {
        const newAmount = parsedValue * (component.ratePerUnit || 0);
        const taxAmount = calculateTaxAmount(newAmount, component.taxType);
        return {
          ...component,
          updated_requested_quantity: parsedValue,
          amount: newAmount,
          taxAmount,
          totalpo_cost: newAmount + taxAmount, // Update totalpo_cost
        };
      }
      return component;
    });
    setComponents(updatedComponents);
    setFilteredComponents(updatedComponents);
    setSelectedComponents(prev =>
      prev.map(component =>
        component.key === key
          ? { ...component, updated_requested_quantity: parsedValue, amount: updatedComponents.find(c => c.key === key).amount, taxAmount: updatedComponents.find(c => c.key === key).taxAmount, totalpo_cost: updatedComponents.find(c => c.key === key).totalpo_cost }
          : component
      )
    );
  };

  const handleRateChange = (key, value) => {
  const parsedValue = parseFloat(value) || 0;
  const referenceItem = components.find(item => item.key === key);
  if (!referenceItem) {
    message.error('Item not found');
    return;
  }
  const referenceKey = `${referenceItem.mpn || ''}-${referenceItem.item_description || ''}`;
  const updatedComponents = components.map(component => {
    if (`${component.mpn || ''}-${component.item_description || ''}` === referenceKey) {
      const newAmount = (component.updated_requested_quantity || 0) * parsedValue;
      const taxAmount = calculateTaxAmount(newAmount, component.taxType);
      return {
        ...component,
        ratePerUnit: parsedValue,
        amount: newAmount,
        taxAmount,
        totalpo_cost: newAmount + taxAmount, // Update totalpo_cost
      };
    }
    return component;
  });

  setErrors(prev => ({ ...prev, ratePerUnit: parsedValue <= 0 }));
  if (parsedValue <= 0) {
    message.error('Rate/Unit must be positive');
  }

  setComponents(updatedComponents);
  setFilteredComponents(updatedComponents);
  setSelectedComponents(prev =>
    prev.map(component =>
      component.key === key
        ? { ...component, ratePerUnit: parsedValue, amount: updatedComponents.find(c => c.key === key).amount, taxAmount: updatedComponents.find(c => c.key === key).taxAmount, totalpo_cost: updatedComponents.find(c => c.key === key).totalpo_cost }
        : component
    )
  );
};

 const handleTaxTypeChange = (key, value) => {
  const referenceItem = components.find(item => item.key === key);
  const referenceKey = `${referenceItem.mpn || ''}-${referenceItem.item_description || ''}`;
  const updatedComponents = components.map(component => {
    if (`${component.mpn || ''}-${component.item_description || ''}` === referenceKey) {
      const taxAmount = calculateTaxAmount(component.amount || 0, value);
      return {
        ...component,
        taxType: value,
        taxAmount,
        totalpo_cost: (component.amount || 0) + taxAmount, // Update totalpo_cost
      };
    }
    return component;
  });

  setComponents(updatedComponents);
  setFilteredComponents(updatedComponents);
  setSelectedComponents(prev => 
    prev.map(component =>
      component.key === key
        ? { ...component, taxType: value, taxAmount: updatedComponents.find(c => c.key === key).taxAmount, totalpo_cost: updatedComponents.find(c => c.key === key).totalpo_cost }
        : component
    ));
};

  const handleModalQuotationRefChange = (e) => {
    const value = e.target.value;
    setQuotationRefNo(value);
    setErrors(prev => ({ ...prev, quotationRefNo: !value.trim() }));
    if (!value) {
      message.warning('Quotation Ref No. is required');
    }
  };

  const handleModalDeliveryDateChange = (date) => {
    setExpectedDeliveryDate(date);
    if (!date) {
      setErrors((prev) => ({ ...prev, expectedDeliveryDate: true }));
      message.error('Expected delivery date is required.', 5);
    } else if (date.isBefore(moment(), 'day')) {
      setErrors((prev) => ({ ...prev, expectedDeliveryDate: true }));
      message.error('Expected delivery date cannot be in the past.', 5);
    } else {
      setErrors((prev) => ({ ...prev, expectedDeliveryDate: false }));
    }
  };

  const handlePaymentTermChange = (value) => {
    setSelectedPaymentTerm(value);
    setErrors(prev => ({ ...prev, selectedPaymentTerm: !value }));
    if (!value) {
      message.warning('Payment Term is required');
    }
  };

  const handleOtherTermChange = (value) => {
    setSelectedOtherTerm(value);
    setErrors(prev => ({ ...prev, selectedOtherTerm: !value }));
    if (!value) {
      message.warning('Other Term/Condition is required');
    }
  };

  const showPreviousPurchasesModal = async (componentId) => {
    if (!componentId) {
      console.error("Invalid componentId:", componentId);
      message.error("Invalid component ID.");
      return;
    }
    await fetchComponentPreviousPurchases(componentId);
    setIsPreviousPurchasesModalVisible(true);
  };

  const validateFields = () => {
    const newErrors = {
      ...errors,
      quotationRefNo: !quotationRefNo || !quotationRefNo.trim(),
      expectedDeliveryDate: !expectedDeliveryDate || expectedDeliveryDate.isBefore(moment(), 'day'),
      vendor: false,
      ratePerUnit: false,
      uom: false,
      selectedPaymentTerm: !selectedPaymentTerm,
      selectedOtherTerm: !selectedOtherTerm,
    };

    const uniqueVendors = [...new Set(componentsToRaise.map(item => item.vendor))];
    if (uniqueVendors.length !== 1) {
      newErrors.vendor = true;
      message.error('All selected components must have the same vendor');
    }

    const invalidRateItems = componentsToRaise.filter(item => item.ratePerUnit <= 0);
    if (invalidRateItems.length) {
      newErrors.ratePerUnit = true;
      message.error('Rate/Unit must be positive for all items');
    }

    const missingUomItems = componentsToRaise.filter(item => !item.uom || item.uom.trim() === '');
    if (missingUomItems.length) {
      newErrors.uom = true;
      message.error('Unit of Measure is required for all items');
    }

    const totalPoCost = componentsToRaise.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      const taxAmount = parseFloat(item.taxAmount) || 0;
      return sum + amount + taxAmount;
    }, 0);

    if (isNaN(totalPoCost) || totalPoCost <= 0) {
      message.error('Total PO cost must be positive');
      return false;
    }

    setErrors(newErrors);
    const isValid = !Object.values(newErrors).some(Boolean);
    if (!isValid) {
      message.warning('Please fix validation errors');
    }
    return isValid;
  };

  const handleEmail = (components) => {
    setEmailComponents(components);
    setIsEmailConfirmModalVisible(true);
  };

   const confirmSendEmail = () => {
    const subject = encodeURIComponent('Purchase Order Details');
    const body = encodeURIComponent(
      `Please find the purchase order details.\n\n` +
      `Vendor: ${emailComponents[0]?.vendor || ''}\n` +
      `Expected Delivery Date: ${expectedDeliveryDate ? moment(expectedDeliveryDate).format('YYYY-MM-DD') : ''}\n` +
      `Payment Terms: ${paymentTerms.find(p => p.id === selectedPaymentTerm)?.description || ''}\n` +
      `Other Terms: ${otherTerms.find(o => o.id === selectedOtherTerm)?.description || ''}\n` +
      `Total PO Cost: INR ${emailComponents.reduce((sum, item) => sum + (parseFloat(item.amount) || 0) + (parseFloat(item.taxAmount) || 0), 0).toFixed(2)}\n` +
      `Components: ${emailComponents.length}\n\n` +
      `Download the attached PDF for details.`
    );
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=&subject=${subject}&body=${body}`;
    window.open(gmailLink, '_blank');
    setIsEmailConfirmModalVisible(false);
    setEmailComponents([]);
  };


const generatePDF = () => {
  try {
    const doc = new jsPDF();
    const selectedVendor = vendors.find((v) => v.name === vendor) || {};
    let currentPage = 1;
    let cocPageNumber = null; // Track CoC page number
    const footerHeight = 20; // Reserve 20px for footer
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentThreshold = pageHeight - footerHeight - margin; // 263 for A4 (297mm)

    // Utility to draw box
    const drawBox = (x, y, width, height) => {
      doc.setLineWidth(0.3);
      doc.rect(x, y, width, height);
    };

    // Utility to draw dotted line with period-like pattern
    const drawDottedLine = (x1, y1, x2, y2) => {
      doc.setLineWidth(0.3);
      doc.setLineDash([0.3, 0.7]); // Shorter dash (0.3px) with very small gap (0.7px) to mimic periods
      doc.line(x1, y1, x2, y2);
      doc.setLineDash([]); // Reset to solid line
    };

    // Number to words converter
    const numberToWords = (num) => {
      const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const thousands = ['', 'Thousand', 'Lakh', 'Crore'];

      if (num === 0) return 'Zero';
      let amount = Math.floor(num);
      let words = [];
      const extract = (value, divisor) => {
        const part = Math.floor(value / divisor);
        value %= divisor;
        return [part, value];
      };

      const sections = [
        [10000000, 'Crore'],
        [100000, 'Lakh'],
        [1000, 'Thousand'],
        [100, 'Hundred'],
      ];

      for (const [div, label] of sections) {
        const [part, rest] = extract(amount, div);
        amount = rest;
        if (part > 0) words.push(`${numberToWords(part)} ${label}`);
      }

      const ten = Math.floor(amount / 10);
      const one = amount % 10;

      if (ten === 1) words.push(teens[one]);
      else {
        if (ten > 1) words.push(tens[ten]);
        if (one > 0) words.push(units[one]);
      }

      return words.join(' ');
    };

    // Header Section
    const addHeader = () => {
      doc.setFontSize(14);
      doc.setFont('Helvetica', 'bold');
      doc.text('PURCHASE ORDER', 105, 10, { align: 'center' });
      doc.setFont('Helvetica', 'bold');
      doc.text('F-Admin-002', 196, 10, { align: 'right' });

      const rowHeight = 18;
      const fullWidth = 182;
      const halfWidth = fullWidth / 2;
      const startX = 14;
      let y = 15;

      const drawLinesWithStyledLabel = (lines, xStart, yStart) => {
        let yPos = yStart;
        lines.forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex !== -1) {
            const label = line.substring(0, colonIndex + 1);
            const value = line.substring(colonIndex + 1).trim();
            doc.setFont('helvetica', 'bold');
            doc.text(label, xStart, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(value, xStart + doc.getTextWidth(label) + 2, yPos);
            yPos += 5;
          } else {
            doc.setFont('helvetica', 'normal');
            doc.text(line, xStart, yPos);
            yPos += 5;
          }
        });
        return yPos;
      };

      // Row 1: Logo + PO and Date
      doc.rect(startX, y, halfWidth, rowHeight);
      doc.addImage(logo, 'PNG', startX + 17, y + 6, 45, 8);
      doc.rect(startX + halfWidth, y, halfWidth, rowHeight);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const rightLinesRow1 = [
        `Purchase Order No.: ${poNumber || '-'}`,
        `Date: ${currentTime.format('DD/MM/YYYY')}`
      ].flatMap(line => doc.splitTextToSize(line, halfWidth - 6));
      drawLinesWithStyledLabel(rightLinesRow1, startX + halfWidth + 2, y + 9);
      y += rowHeight;

      // Row 2: Address + GST/CIN/PAN
const billingAddress =
  'Accelor Microsystems Plot No. F-451, Industrial Focal Point Sector 74, Phase 8B, SAS Nagar, Punjab';
const wrappedBilling = doc.splitTextToSize(billingAddress, halfWidth - 6);
const billingLines = [
  'Billing/Shipping Address:',
  ...wrappedBilling,
  'PHONE NO.: +91 7087229840/41',
];

const rightDetails = [
  'GSTIN NO.: 03AWNPS2671N1ZX',
  'CIN: -',
  'PAN: AWNPS2671N'
].flatMap(line => doc.splitTextToSize(line, halfWidth - 6));

// Calculate max lines to sync height
const numLines = Math.max(billingLines.length, rightDetails.length);
const row2Height = numLines * 5 + 6;

// Left box
doc.rect(startX, y, halfWidth, row2Height);
let leftY = y + 6;
billingLines.forEach((line, idx) => {
  if (line.includes(':')) {
    const [label, value] = line.split(':');
    doc.setFont('helvetica', 'bold');
    doc.text(`${label.trim()}:`, startX + 2, leftY);
    doc.setFont('helvetica', 'normal');
    if (value) doc.text(value.trim(), startX + 4 + doc.getTextWidth(`${label.trim()}:`), leftY);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text(line, startX + 2, leftY);
  }
  leftY += 5;
});

// Right box
doc.rect(startX + halfWidth, y, halfWidth, row2Height);
drawLinesWithStyledLabel(rightDetails, startX + halfWidth + 2, y + 6);

y += row2Height; // move Y cursor down


      // Row 3: Full-width Vendor Name and Address
      const label = 'Name and Address of Vendor:';
      const vendorName = selectedVendor?.name || 'N/A';
      const wrapped = doc.splitTextToSize(`${label} ${vendorName}`, fullWidth - 4);
      const vendorHeight = wrapped.length * 6 + 4;
      doc.rect(startX, y, fullWidth, vendorHeight);
      let textY = y + 7;
      wrapped.forEach(line => {
        const labelEnd = line.indexOf(':') + 1;
        const labelPart = line.slice(0, labelEnd);
        const valuePart = line.slice(labelEnd + 1).trim();
        doc.setFont('helvetica', 'bold');
        doc.text(labelPart, startX + 2, textY);
        doc.setFont('helvetica', 'normal');
        doc.text(valuePart, startX + 4 + doc.getTextWidth(labelPart) + 2, textY);
        textY += 6;
      });
      y += vendorHeight;

      // Row 4: Vendor info + Quotation info
      const leftLines = [
        `Address: ${selectedVendor.address || 'N/A'}`,
        `GSTIN: ${selectedVendor.gstin || 'N/A'}`,
        `PAN: ${selectedVendor.pan || 'N/A'}`
      ].flatMap(line => doc.splitTextToSize(line, halfWidth - 6));
      const rightLines = [
        `Quotation Ref No: ${quotationRefNo || 'N/A'}`,
        `Contact Person: ${vendorDetails.contactPerson || 'N/A'}`,
        `Contact No.: +91 ${vendorDetails.contactNo || 'N/A'}`,
        `Email: ${vendorDetails.email || 'N/A'}`
      ].flatMap(line => doc.splitTextToSize(line, halfWidth - 6));
      const maxLines = Math.max(leftLines.length, rightLines.length);
      const rowHeight4 = maxLines * 5 + 8;
      doc.rect(startX, y, halfWidth, rowHeight4);
      doc.rect(startX + halfWidth, y, halfWidth, rowHeight4);
      drawLinesWithStyledLabel(leftLines, startX + 2, y + 6);
      drawLinesWithStyledLabel(rightLines, startX + halfWidth + 2, y + 6);
      return y + rowHeight4;
    };


    const addFooter = (pageNum) => {
      // Skip footer for CoC page
      if (pageNum === cocPageNumber) return;

      const footerText =
          "+91 7087229840/41 scm@accelorindia.com https://www.accelorindia.com 03AWNPS2671N1ZX";
        const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      doc.setTextColor(75, 0, 130);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const wrappedFooter = doc.splitTextToSize(footerText, pageWidth - 2 * margin);
        doc.text(wrappedFooter, pageWidth / 2, pageHeight - margin - 3, { align: "center" });
        doc.setTextColor(0, 0, 0);
        doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - margin + 5, { align: "center" });
      };


   const addTotals = (y) => {
        if (y > contentThreshold - 50) {
          doc.addPage();
          currentPage++;
          y = 15;
        }
      const tableStartX = 14;
      const fullWidth = 182;
      const amountColWidth = 25;
      const labelColWidth = fullWidth - amountColWidth;
      const rowHeight = 10;

      const drawTwoColumnRow = (label, value, rowY) => {
        drawBox(tableStartX, rowY, fullWidth, rowHeight);
        doc.setFont('helvetica', 'bold');
        doc.text(label, tableStartX + labelColWidth / 2, rowY + 7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(value, tableStartX + labelColWidth + amountColWidth - 2, rowY + 7, { align: 'right' });
      };

      let currentY = y;
      // Calculate basic total from updatedItems
      const basicTotal = updatedItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      drawTwoColumnRow('Basic Total:', `Rs. ${basicTotal.toFixed(2)}`, currentY);
      currentY += rowHeight;

      // Calculate tax totals
      const taxRates = [0.01, 0.02, 0.05, 0.12, 0.18, 0.28]; // GST rates
      const cgstTotals = taxRates.map(rate => 
        updatedItems.reduce((sum, item) => {
          const itemTaxRate = parseFloat(item.taxType.match(/(\d+\.?\d*)%/)?.[1] || 0) / 200; // CGST is half of GST
          return itemTaxRate === rate / 2 ? sum + (parseFloat(item.taxAmount) / 2 || 0) : sum;
        }, 0)
      );
      const sgstTotals = [...cgstTotals]; // Assuming SGST equals CGST for simplicity
      const igstTotals = taxRates.map(rate => 
        updatedItems.reduce((sum, item) => {
          const itemTaxRate = parseFloat(item.taxType.match(/(\d+\.?\d*)%/)?.[1] || 0) / 100;
          return item.taxType.includes('IGST') && itemTaxRate === rate ? sum + (parseFloat(item.taxAmount) || 0) : sum;
        }, 0)
      );

      taxRates.forEach((rate, index) => {
        if (cgstTotals[index] > 0) {
          if (currentY + 2 * rowHeight > contentThreshold) {
            doc.addPage();
            currentPage++;
            currentY = 15;
          }
          drawTwoColumnRow(`CGST (${(rate * 100 / 2).toFixed(0)}%):`, `Rs. ${cgstTotals[index].toFixed(2)}`, currentY);
          currentY += rowHeight;
          drawTwoColumnRow(`SGST (${(rate * 100 / 2).toFixed(0)}%):`, `Rs. ${sgstTotals[index].toFixed(2)}`, currentY);
          currentY += rowHeight;
        }
      });

      taxRates.forEach((rate, index) => {
        if (igstTotals[index] > 0) {
          if (currentY + rowHeight > contentThreshold) {
            doc.addPage();
            currentPage++;
            currentY = 15;
          }
          drawTwoColumnRow(`IGST (${(rate * 100).toFixed(0)}%):`, `Rs. ${igstTotals[index].toFixed(2)}`, currentY);
          currentY += rowHeight;
        }
      });

      const totalPoCost = updatedItems.reduce((sum, item) => sum + (parseFloat(item.totalpo_cost) || 0), 0);
      const totalRowHeight = 15;
      if (currentY + totalRowHeight + 20 > contentThreshold) {
        doc.addPage();
        currentPage++;
        currentY = 15;
      }
      drawBox(tableStartX, currentY, fullWidth, totalRowHeight);
      doc.setFont('helvetica', 'bold');
      doc.text('Total PO Value in INR:', tableStartX + labelColWidth / 2, currentY + 7, { align: 'center' });
      const totalText = `Rs. ${totalPoCost.toFixed(2)}`;
      doc.setFont('helvetica', 'bold');
      doc.text(totalText, tableStartX + fullWidth - 2, currentY + 7, { align: 'right' });
      const inWords = `${numberToWords(totalPoCost)} Rupees`;
      doc.setFontSize(9).text(inWords, tableStartX + 60, currentY + 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Commercial terms & conditions:', 14, currentY + 25);
      return currentY + rowHeight + 5;
    };

    const addAdditionalFields = (y) => {
      if (y > contentThreshold - 30) {
        doc.addPage();
        currentPage++;
        y = 15;
      }
      const startX = 14;
      const fullWidth = 182;
      const rowHeight = 5;

      const fields = [
        `Delivery Scheduled: ${expectedDeliveryDate ? moment(expectedDeliveryDate).format('DD/MM/YYYY') : 'N/A'}`,
        `Payment Terms: ${paymentTerms.find(p => p.id === selectedPaymentTerm)?.description || 'N/A'}`,
        `Other Terms and Conditions: ${otherTerms.find(o => o.id === selectedOtherTerm)?.description || 'N/A'}`
      ];

      fields.forEach((field, index) => {
        const [label, value] = field.split(':');
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, startX, y + 15);
        doc.setFont('helvetica', 'normal');
        doc.text(value.trim(), startX + doc.getTextWidth(`${label}:`) + 4, y + 15);
        y += rowHeight;
      });

      return y;
    };

    // Updated addTerms for PurchaseHead context
    const addTerms = (y) => {
      const generalTerms = [
        '1. Certificate of Conformance along with batch code/date code is mandatory with invoice (Format as Annexure I).',
        '2. OEM/Authorized Distributor certificate or Traceability certificate (as applicable) must accompany the invoice.',
        '3. Deliveries must include Original and Duplicate Invoice for Recipient; non-compliance will result in rejection.',
        '4. GSTN No. must be quoted on the invoice; otherwise, GST payment liability rests with the supplier.',
        '5. Invoices must include HSN Code for goods or SAC for services; missing codes will lead to rejection.',
        '6. HSN/SAC classification is the supplier\'s responsibility; no claims will be entertained for later changes.',
        '7. Timely delivery is critical and must align with schedules unless agreed otherwise in writing.',
        '8. Non-conforming or sub-standard goods will be rejected; supplier to retrieve at their cost, including freight.',
        '9. Invoices must include GST/PAN/CIN details of the supplier.',
        '10. Disputes will be settled amicably; unresolved issues will go to arbitration in Mohali, India, with binding decisions.'
      ];

      doc.setFont('helvetica', 'bold').text('GENERAL TERMS:', 16, y + 10);
      doc.setFont('helvetica', 'normal');
      let cursorY = y + 20;
      const lineWidth = 170;
      const xStart = 16;

      generalTerms.forEach(term => {
        const lines = doc.splitTextToSize(term, lineWidth);
        lines.forEach((line, i) => {
          if (cursorY + 5 > contentThreshold) {
            doc.addPage();
            currentPage++;
            cursorY = 15;
          }
          if (i < lines.length - 1 && line.includes(' ')) {
            const words = line.trim().split(/\s+/);
            const totalTextWidth = words.reduce((acc, word) => acc + doc.getTextWidth(word), 0);
            const spaceCount = words.length - 1;
            const extraSpace = (lineWidth - totalTextWidth) / spaceCount;
            let currentX = xStart;
            words.forEach((word, idx) => {
              doc.text(word, currentX, cursorY);
              currentX += doc.getTextWidth(word) + (idx < spaceCount ? extraSpace : 0);
            });
          } else {
            doc.text(line, xStart, cursorY);
          }
          cursorY += 5;
        });
        cursorY += 2;
      });

      if (cursorY + 40 > contentThreshold) {
        doc.addPage();
        currentPage++;
        cursorY = 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      cursorY += 10;

      if (purchaseHead.signature) {
        try {
          doc.addImage(purchaseHead.signature, 'PNG', 16, cursorY, 50, 20);
          cursorY += 25;
        } catch (error) {
          console.error('Error adding signature to PDF:', error);
          doc.setFont('helvetica', 'normal');
          doc.text('Signature not available', 16, cursorY);
          cursorY += 10;
        }
      } else {
        doc.setFont('helvetica', 'normal');
        doc.text('Signature not available', 16, cursorY);
        cursorY += 10;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${purchaseHead.name}`, 16, cursorY);
      cursorY += 6;
      doc.text(`${purchaseHead.designation}`, 16, cursorY);
      cursorY += 10;

      return cursorY;
    };

    const addCertificateOfConformance = (y) => {
      doc.addPage();
      currentPage++;
      cocPageNumber = currentPage;
      const startX = 18;
      const fullWidth = 182;
      const pageWidth = doc.internal.pageSize.getWidth();
      let cursorY = 18;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const annexureText = 'Annexure I';
      const formNumber = 'F-Admin-005';
      doc.text(annexureText, pageWidth / 2, cursorY, { align: 'center' });
      const annexureTextWidth = doc.getTextWidth(annexureText);
      doc.line(pageWidth / 2 - annexureTextWidth / 2, cursorY + 1, pageWidth / 2 + annexureTextWidth / 2, cursorY + 1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(formNumber, pageWidth - 20, cursorY, { align: 'right' });
      cursorY += 14;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Authorised Distributor\'s/OEM Name and Address', startX, cursorY);
      cursorY += 10;
      const vendorDetailsText = selectedVendor?.name ? `${selectedVendor.name}\n${selectedVendor.address || ''}` : '';
      const wrappedVendor = doc.splitTextToSize(vendorDetailsText, fullWidth - 4);
      doc.setFont('helvetica', 'normal');
      wrappedVendor.forEach(line => {
        doc.text(line, startX, cursorY);
        cursorY += 5;
      });
      cursorY += 5;

      doc.setFont('helvetica', 'bold');
      doc.text('Customer\'s Name and Address', startX, cursorY);
      cursorY += 10;
      const customerDetails = 'Accelor Microsystems Plot No. F-451, Industrial Focal Point Sector 74, Phase 8B, SAS Nagar, Punjab';
      const wrappedCustomer = doc.splitTextToSize(customerDetails, fullWidth - 4);
      doc.setFont('helvetica', 'normal');
      wrappedCustomer.forEach(line => {
        doc.text(line, startX, cursorY);
        cursorY += 5;
      });
      cursorY += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Date:', pageWidth - 60, cursorY);
      drawDottedLine(pageWidth - 60 + doc.getTextWidth('Date:') + 2, cursorY, pageWidth - 20, cursorY);
      cursorY += 10;

      doc.setFontSize(10);
      const certText = 'CERTIFICATE OF CONFORMANCE';
      doc.text(certText, pageWidth / 2, cursorY, { align: 'center' });
      const certTextWidth = doc.getTextWidth(certText);
      doc.line(pageWidth / 2 - certTextWidth / 2, cursorY + 1, pageWidth / 2 + certTextWidth / 2, cursorY + 1);
      cursorY += 10;

      for (let i = 0; i < 5; i++) {
        drawDottedLine(startX, cursorY, startX + fullWidth - 10, cursorY);
        cursorY += 8;
      }
      cursorY += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PO No.:', startX, cursorY);
      drawDottedLine(startX + doc.getTextWidth('PO No.:') + 2, cursorY, startX + 60, cursorY);
      doc.text('Date:', startX + 90, cursorY);
      drawDottedLine(startX + 90 + doc.getTextWidth('Date:') + 2, cursorY, startX + 150, cursorY);
      cursorY += 5;
      doc.text('INVOICE No.:', startX, cursorY);
      drawDottedLine(startX + doc.getTextWidth('INVOICE No.:') + 2, cursorY, startX + 60, cursorY);
      doc.text('Date:', startX + 90, cursorY);
      drawDottedLine(startX + 90 + doc.getTextWidth('Date:') + 2, cursorY, startX + 150, cursorY);
      cursorY += 10;

      const tableColumns = [
        { header: 'Sr. No.', dataKey: 'srNo', width: 15 },
        { header: 'Make', dataKey: 'make', width: 30 },
        { header: 'MPN\n(Part Number)', dataKey: 'mpn', width: 30 },
        { header: 'Device type\n(Components Description)', dataKey: 'deviceType', width: 40 },
        { header: 'Quantity', dataKey: 'quantity', width: 20 },
        { header: 'Lot No./Batch\nCode *', dataKey: 'lotNo', width: 20 },
        { header: 'Date\nCode *', dataKey: 'dateCode', width: 17 }
      ];

      const tableData = Array(6).fill({
        srNo: '',
        make: '',
        mpn: '',
        deviceType: '',
        quantity: '',
        lotNo: '',
        dateCode: ''
      });

      autoTable(doc, {
        startY: cursorY,
        head: [tableColumns.map(col => col.header)],
        body: tableData.map(row => tableColumns.map(col => row[col.dataKey])),
        theme: 'grid',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineWidth: 0.3,
          lineColor: [0, 0, 0],
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          minCellHeight: 10
        },
        styles: {
          fontSize: 9,
          overflow: 'linebreak',
          cellWidth: 'wrap',
          cellPadding: 1,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          minCellHeight: 6
        },
        margin: { left: startX, right: startX },
        columnStyles: tableColumns.reduce((acc, col, i) => ({
          ...acc,
          [i]: { cellWidth: col.width || 'auto' }
        }), {}),
        didDrawCell: (data) => {
          if (data.section === 'head') {
            const text = data.cell.text;
            if (typeof text === 'string' && text.includes('\n')) {
              const lines = text.split('\n');
              const cellHeight = data.cell.height / lines.length;
              let yPos = data.cell.y + cellHeight / 2 + 1;
              lines.forEach(line => {
                doc.text(line, data.cell.x + data.cell.width / 2, yPos, { align: 'center' });
                yPos += cellHeight;
              });
            }
          }
        }
      });

      cursorY = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'normal');
      doc.text('Authorized Signature (with date) and seal', pageWidth - 20, cursorY + 10, { align: 'right' });

      return cursorY;
    };

    // Build PDF
    let y = addHeader();

    const tableData = updatedItems.map((item, i) => [
      `${i + 1}`,
      item.item_description || '-',
      item.mpn || '-',
      item.part_no || '-',
      item.updated_requested_quantity?.toString() || '0',
      item.uom || '-',
      item.ratePerUnit?.toFixed(2) || '0.00',
      item.amount?.toFixed(2) || '0.00'
    ]);

    autoTable(doc, {
      startY: y + 4,
      head: [['S.No', 'Description', 'MPN', 'Part No.', 'Quantity', 'UoM', 'Rate/Unit', 'Amount in INR']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        fontSize: 9,
        halign: 'center'
      },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: 'linebreak',
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        halign: 'center',
        valign: 'middle'
      },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 13 },
        1: { cellWidth: 35 },
        2: { cellWidth: 27 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 15 },
        6: { cellWidth: 22 },
        7: { cellWidth: 25 }
      }
    });

    y = doc.lastAutoTable.finalY;
    y = addTotals(y);
    y = addAdditionalFields(y);
    y = addTerms(y + 15);
    y = addCertificateOfConformance(y);

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);
      addFooter(page);
    }

    return doc;
  } catch (err) {
    console.error('PDF generation error:', err);
    message.error('Failed to generate PDF.', 5);
    return null;
  }
};
const handlePreview = async () => {
  try {
    const doc = generatePDF();
    if (doc) {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setIsPreviewModalVisible(true);
    }
  } catch (error) {
    console.error("Error generating PDF preview:", error);
    message.error("Failed to generate PDF preview. Please try again.", 5);
  }
};

const handleDownload = () => {
  try {
    const doc = generatePDF();
    if (doc) {
      doc.save(
        `${updatedItems[0]?.mrf_no || selectedComponents[0]?.mrf_no}_${
          poNumber || "Purchase Order"
        }.pdf`
      );
    }
  } catch (error) {
    console.error("Error generating PDF:", error);
    message.error("Failed to generate PDF. Please try again.", 5);
  }
};

 const handleRaiseMultiplePO = () => {
    if (!selectedComponents.length) {
      message.warning('Please select at least one component');
      return;
    }

    const uniqueVendors = [...new Set(selectedComponents.map(item => item.vendor))];
    if (uniqueVendors.length !== 1) {
      message.error('All components must have the same vendor');
      return;
    }

    const invalidRateItems = selectedComponents.filter(item => item.ratePerUnit <= 0);
    if (invalidRateItems.length) {
      message.error('Rate/Unit must be positive for all items');
      return;
    }

    const missingUomItems = selectedComponents.filter(item => !item.uom || item.uom.trim() === '');
    if (missingUomItems.length) {
      message.error('Unit of Measure is required for all items');
      return;
    }

  setComponentsToRaise(selectedComponents);
  setQuotationRefNo('');
  setExpectedDeliveryDate(null);
  setSelectedPaymentTerm(null);
  setSelectedOtherTerm(null);
  setErrors({
    quotationRefNo: true,
    expectedDeliveryDate: true,
    vendor: false,
    ratePerUnit: false,
    uom: false,
    selectedPaymentTerm: true,
    selectedOtherTerm: true,
  });
  setIsConfirmModalVisible(true);
};

const handleRaiseSinglePO = async (record) => {
  setComponentsToRaise([record]);
  setQuotationRefNo('');
  setExpectedDeliveryDate(null);
  setSelectedPaymentTerm(null);
  setSelectedOtherTerm(null);
  setErrors({
    quotationRefNo: true,
    expectedDeliveryDate: true,
    vendor: false,
    ratePerUnit: false,
    uom: false,
    selectedPaymentTerm: true,
    selectedOtherTerm: true,
  });
  setIsConfirmModalVisible(true);
};

const confirmRaisePO = async () => {
  if (!validateFields()) return;

  setLoading(true);
  try {
    const vendorName = componentsToRaise[0].vendor_name;
    const vendor = vendors.find(v => v.name === vendorName);

    const overallTotalPoCost = componentsToRaise.reduce((sum, item) => sum + (parseFloat(item.totalpo_cost) || 0), 0);

    const payload = {
      items: componentsToRaise.map(item => ({
        mrf_no: item.mrf_no,
        updated_requested_quantity: item.updated_requested_quantity || 0,
        uom: item.uom,
        ratePerUnit: parseFloat(item.ratePerUnit) || 0,
        amount: parseFloat(item.amount) || 0,
        taxAmount: parseFloat(item.taxAmount) || 0,
        mpn: item.mpn || null,
        item_description: item.item_description || null,
        make: item.make || null,
        part_no: item.part_no || null,
        totalpo_cost: parseFloat(item.totalpo_cost) || 0, // Per-item totalpo_cost
      })),
      vendor: {
        name: vendor?.name || 'N/A',
        address: vendor?.address || 'N/A',
        gstin: vendor?.gstin || '',
        pan: vendor?.pan || 'N/A',
      },
      quotation_no: quotationRefNo,
      totalpo_cost: overallTotalPoCost, // Overall PO cost
      expected_delivery_date: expectedDeliveryDate ? moment(expectedDeliveryDate).format('YYYY-MM-DD') : '',
      payment_term_id: selectedPaymentTerm || null,
      other_term_condition_id: selectedOtherTerm || null,
    };

    await raisePurchaseOrder(payload);
    await handleDownload(componentsToRaise);
    setIsSuccessModalVisible(true);

    const raisedKeys = componentsToRaise.map(item => item.key);
    const updatedComponents = components.map(comp => 
      raisedKeys.includes(comp.key) ? { ...comp, isRaised: true } : comp
    );
    setComponents(updatedComponents);
    setFilteredComponents(updatedComponents);
    setSelectedComponents([]);
    setComponentsToRaise([]);
  } catch (error) {
    console.error('Error raising PO:', error);
    message.error('Failed to raise PO');
  } finally {
    setLoading(false);
  }
};

const handleReviewComponents = () => {
  if (!selectedComponents.length) {
    message.warning('Please select at least one component');
    return;
  }

  // Group components by MPN and Part No
  const groupedComponents = selectedComponents.reduce((acc, component) => {
    const key = `${component.mpn || '-'}-${component.part_no || '-'}`;
    if (!acc[key]) {
      acc[key] = {
        ...component,
        updated_requested_quantity: component.updated_requested_quantity || 0,
        amount: parseFloat(component.amount) || 0,
        taxAmount: parseFloat(component.taxAmount) || 0,
        count: 1,
      };
    } else {
      acc[key].updated_requested_quantity += component.updated_requested_quantity || 0;
      acc[key].amount += parseFloat(component.amount) || 0;
      acc[key].taxAmount += parseFloat(component.taxAmount) || 0;
      acc[key].count += 1;
    }
    return acc;
  }, {});

  // Determine vendor for each group
  const clubbedComponents = Object.values(groupedComponents).map(component => {
    const componentsWithSameMPN = selectedComponents.filter(c => 
      `${c.mpn || '-'}-${c.part_no || '-'}` === `${component.mpn || '-'}-${component.part_no || '-'}`
    );
    
    // Count vendors
    const vendorCounts = componentsWithSameMPN.reduce((acc, comp) => {
      acc[comp.vendor_name] = (acc[comp.vendor_name] || 0) + 1;
      return acc;
    }, {});
    
    // Find vendor with maximum occurrences
    let selectedVendor = Object.keys(vendorCounts).reduce((a, b) => 
      vendorCounts[a] > vendorCounts[b] ? a : b
    );
    
    // If all vendors have same count, take the first one
    if (Object.values(vendorCounts).every(count => count === componentsWithSameMPN.length / Object.keys(vendorCounts).length)) {
      selectedVendor = componentsWithSameMPN[0].vendor_name;
    }
    
    return {
      ...component,
      vendor_name: selectedVendor,
    };
  });
  
  navigate('/mrf/review', { state: { selectedComponents: clubbedComponents, vendorName: selectedComponents[0]?.vendor_name || 'N/A' } });
};

const columns = useMemo(() => [
   {
    title: 'Select',
    key: 'select',
    width: 90,
    align: 'center',
    render: (_, record) => (
      <Checkbox
        checked={selectedComponents.some(c => c.key === record.key)}
        onChange={() => handleSelectComponent(record)}
      />
    ),
    hidden: !columnVisibility.select,
  },

  {
    title: 'S.No',
    key: 's_no',
    width: 70,
    align: 'center',
    render: (_, __, index) => index + 1 + ((currentPage - 1) * pageSize),
    fixed: 'left',
    hidden: !columnVisibility.s_no,
  },
  {
    title: 'MRF No.',
    dataIndex: 'mrf_no',
    key: 'mrf_no',
    width: 120,
    align: 'center',
    hidden: !columnVisibility.mrf_no,
  },
  {
    title: 'Description',
    dataIndex: 'item_description',
    key: 'item_description',
    width: 200,
    align: 'left',
    hidden: !columnVisibility.item_description,
  },
  {
    title: 'MPN',
    dataIndex: 'mpn',
    key: 'mpn',
    width: 120,
    align: 'center',
    render: text => text || '-',
    hidden: !columnVisibility.mpn,
  },
  {
    title: 'Make',
    dataIndex: 'make',
    key: 'make',
    width: 120,
    align: 'center',
    render: text => text || '-',
    hidden: !columnVisibility.make,
  },
    {
    title: 'Part No',
    dataIndex: 'part_no',
    key: 'part_no',
    width: 120,
    align: 'center',
    render: text => text || '-',
    hidden: !columnVisibility.part_no,
  },
    {
    title: 'UoM',
    dataIndex: 'uom',
    key: 'uom',
    width: 100,
    align: 'center',
    render: text => text || '-',
    hidden: !columnVisibility.uom,
  },
    {
    title: 'Vendor',
    key: 'vendor',
    width: 200,
    render: (_, record) => {
      if (editingVendorKey === record.key) {
        return (
          <Select
            value={record.vendorName}
            onChange={(value) => handleVendorChange(value, record)}
            onBlur={() => setEditingVendorKey(null)}
            className="w-full"
            placeholder="Select vendor"
            autoFocus
          >
            {vendors.map(vendor => (
              <Option key={vendor.id} value={vendor.name}>
                {vendor.name}
              </Option>
            ))}
          </Select>
        );
      }
      return (
        <Space>
          <span>{record.vendor_name || 'N/A'}</span>
          <EditOutlined
            onClick={() => setEditingVendorKey(record.key)}
            className="text-blue-600 hover:text-blue-800"
          />
        </Space>
      );
    },
    hidden: !columnVisibility.vendor,
  },
    {
    title: 'GST Type',
    dataIndex: 'taxType',
    key: 'taxType',
    width: 120,
    render: (_, record) => (
      <Select
        value={record.taxType}
        onChange={(value) => handleTaxTypeChange(record.key, value)}
        className="w-full"
        placeholder="Select GST"
      >
        {taxOptions.map((option) => (
          <Option key={option} value={option}>
            {option}
          </Option>
        ))}
      </Select>
    ),
    hidden: !columnVisibility.taxType,
  },
    {
    title: 'Qty',
    dataIndex: 'updated_requested_quantity',
    key: 'updated_requested_quantity',
    width: 120,
    align: 'center',
    render: (_, record) => (
      <InputNumber
        value={record.updated_requested_quantity || 0}
        min={1}
        onChange={(value) => handleQuantityChange(record.key, value)}
        className="w-full"
      />
    ),
    hidden: !columnVisibility.updated_requested_quantity,
  },
    {
    title: 'Rate/Unit',
    dataIndex: 'ratePerUnit',
    key: 'ratePerUnit',
    width: 120,
    align: 'center',
    render: (_, record) => (
      <InputNumber
        value={record.ratePerUnit || 0}
        min={0}
        step={0.01}
        onChange={(value) => handleRateChange(record.key, value)}
        className="w-full"
      />
    ),
    hidden: !columnVisibility.ratePerUnit,
  },
    {
    title: 'Amount',
    dataIndex: 'amount',
    key: 'amount',
    width: 120,
    align: 'center',
    render: amount => (parseFloat(amount) || 0).toFixed(2),
    hidden: !columnVisibility.amount,
  },
    {
    title: 'Tax Amount',
    dataIndex: 'taxAmount',
    key: 'taxAmount',
    width: 120,
    align: 'center',
    render: amount => (parseFloat(amount) || 0).toFixed(2),
    hidden: !columnVisibility.taxAmount,
  },
  {
  title: 'Total PO Cost',
  dataIndex: 'totalpo_cost',
  key: 'totalpo_cost',
  width: 120,
  align: 'center',
  render: value => (parseFloat(value) || 0).toFixed(2),
  hidden: !columnVisibility.totalpo_cost, // Add to columnVisibility state
},
    {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    align: 'center',
    render: status => status || '-',
    hidden: !columnVisibility.status,
  },
    {
    title: 'Previous Purchases',
    key: 'previous_purchases',
    render: (_, record) => (
      <Button
        type="link"
        onClick={() => showPreviousPurchasesModal(record.component_id)}
      >
        View Details
      </Button>
    ),
    className: 'text-gray-700 font-weight-medium',
    width: 120,
    hidden: !columnVisibility.previous_purchases,
  },
    {
    title: 'Actions',
    key: 'actions',
    width: 250,
    align: 'center',
    render: (_, record) => (
      <Space>
        <Button
          type="primary"
          size="small"
          onClick={() => handleRaiseSinglePO(record)}
          disabled={record.isRaised} // Disable Raise button for raised POs
        >
          Raise
        </Button>
        <Button
        type="default"
        size="small"
        icon={<EyeIcon className="h-4 w-4" />}
        onClick={() => handlePreview([record])}
        title="Preview PDF"
      />
      <Button
        type="default"
        size="small"
        icon={<ArrowDownTrayIcon className="h-4 w-4" />}
        onClick={() => handleDownload([record])}
        title="Download PDF"
      />
        <Button
          type="default"
          size="small"
          icon={<EnvelopeIcon className="h-4 w-4" />}
          onClick={() => handleEmail([record])}
        />
      </Space>
    ),
    hidden: !columnVisibility.actions,
  }
].filter(col => !col.hidden), [columnVisibility, selectedComponents, vendors, editingVendorKey, taxOptions]);

const previousPurchasesColumns = useMemo(() => [
  {
    title: 'PO Number',
    dataIndex: 'po_number',
    key: 'po_number',
    width: 150,
  },
  {
    title: 'Purchase Date',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 120,
  },
  {
    title: 'Vendor',
    dataIndex: 'vendor_name',
    key: 'vendor_name',
    width: 150,
    render: (vendorName) => (
      <Button
        type="link"
        onClick={() => {
          handleVendorSelectFromPrevious(vendorName);
          setIsPreviousPurchasesModalVisible(false);
        }}
      >
        {vendorName}
      </Button>
    ),
  },
  {
    title: 'Qty',
    dataIndex: 'updated_requested_quantity',
    key: 'updated_requested_quantity',
    width: 100,
  },
  {
    title: 'Rate/Unit',
    dataIndex: 'rate_per_unit',
    key: 'rate_per_unit',
    width: 100,
    render: value => (parseFloat(value) || 0).toFixed(2),
  },
  {
    title: 'Amount',
    dataIndex: 'amount',
    key: 'amount',
    width: 100,
    render: value => (parseFloat(value) || 0).toFixed(2),
  },
], []);

const modalColumns = [
  {
    title: 'PO Number',
    dataIndex: 'po_number',
    key: 'po_number',
    width: 150,
  },
  {
    title: 'Purchase Date',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 120,
  },
  {
    title: 'Vendor Name',
    dataIndex: 'vendor_name',
    key: 'vendor_name',
    width: 150,
  },
  {
    title: 'Ordered Quantity',
    dataIndex: 'updated_requested_quantity',
    key: 'updated_requested_quantity',
    render: text => text || 'N/A',
    width: 120,
  },
  {
    title: 'Rate/Unit',
    dataIndex: 'rate_per_unit',
    key: 'rate_per_unit',
    render: value => {
      const num = Number(value);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    },
    width: 100,
  },
  {
    title: 'Amount',
    dataIndex: 'amount',
    key: 'amount',
    render: value => {
      const num = Number(value);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    },
    width: 100,
  },
];

return (
  <div className="p-14 bg-gray-100 min-h-screen">
    <div className="bg-white rounded-lg shadow-md p-6 max-w-full">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">MRF Component Management</h2>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search by MRF, Description, MPN..."
            value={filters.search}
            onChange={handleSearchChange}
            className="w-64"
          />
          <Input
            placeholder="Search by Vendor..."
            value={filters.vendorSearch}
            onChange={handleVendorSearchChange}
            className="w-64"
          />
        </Space>
      </div>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-md font-semibold mb-2">Filters</h3>
        <Space>
          <Button
            onClick={() => setIsMpnFilterModalVisible(true)}
            type="primary"
          >
            Filter by MPN/Part No
          </Button>
          <Button
            onClick={() => setIsVendorFilterModalVisible(true)}
            type="primary"
          >
            Filter by Vendor
          </Button>
        </Space>
        <Modal
          title="Filter by MPN/Part No"
          open={isMpnFilterModalVisible}
          onCancel={() => setIsMpnFilterModalVisible(false)}
          onOk={() => setIsMpnFilterModalVisible(false)}
          okText="Apply"
          cancelText="Cancel"
        >
          <Input
            placeholder="Search MPN/Part No"
            value={mpnSearch}
            onChange={(e) => setMpnSearch(e.target.value)}
            className="mb-4 w-full"
          />
          <div className="max-h-80 overflow-y-auto">
            {distinctMpns
              .filter(item => `${item.mpn} / ${item.part_no}`.toLowerCase().includes(mpnSearch.toLowerCase()))
              .map(item => (
                <div key={item.key} className="flex items-center mb-2">
                  <Checkbox
                    checked={selectedMpns.includes(item.key)}
                    onChange={() => handleMpnCheckboxChange(item.key)}
                  />
                  <span className="ml-3 text-sm">{`${item.mpn} / ${item.part_no}`}</span>
                </div>
              ))}
          </div>
        </Modal>
        <Modal
          title="Filter by Vendor"
          open={isVendorFilterModalVisible}
          onCancel={() => setIsVendorFilterModalVisible(false)}
          onOk={() => setIsVendorFilterModalVisible(false)}
          okText="Apply"
          cancelText="Cancel"
        >
          <Input
            placeholder="Search Vendor"
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            className="mb-4 w-full"
          />
          <div className="max-h-80 overflow-y-auto">
            {distinctVendors
              .filter(vendor => vendor.toLowerCase().includes(vendorSearch.toLowerCase()))
              .map(vendor => (
                <div key={vendor} className="flex items-center mb-2">
                  <Checkbox
                    checked={selectedVendors.includes(vendor)}
                    onChange={() => handleVendorCheckboxChange(vendor)}
                  />
                  <span className="ml-3 text-sm">{vendor}</span>
                </div>
              ))}
          </div>
        </Modal>
      </div>

      <div className="flex justify-between mb-6">
        <Space>
          <Button
            type="primary"
            onClick={handleSelectAll}
          >
            {selectedComponents.length === filteredComponents.length ? 'Deselect All' : 'Select All'}
          </Button>
          <Button onClick={() => navigate('/po/raised')}>View Raised POs</Button>
       
          <Button onClick={() => navigate('/vendor/create')}>Create Vendor</Button>
        </Space>
        <Space>
          <Button
            type="primary"
            onClick={handleReviewComponents}
            disabled={!selectedComponents.length}
          >
            Review Components
          </Button>
          <Button onClick={() => setColumnVisibilityModalVisible(true)}>Customize Columns</Button>
        </Space>
      </div>

      <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
        <Table
          loading={loading}
          columns={columns}
          dataSource={filteredComponents}
          rowKey="key"
          rowClassName={(record) => (record.isRaised ? 'text-red-600' : '')} // Highlight raised POs
          pagination={{
            current: currentPage,
            pageSize,
            total: filteredComponents.length,
            showSizeChanger: false,
            onChange: setCurrentPage,
            position: ['bottomRight'],
          }}
          scroll={{ x: 1900 }}
          bordered
          className="min-w-full"
        />
      </div>

      <Modal
        title="Confirm Raise PO"
        open={isConfirmModalVisible}
        onOk={confirmRaisePO}
        onCancel={() => setIsConfirmModalVisible(false)}
        okText="Confirm"
        cancelText="Cancel"
        okButtonProps={{
          className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg',
          disabled: loading,
          loading: loading,
        }}
      >
        <p>Raise purchase order for {componentsToRaise.length} component(s)?</p>
       <div className="space-y-4">
          <div>
            <label className="block mb-1">Quotation Ref No. <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={quotationRefNo}
              onChange={handleModalQuotationRefChange}
              placeholder="Enter Ref No."
              className={`w-full p-2 border ${errors.quotationRefNo ? 'border-red-500' : 'border-gray-300'} rounded`}
            />
          </div>
          <div>
            <label className="block mb-1">Expected Delivery Date <span className="text-red-500">*</span></label>
            <DatePicker
              value={expectedDeliveryDate}
              onChange={handleModalDeliveryDateChange}
             format="DD-MM-YYYY"
              disabledDate={current => current && current.isBefore(moment(), 'day')}
              className={`w-full ${errors.expectedDeliveryDate ? 'border-red-500' : ''}`}
            />
          </div>
       
          <div>
            <label className="block mb-1">Payment Term <span className="text-red-500">*</span></label>

            <div className="flex space-x-2">
              <Select
                value={selectedPaymentTerm}
                onChange={handlePaymentTermChange}
                placeholder="Select Payment Term"
                className={`w-full ${errors.selectedPaymentTerm ? 'border-red-500' : ''}`}
              >
                {paymentTerms.map(term => (
                  <Option key={term.id} value={term.id}>
                    {term.description}
                  </Option>
                ))}
              </Select>
              <Button onClick={() => setIsAddPaymentTermModalVisible(true)}>Add Term</Button>
            </div>
          </div>
          <div>
            <label className="block mb-1">Other Term <span className="text-red-500">*</span></label>
            <div className="flex space-x-2">
              <div>
              <Select
                value={selectedOtherTerm}
                onChange={handleOtherTermChange}
                placeholder="Select Other Term"
                className={`w-full ${errors.selectedOtherTerm ? 'border-red-500' : ''}`}
              >
                {otherTerms.map(term => (
                  <Option key={term.id} value={term.id}>
                    {term.description}
                  </Option>
                ))}
              </Select>
              <Button onClick={() => setIsAddOtherTermModalVisible(true)}>Add Term</Button>
            </div>
          </div>
        </div>
        </div>
      </Modal>

      <Modal
        title="Previous Purchase Details"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {modalLoading ? (
          <Loader />
        ) : (
          <div>
            <Table
              columns={modalColumns}
              dataSource={modalData}
              pagination={false}
              bordered
              rowKey="po_number"
              className="w-full"
            />
            <p className="text-red-600 mt-2">* Amount is the Basic Total, and the GST was paid extra.</p>
          </div>
        )}
      </Modal>

      <Modal
        title="Add Payment Term"
        open={isAddPaymentTermModalVisible}
        onOk={() => paymentTermForm.submit()}
        onCancel={() => {
          setIsAddPaymentTermModalVisible(false);
          paymentTermForm.resetFields();
        }}
        okText="Add"
        cancelText="Cancel"
      >
        <Form
          form={paymentTermForm}
          onFinish={handleAddPaymentTerm}
          layout="vertical"
        >
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter payment term description' }]}
          >
            <Input type="text" placeholder="Enter description" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add Other Term"
        open={isAddOtherTermModalVisible}
        onOk={() => otherTermForm.submit()}
        onCancel={() => {
          setIsAddOtherTermModalVisible(false);
          otherTermForm.resetFields();
        }}
        okText="Add"
        cancelText="Cancel"
      >
        <Form
          form={otherTermForm}
          onFinish={handleAddOtherTerm}
          layout="vertical"
        >
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter term description' }]}
          >
            <Input type="text" placeholder="Enter description" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Purchase Order Raised"
        open={isSuccessModalVisible}
        onOk={() => setIsSuccessModalVisible(false)}
        onCancel={() => setIsSuccessModalVisible(false)}
        okText="OK"
        cancelText="Close"
      >
        <p>Purchase order raised successfully.</p>
      </Modal>

      <Modal
        title="Confirm Email"
        open={isEmailConfirmModalVisible}
        onOk={confirmSendEmail}
        onCancel={() => setIsEmailConfirmModalVisible(false)}
        okText="Send"
        cancelText="Cancel"
      >
        <p>Send email for this purchase order?</p>
      </Modal>

      <Modal
        title="PDF Preview"
        open={isPreviewModalVisible}
        onCancel={() => {
          setIsPreviewModalVisible(false);
          setPdfUrl(null);
          setNumPages(null);
        }}
        footer={[
          <Button key="download" type="primary" onClick={() => handleDownload()}>
            Download
          </Button>,
          <Button key="cancel" onClick={() => setIsPreviewModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {pdfUrl && (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => message.error('Failed to load PDF')}
          >
            {Array.from({ length: numPages || 0 }, (_, idx) => (
              <Page key={idx + 1} pageNumber={idx + 1} scale={1.2} />
            ))}
          </Document>
        )}
      </Modal>

      <Modal
        title="Previous Purchases"
        open={isPreviousPurchasesModalVisible}
        onCancel={() => setIsPreviousPurchasesModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsPreviousPurchasesModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {modalLoading ? (
          <Loader />
        ) : (
          <Table
            columns={previousPurchasesColumns}
            dataSource={modalData}
            pagination={false}
            bordered
            rowKey="po_number"
          />
        )}
      </Modal>

      <Modal
        title="Customize Columns"
        open={columnVisibilityModalVisible}
        onOk={() => setColumnVisibilityModalVisible(false)}
        onCancel={() => setColumnVisibilityModalVisible(false)}
        okText="Save"
        cancelText="Cancel"
      >
        <div className="space-y-2">
          {Object.keys(columnVisibility).map(key => (
            <div key={key} className="flex items-center">
              <Checkbox
                checked={columnVisibility[key]}
                onChange={(e) => setColumnVisibility({ ...columnVisibility, [key]: e.target.checked })}
              />
              <span className="ml-2">{key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
    <style jsx global>{`
        body {
          font-family: 'Inter', sans-serif;
        }
        .ant-table-thead > tr > th {
          background: #f8fafc;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
          text-align: center;
          padding: 14px 16px;
          font-size: 14px;
          transition: background 0.3s ease;
        }
        .ant-table-thead > tr > th, .ant-table-tbody > tr > td {
          padding: 12px;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
          text-align: center;
          padding: 14px 16px;
          font-size: 13px;
          transition: background 0.3s ease;
        }
        .ant-table-tbody > tr.ant-table-row:hover > td {
          background: #f1f5f9;
        }
        .ant-select-single .ant-select-selector,
        .ant-input-number,
        .ant-picker,
        .ant-input,
        .ant-input-textarea textarea {
          border-radius: 8px !important;
          border: 1px solid #d1d5db !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
          transition: all 0.3s ease;
        }
        .ant-input:focus,
        .ant-select-focused .ant-select-selector,
        .ant-picker-focused,
        .ant-input-number-focused,
        .ant-input-textarea textarea:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1) !important;
        }
        .ant-table-wrapper {
          max-height: 600px;
        }
        .ant-table-wrapper::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .ant-table-wrapper::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 12px;
        }
        .ant-table-wrapper::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 12px;
          border: 2px solid #f1f1f1;
        }
        .ant-table-wrapper::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .ant-message {
          z-index: 10001 !important;
          position: fixed !important;
          top: 80px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          width: auto !important;
          max-width: 600px !important;
          font-size: 16px !important;
        }
        .ant-message-notice-content {
          background: #ffffff !important;
          border: 1px solid #d9d9d9 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          border-radius: 6px !important;
          padding: 12px 24px !important;
        }
        .ant-message-error .ant-message-notice-content {
          background: #fff1f0 !important;
          border-color: #ffa39e !important;
          color: #cf1322 !important;
        }
        .text-red-600 {
    color: #dc2626 !important; // Tailwind's red-600 color
  }
  .text-red-600:hover > td {
    color: #b91c1c !important; // Darker red on hover
  }
  .bg-red-100, .bg-red-100:hover > td { // Remove red background if previously added
    background-color: transparent !important;
  }
        .border-red-500 {
          border-color: #ef4444 !important;
        }
        .focus\:border-red-500:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
        }
        .pulse {
          animation: pulse 0.3s ease-in-out;
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
  </div>
);
}


export default PurchaseHeadMrfSearchPage;