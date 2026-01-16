import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
// Add these imports at the top of MrfReviewPage.jsx
import { InfoCircleOutlined } from "@ant-design/icons";
import Loader from '../components/loading';
import {
  Table,
  Input,
  InputNumber,
  Button,
  Space,
  Checkbox,
  Select,
  Modal,
  message,
  DatePicker,
  Form,
} from "antd";
import {
  ArrowDownTrayIcon,
  XCircleIcon,
  EnvelopeIcon,
  TrashIcon,
  EyeIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { 
   raisePurchaseOrder,
   fetchAllVendors,
  // saveDraftPurchaseOrder,
  getPaymentTerms ,
   createPaymentTerm,
   getOtherTermsConditions,
   createOtherTermCondition,
   fetchUsers,
   fetchPreviousPurchases
  } from "../utils/api";

import { PlusOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import moment from "moment";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { useReactToPrint } from "react-to-print"; // Added import
import logo from "../assets/accelor-nobg.png";

// Dynamically set the worker source using the local pdfjs-dist worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min',
  import.meta.url
).href;

const { Option } = Select;

const API_BASE_URL = "http://localhost:5000/api/non_coc_components";

const MrfReviewPage = () => {
  useEffect(() => {
    message.config({
      top: 80,
      duration: 5,
      maxCount: 3,
      prefixCls: "ant-message",
    });
  }, []);

  const { state } = useLocation();
const { selectedComponents, vendorName } = state || { selectedComponents: [], vendorName: null };
  const navigate = useNavigate();
  const printRef = useRef();
  const [vendors, setVendors] = useState([]); // State to store fetched vendors
  const [vendorLoading, setVendorLoading] = useState(false); // State to handle vendor fetch loading
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(null);
    const [components, setComponents] = useState([]);
   const [paymentTerms, setPaymentTerms] = useState([]);
  const [otherTerms, setOtherTerms] = useState([]);
  const [selectedPaymentTerm, setSelectedPaymentTerm] = useState(null);
  const [selectedOtherTerm, setSelectedOtherTerm] = useState(null);
  const [isAddPaymentTermModalVisible, setIsAddPaymentTermModalVisible] = useState(false);
  const [isAddOtherTermModalVisible, setIsAddOtherTermModalVisible] = useState(false);
  const [paymentTermForm] = Form.useForm();
   const [columnVisibilityVisible, setColumnVisibilityVisible] = useState(false);
  const [otherTermForm] = Form.useForm();
  const [quotationRefNo, setQuotationRefNo] = useState("");
  const [currentTime, setCurrentTime] = useState(moment());
    const [modalVisible, setModalVisible] = useState(false);
   const [modalData, setModalData] = useState([]);
  const [vendor, setVendor] = useState(null);
    

    const [previousPurchasesData, setPreviousPurchasesData] = useState([]);
  // Add these state variables inside the MrfReviewPage component, after existing state declarations
const [isPreviousPurchasesModalVisible, setIsPreviousPurchasesModalVisible] = useState(false);

  const [modalLoading, setModalLoading] = useState(false);
  const [selectedMrfNo, setSelectedMrfNo] = useState(null); // Optional, for debugging

  const [vendorDetails, setVendorDetails] = useState({
    contactNo: "",
    email: "",
    contactPerson: "",
    address: "",
    gstin: "",
    pan: "",
  });
  const [errors, setErrors] = useState({
    contactNo: false,
    email: false,
    contactPerson: false,
    quotationRefNo: false,
    vendor: false,
    ratePerUnit: false,
    expectedDeliveryDate: false,
  });
    const [columnVisibility, setColumnVisibility] = useState({
      select: true,
      s_no: true,
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
      status: true,
      previous_purchases: true,
      actions: true,
    });
  const [errorMessages, setErrorMessages] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [purchaseHead, setPurchaseHead] = useState({ signature: null, name: 'N/A', designation: 'N/A' });
 const [users, setUsers] = useState([]); 
   const [isPoRaised, setIsPoRaised] = useState(false); // Track if PO is raised

    // START: Updated to taxOptions
  const taxOptions = [
    "1% GST", "2% GST", "5% GST", "12% GST", "18% GST", "28% GST",
    "1% GST RC", "2% GST RC", "5% GST RC", "12% GST RC", "18% GST RC", "28% GST RC",
    "1% IGST", "2% IGST", "5% IGST", "12% IGST", "18% IGST", "28% IGST",
    "1% IGST RC", "2% IGST RC", "5% IGST RC", "12% IGST RC", "18% IGST RC", "28% IGST RC"
  ];
  // END: Updated to taxOptions

  //const uomOptions = ["m", "cm", "l", "kl", "kg", "g", "unit", "pack"];

  const [updatedItems, setUpdatedItems] = useState(
  selectedComponents.map((c, index) => {
    console.log('Initializing component:', c); // Debug log
    return {
      ...c,
      key: `${c.mrf_no}-${c.part_no}-${index}`,
      component_id: c.component_id || c.id, // Explicitly ensure component_id
      updated_requested_quantity: c.updated_requested_quantity || c.initial_requested_quantity || 0,
      currentQty: c.updated_requested_quantity || c.initial_requested_quantity || 0,
      ratePerUnit: 0,
      amount: 0,
      uom: c.uom && c.uom.trim() !== "" ? c.uom : "-",
      taxType: "18% GST",
      taxAmount: 0,
      make: c.make || "",
    };
  })
);

   // Start: Generate PO number on component mount
  const [poNumber, setPoNumber] = useState("");
  useEffect(() => {
    if (selectedComponents.length > 0) {
      const generatePoNumber = () => {
        const date = moment().format("YYYYMMDD");
        const sequence = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");
        return `ACC/ADMIN/PO/${sequence}`;
      };
      setPoNumber(generatePoNumber());
    }
  }, [selectedComponents]);
  // End:

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
      setVendors(Array.isArray(vendorData) ? vendorData : Array.isArray(vendorData?.data) ? vendorData.data : []);
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

useEffect(() => {
  if (vendorName && vendors.length > 0) {
    const vendorExists = vendors.some(v => v.name === vendorName);
    setVendor(vendorExists ? vendorName : null);
    const selectedVendor = vendors.find(v => v.name === vendorName) || {};
    setVendorDetails({
      contactNo: selectedVendor.contact_no || "",
      email: selectedVendor.email_id || "",
      contactPerson: selectedVendor.contact_person_name || "",
      address: selectedVendor.address || "",
      gstin: selectedVendor.gstin || "",
      pan: selectedVendor.pan || "",
    });
  } else {
    setVendor(null);
    setVendorDetails({
      contactNo: "",
      email: "",
      contactPerson: "",
      address: "",
      gstin: "",
      pan: "",
    });
  }
}, [vendorName, vendors]); // Add vendors to dependency array

useEffect(() => {
  const initializeItems = async () => {
    setLoading(true);
    const items = await Promise.all(
      selectedComponents.map(async (c, index) => {
        console.log('Initializing component:', c);
        let componentId = c.component_id || c.id;
        let uom = c.uom || '-';

        // Fetch component_id and uom if missing
        if (!componentId || !uom || uom === '-') {
          try {
            const response = await axios.get('http://localhost:5000/api/non_coc_components/search', {
              params: { query: c.part_no, type: 'part_no' },
            });
            const match = response.data.find((item) => item.part_no === c.part_no);
            if (match) {
              componentId = componentId || match.component_id;
              uom = uom !== '-' ? uom : match.uom || 'unit';
            }
          } catch (error) {
            console.error(`Error fetching data for part_no ${c.part_no}:`, error.message);
          }
        }

        return {
          ...c,
          key: `${c.mrf_no || 'no-mrf'}-${c.part_no || 'no-part'}-${index}`,
          component_id: componentId, // May be undefined
          updated_requested_quantity: c.updated_requested_quantity || c.initial_requested_quantity || 0,
          currentQty: c.updated_requested_quantity || c.initial_requested_quantity || 0,
          ratePerUnit: 0,
          amount: 0,
          uom,
          taxType: '18% GST',
          taxAmount: 0,
          make: c.make || '',
        };
      })
    );

    if (items.length === 0) {
      console.warn('No components provided');
      message.warning('No components available for review.', 5);
    }
    setUpdatedItems(items);
    setLoading(false);
  };
  initializeItems();
}, [selectedComponents]);

  // Handle Ctrl+P for printing
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!selectedComponents || selectedComponents.length === 0) {
    return (
      <div className="min-h-screen elegant-bg overflow-y-auto">
        <div className="pt-16 px-4">
          <div className="w-full bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:shadow-2xl fade-in">
            <h1 className="text-3xl font-bold text-red-600">
              Error: No MRF components to review
            </h1>
            <button
              onClick={() => navigate("/mrf/purchase-head-search")}
              className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all pulse"
            >
              Go Back
            </button>
          
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

 // START: Add handlers for Payment Terms and Other Terms modals
  const handleAddPaymentTerm = async (values) => {
    try {
      const newTerm = await createPaymentTerm({ description: values.description });
      setPaymentTerms([...paymentTerms, newTerm]);
      setSelectedPaymentTerm(newTerm.description);
      setIsAddPaymentTermModalVisible(false);
      paymentTermForm.resetFields();
      message.success('Payment term added successfully.', 5);
    } catch (error) {
      message.error('Failed to add payment term.', 5);
    }
  };

  const handleAddOtherTerm = async (values) => {
    try {
      const newTerm = await createOtherTermCondition({ description: values.description });
      setOtherTerms([...otherTerms, newTerm]);
      setSelectedOtherTerm(newTerm.description);
      setIsAddOtherTermModalVisible(false);
      otherTermForm.resetFields();
      message.success('Other term added successfully.', 5);
    } catch (error) {
      message.error('Failed to add other term.', 5);
    }
  };
  // END: Add handlers for Payment Terms and Other Terms modals

  const handleDeleteRow = (key) => {
    setUpdatedItems(updatedItems.filter((item) => item.key !== key));
  };

   // START: Updated handleQuantityChange to use taxType and include CESS in taxAmount
  const handleQuantityChange = (key, value) => {
    const parsedValue = parseInt(value) || 0;
     const updated = updatedItems.map((item) => {
    if (item.key === key) {
      const newAmount = parsedValue * (item.ratePerUnit || 0);
      let taxAmount = 0;
      let taxRate = 0;
      const match = item.taxType.match(/(\d+\.?\d*)%/);
      const isGST = item.taxType.includes("GST") && !item.taxType.includes("IGST");
      const isIGST = item.taxType.includes("IGST");

      if (match && match[1]) {
        taxRate = parseFloat(match[1]) / 100;
      }

        if (isGST) {
          taxAmount = newAmount * taxRate; // CGST + SGST
        } else if (isIGST) {
          taxAmount = newAmount * taxRate; // IGST
        } 

        return {
          ...item,
          updated_requested_quantity: parsedValue,
          currentQty: parsedValue,
          amount: newAmount,
          taxAmount: taxAmount,
        };
      }
      return item;
    });
    setUpdatedItems(updated);
  };
  // END: Updated handleQuantityChange

    // START: Updated handleRateChange to use taxType and include CESS in taxAmount
  const handleRateChange = (key, value) => {
    const parsedValue = parseFloat(value) || 0;
    const referenceItem = updatedItems.find((item) => item.key === key);
    const referenceKey = `${referenceItem.mpn}-${referenceItem.item_description}`;
    const updated = updatedItems.map((item) => {
      if (`${item.mpn}-${item.item_description}` === referenceKey) {
        const newAmount = (item.currentQty || 0) * parsedValue;
        let taxAmount = 0;
         let taxRate = 0;
      const match = item.taxType.match(/(\d+\.?\d*)%/);
      const isGST = item.taxType.includes("GST") && !item.taxType.includes("IGST");
      const isIGST = item.taxType.includes("IGST");

      if (match && match[1]) {
        taxRate = parseFloat(match[1]) / 100;
      }

        if (isGST) {
          taxAmount = newAmount * taxRate; // CGST + SGST
        } else if (isIGST) {
          taxAmount = newAmount * taxRate; // IGST
        
        }

        return {
          ...item,
          ratePerUnit: parsedValue,
          amount: newAmount,
          taxAmount: taxAmount,
        };
      }
      return item;
    });
    if (parsedValue <= 0) {
      setErrors((prev) => ({ ...prev, ratePerUnit: true }));
      message.error("Rate/Unit must be a positive number.", 5);
    } else {
      setErrors((prev) => ({ ...prev, ratePerUnit: false }));
    }
    setUpdatedItems(updated);
  };
  // END: Updated handleRateChange


 

  const handleTaxTypeChange = (key, value) => {
    const referenceItem = updatedItems.find((item) => item.key === key);
    const referenceKey = `${referenceItem.mpn}-${referenceItem.item_description}`;
    const updated = updatedItems.map((item) => {
      if (`${item.mpn}-${item.item_description}` === referenceKey) {
        let taxAmount = 0;
       let taxRate = 0;
      const match = value.match(/(\d+\.?\d*)%/);
      const isGST = value.includes("GST") && !value.includes("IGST");
      const isIGST = value.includes("IGST");

      if (match && match[1]) {
        taxRate = parseFloat(match[1]) / 100;
      }

        if (isGST) {
          taxAmount = (item.amount || 0) * taxRate; // CGST + SGST
        } else if (isIGST) {
          taxAmount = (item.amount || 0) * taxRate; // IGST
        } 

        return {
          ...item,
          taxType: value,
          taxAmount: taxAmount,
        };
      }
      return item;
    });
    setUpdatedItems(updated);
  };
  // END: Updated handleTaxTypeChange


const handleVendorChange = (value) => {
  setVendor(value);
  if (!value) {
    setVendorDetails({
      contactNo: "",
      email: "",
      contactPerson: "",
      address: "",
      gstin: "",
      pan: "",
    });
    setErrors((prev) => ({
      ...prev,
      vendor: true,
      contactNo: false,
      email: false,
      contactPerson: false,
    }));
    message.error("Vendor selection is required.", 5);
  } else {
    const selectedVendor = (Array.isArray(vendors) ? vendors : []).find(
      (v) => v.name === value
    ) || {};

    setVendorDetails({
      contactNo: selectedVendor.contact_no || "",
      email: selectedVendor.email_id || "",
      contactPerson: selectedVendor.contact_person_name || "",
      address: selectedVendor.address || "",
      gstin: selectedVendor.gstin || "",
      pan: selectedVendor.pan || "",
    });
    setErrors((prev) => ({
      ...prev,
      vendor: false,
      contactNo: false,
      email: false,
      contactPerson: false,
    }));
  }
};

  const handleVendorDetailChange = (field, value) => {
    setVendorDetails((prev) => ({ ...prev, [field]: value }));
    if (field === "contactNo") {
      if (!value || !/^\d{10}$/.test(value)) {
        setErrors((prev) => ({ ...prev, contactNo: true }));
        if (value && value.length > 10) {
          message.error("Contact number must be exactly 10 digits.", 5);
        } else if (value && !/^\d+$/.test(value)) {
          message.error("Contact number must be numeric.", 5);
        } else {
          message.error("Contact number is required and must be 10 digits.", 5);
        }
      } else {
        setErrors((prev) => ({ ...prev, contactNo: false }));
      }
    } else if (field === "email") {
      if (!value || !value.includes("@")) {
        setErrors((prev) => ({ ...prev, email: true }));
        message.error('Email must contain an "@" symbol.', 5);
      } else {
        setErrors((prev) => ({ ...prev, email: false }));
      }
    } else if (field === "contactPerson") {
      if (!value || !value.trim()) {
        setErrors((prev) => ({ ...prev, contactPerson: true }));
        message.error("Contact person name is required.", 5);
      } else {
        setErrors((prev) => ({ ...prev, contactPerson: false }));
      }
    }
  };

  const handleQuotationRefNoChange = (value) => {
    setQuotationRefNo(value);
    if (!value || !value.trim()) {
      setErrors((prev) => ({ ...prev, quotationRefNo: true }));
      message.error("Quotation Ref No. is required.", 5);
    } else {
      setErrors((prev) => ({ ...prev, quotationRefNo: false }));
    }
  };

   const handleExpectedDeliveryDateChange = (dateString) => {
    setExpectedDeliveryDate(dateString);
    if (!dateString) {
      setErrors((prev) => ({ ...prev, expectedDeliveryDate: true }));
      message.error("Expected Delivery Date is required.", 5);
    } else if (moment(dateString).isBefore(moment().startOf("day"))) {
      setErrors((prev) => ({ ...prev, expectedDeliveryDate: true }));
      message.error("Expected Delivery Date cannot be in the past.", 5);
    } else {
      setErrors((prev) => ({ ...prev, expectedDeliveryDate: false }));
    }
  };

  const validateFields = () => {
    const newErrors = {
      contactNo: false,
      email: false,
      contactPerson: false,
      quotationRefNo: false,
      vendor: false,
      ratePerUnit: false,
       expectedDeliveryDate: false,
    };
    const messages = [];
    let isValid = true;

    if (!quotationRefNo || !quotationRefNo.trim()) {
      newErrors.quotationRefNo = true;
      messages.push("Quotation Ref No. is required.");
      message.error("Quotation Ref No. is required.", 5);
      isValid = false;
    }

     if (!expectedDeliveryDate) {
      newErrors.expectedDeliveryDate = true;
      messages.push("Expected Delivery Date is required.");
      message.error("Expected Delivery Date is required.", 5);
      isValid = false;
    } else if (moment(expectedDeliveryDate).isBefore(moment().startOf("day"))) {
      newErrors.expectedDeliveryDate = true;
      messages.push("Expected Delivery Date cannot be in the past.");
      message.error("Expected Delivery Date cannot be in the past.", 5);
      isValid = false;
    }

    if (!vendor) {
      newErrors.vendor = true;
      messages.push("Vendor selection is required.");
      message.error("Vendor selection is required.", 5);
      isValid = false;
    }

    if (!vendorDetails.contactNo || !/^\d{10}$/.test(vendorDetails.contactNo)) {
      newErrors.contactNo = true;
      messages.push("Contact number must be exactly 10 digits and numeric.");
      message.error("Contact number must be exactly 10 digits and numeric.", 5);
      isValid = false;
    }

    if (!vendorDetails.email || !vendorDetails.email.includes("@")) {
      newErrors.email = true;
      messages.push('Email must contain an "@" symbol.');
      message.error('Email must contain an "@" symbol.', 5);
      isValid = false;
    }

    if (!vendorDetails.contactPerson || !vendorDetails.contactPerson.trim()) {
      newErrors.contactPerson = true;
      messages.push("Contact person name is required.");
      message.error("Contact person name is required.", 5);
      isValid = false;
    }

    const invalidRateItems = updatedItems.filter(
      (item) => item.ratePerUnit <= 0
    );
    if (invalidRateItems.length > 0) {
      newErrors.ratePerUnit = true;
      messages.push("Rate/Unit must be a positive number for all items.");
      message.error("Rate/Unit must be a positive number for all items.", 5);
      isValid = false;
    }

   const missingUomItems = updatedItems.filter((item) => !item.uom || item.uom.trim() === "");
if (missingUomItems.length > 0) {
  messages.push("Unit of Measure (UoM) is missing or invalid for some items.");
  message.error("Unit of Measure (UoM) is missing or invalid for some items.", 5);
  isValid = false;
}

    setErrors(newErrors);
    setErrorMessages(messages);
    return isValid;
  };

  const handleRaisePO = () => {
    const isValid = validateFields();
    if (!isValid) {
      return;
    }
    setIsModalVisible(true);
  };

  // const confirmRaisePO = async () => {
  //   if (loading) return;
  //   setLoading(true);
  //   setIsModalVisible(false);
  //   try {
  //     const selectedVendor = vendors.find((v) => v.name === vendor);
  //     const items = updatedItems.map((item) => ({
  //       mrf_no: item.mrf_no,
  //       updated_requested_quantity: item.updated_requested_quantity,
  //       uom: item.uom,
  //       ratePerUnit: item.ratePerUnit,
  //       amount: item.amount,
  //       taxAmount: item.taxAmount, // Changed from gstAmount
  //       mpn: item.mpn,
  //       item_description: item.item_description,
  //       make: item.make,
  //       part_no: item.part_no,
  //     }));

  //     const payload = {
  //       items,
  //       vendor: {
  //         name: selectedVendor.name,
  //         address: selectedVendor.address,
  //         gstin: selectedVendor.gstin,
  //         pan: selectedVendor.pan,
  //         contactNo: vendorDetails.contactNo,
  //         email: vendorDetails.email,
  //         contactPerson: vendorDetails.contactPerson,
  //       },
  //       quotation_no: quotationRefNo,
  //       po_number: poNumber,
  //       totalpo_cost: totalPoCost,
  //       expected_delivery_date: expectedDeliveryDate,
  //       payment_term: selectedPaymentTerm,
  //       other_terms: selectedOtherTerm,
  //     };

  
  //     const response = await raisePurchaseOrder(payload);

  //     const singlePoNumber = response.data[0]?.po_number || poNumber;
  //     setPoNumber(singlePoNumber);
  //      setIsPoRaised(true); // Disable Raise PO button
  //     message.success(
  //       `Purchase order raised successfully: ${singlePoNumber} for ${response.data.length} components`,
  //       5
  //     );

  //   alert( `Purchase order raised successfully: ${singlePoNumber} for ${response.data.length} components`);
  //    // navigate("/mrf/purchase-head-search");
  //   } catch (error) {
  //     console.error("Error raising purchase order:", error);
  //     if (
  //       error.response?.status === 400 &&
  //       error.response?.data?.error.includes("already has status PO Raised")
  //     ) {
  //       const poNumberQuery = await fetchPoNumberForMrfs(
  //         updatedItems.map((item) => item.mrf_no)
  //       );
  //       if (poNumberQuery) {
  //         setPoNumber(poNumberQuery);
  //         message.info(
  //           `Purchase order already raised: ${poNumberQuery} for ${updatedItems.length} components`,
  //           5
  //         );
  //       //  navigate("/mrf/purchase-head-search");
  //       } else {
  //         message.error(
  //           "Failed to fetch existing PO number. Please check the status manually.",
  //           5
  //         );
  //       }
  //     } else if (
  //       error.response?.status === 400 &&
  //       error.response?.data?.error.includes(
  //         "duplicate key value violates unique constraint"
  //       )
  //     ) {
  //       message.info(
  //         "Some components may already be part of this purchase order. Please check the status.",
  //         5
  //       );
  //     //  navigate("/mrf/purchase-head-search");
  //     } else {
  //       const errorMessage =
  //         error.response?.data?.error ||
  //         "Failed to raise purchase order. Please try again.";
  //       message.error(errorMessage, 5);
  //     }
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const confirmRaisePO = async () => {
  if (loading) return;
  setLoading(true);
  setIsModalVisible(false);
  try {
    const selectedVendor = vendors.find((v) => v.name === vendor);
    const items = updatedItems.map((item) => ({
      mrf_no: item.mrf_no,
      updated_requested_quantity: item.updated_requested_quantity,
      uom: item.uom,
      ratePerUnit: item.ratePerUnit,
      amount: item.amount,
      taxAmount: item.taxAmount,
      mpn: item.mpn,
      item_description: item.item_description,
      make: item.make,
      part_no: item.part_no,
      totalpo_cost: item.amount + item.taxAmount, // Add totalpo_cost to each item
    }));

    const payload = {
      items,
      vendor: {
        name: selectedVendor.name,
      },
      quotation_no: quotationRefNo,
      totalpo_cost: totalPoCost, // Keep top-level totalpo_cost for overall sum
      expected_delivery_date: expectedDeliveryDate,
      payment_term_id: selectedPaymentTerm,
      other_term_condition_id: selectedOtherTerm,
    };

    const response = await raisePurchaseOrder(payload);

    const singlePoNumber = response.data[0]?.po_number || poNumber;
    setPoNumber(singlePoNumber);
    setIsPoRaised(true);
    message.success(
      `Purchase order raised successfully: ${singlePoNumber} for ${response.data.length} components`,
      5
    );
    alert(`Purchase order raised successfully: ${singlePoNumber} for ${response.data.length} components`);
    // navigate("/mrf/purchase-head-search");
  } catch (error) {
    console.error("Error raising purchase order:", error);
    if (
      error.response?.status === 400 &&
      error.response?.data?.error.includes("already has status PO Raised")
    ) {
      const poNumberQuery = await fetchPoNumberForMrfs(
        updatedItems.map((item) => item.mrf_no)
      );
      if (poNumberQuery) {
        setPoNumber(poNumberQuery);
        message.info(
          `Purchase order already raised: ${poNumberQuery} for ${updatedItems.length} components`,
          5
        );
        // navigate("/mrf/purchase-head-search");
      } else {
        message.error(
          "Failed to fetch existing PO number. Please check the status manually.",
          5
        );
      }
    } else if (
      error.response?.status === 400 &&
      error.response?.data?.error.includes(
        "duplicate key value violates unique constraint"
      )
    ) {
      message.info(
        "Some components may already be part of this purchase order. Please check the status.",
        5
      );
      // navigate("/mrf/purchase-head-search");
    } else {
      const errorMessage =
        error.response?.data?.error ||
        "Failed to raise purchase order. Please try again.";
      message.error(errorMessage, 5);
    }
  } finally {
    setLoading(false);
  }
};


// Replace fetchComponentPreviousPurchases function
const fetchComponentPreviousPurchases = async (component_id) => {
  console.log('Fetching previous purchases for component_id:', component_id);
  setModalLoading(true);
  setModalData([]);

  // Validate component_id
  if (!component_id || isNaN(parseInt(component_id))) {
    console.warn('Invalid or missing component_id:', component_id);
    message.info('No previous purchase data available for this component.', 5);
    setModalData([
      {
        key: 'no-data',
        po_number: 'N/A',
        created_at: 'N/A',
        vendor_name: 'No previous purchases found',
        updated_requested_quantity: 'N/A',
        rate_per_unit: 0,
        amount: 0,
      },
    ]);
    setModalLoading(false);
    setModalVisible(true);
    return;
  }

  try {
    const filters = {
      componentId: parseInt(component_id).toString(),
      limit: 5,
      sort: 'created_at DESC',
    };
    console.log('Sending filters to API:', filters);
    const data = await fetchPreviousPurchases(filters);
    console.log('Received previous purchases data:', data);

    const enhancedData = data.length > 0
      ? data.slice(0, 5).map((item, index) => ({
          key: item.po_number || `key-${index}`,
          po_number: item.po_number || 'N/A',
          created_at: item.created_at || 'N/A',
          vendor_name: item.vendor_name || 'N/A',
          updated_requested_quantity: item.updated_requested_quantity || 'N/A',
          rate_per_unit: isNaN(parseFloat(item.rate_per_unit)) ? 0 : parseFloat(item.rate_per_unit),
          amount: isNaN(parseFloat(item.amount)) ? 0 : parseFloat(item.amount),
        }))
      : [
          {
            key: 'no-data',
            po_number: 'N/A',
            created_at: 'N/A',
            vendor_name: 'No previous purchases found',
            updated_requested_quantity: 'N/A',
            rate_per_unit: 0,
            amount: 0,
          },
        ];

    setModalData(enhancedData);
    setModalVisible(true);
    if (data.length === 0) {
      message.info('No previous purchase records found for this component.', 5);
    }
  } catch (error) {
    console.error('Error fetching previous purchases:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    message.error('Failed to fetch previous purchase details.', 5);
    setModalData([
      {
        key: 'no-data',
        po_number: 'N/A',
        created_at: 'N/A',
        vendor_name: 'No previous purchases found',
        updated_requested_quantity: 'N/A',
        rate_per_unit: 0,
        amount: 0,
      },
    ]);
    setModalVisible(true);
  } finally {
    setModalLoading(false);
  }
};

 const showModal = (component_id) => {
    fetchComponentPreviousPurchases(component_id);
    setModalVisible(true);
  };

  const fetchPoNumberForMrfs = async (mrfNos) => {
    try {
     const response = await axios.get(`${API_BASE_URL}/search`, {
  params: { query: searchQuery, type: 'part_no' },
});
console.log('API Response for components:', response.data);

      if (!response.ok) {
        throw new Error("Failed to fetch PO number");
      }

      const data = await response.json();
      return data.po_number || null;
    } catch (error) {
      console.error("Error fetching PO number for MRFs:", error);
      return null;
    }
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
      drawTwoColumnRow('Basic Total:', `Rs. ${basicTotal.toFixed(2)}`, currentY);
      currentY += rowHeight;

      taxRates.forEach((rate, index) => {
          if (cgstTotals[index] > 0) {
            if (currentY + 2 * rowHeight > contentThreshold) {
              doc.addPage();
              currentPage++;
              currentY = 15;
            }
          drawTwoColumnRow(`CGST (${rate * 100 / 2}%):`, `Rs. ${cgstTotals[index].toFixed(2)}`, currentY);
          currentY += rowHeight;
          drawTwoColumnRow(`SGST (${rate * 100 / 2}%):`, `Rs. ${sgstTotals[index].toFixed(2)}`, currentY);
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
          drawTwoColumnRow(`IGST (${rate * 100}%):`, `Rs. ${igstTotals[index].toFixed(2)}`, currentY);
          currentY += rowHeight;
        }
      });

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
        `Payment Terms: ${selectedPaymentTerm || 'N/A'}`,
        `Other Terms and Conditions: ${selectedOtherTerm || 'N/A'}`
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

  const addTerms = (y) => {
  const generalTerms = [
    '1. Certificate of Conformance along with batch code/date code is to be provided along with invoice (Format attached as Annexure I). CoC in any other format will not be acceptable.',
    '2. OEM certificate/Authorized Distributor certificate/Traceability certificate (whichever applicable) is mandatory to be provided along with invoice.',
    '3. Material should be delivered along with Original and Duplicate Invoice for Recipient, in absence of these documents material will not be accepted.',
    '4. Quoting of our GSTN No. in tax invoice is mandatory. In case same is not mentioned in the invoice we will not be liable for payment of GST.',
    '5. All invoices to have HSN Code of the material being invoiced/Service Accounting Code (SAC) of services being supplied. Without this supply/service invoice will not be accepted.',
    '6. Disclaimer: Classification of goods/services under proper HSN Code is your responsibility & we will not entertain any claim arising out of any change by you at a later stage.',
    '7. Time is essence of this order and delivery must be made as per delivery schedules unless otherwise consented with us in writing.',
    '8. In the event, the supplier fails to deliver the goods of the ordered quality or deliver different and/or sub-standard make/quality, or if material delivered without CoC, the company reserves the right to reject the material and inform the supplier to lift the material from our stores at his own cost. Incoming freight, if any, paid for these shall also be recovered. Breakage/loss if any during transit due to poor packing or handling shall be to supplier’s account.',
    '9. Please ensure that your GST/PAN/CIN No’s, are mentioned on your invoices.',
    '10. Arbitration: All disputes of differences whatsoever arising between the parties out of or in relation to work/supply of work order/purchase order or effect to dis-contract or breach thereof shall be settled amicably. However, if the parties are unable to solve them amicably, the same shall be finalized setting by arbitration and reconciliation. The award may in pursuance thereafter shall be final and binding on the parties. The venue of arbitration shall be Mohali (India).'
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

      // Justify all lines except the last one in the term
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
        doc.text(line, xStart, cursorY); // Last line: left-aligned
      }

      cursorY += 5;
    });

    cursorY += 2; // Small padding between terms
  });

  // Add spacing before signature section
  if (cursorY + 40 > contentThreshold) {
    doc.addPage();
    currentPage++;
    cursorY = 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  cursorY += 10;

  // Signature block
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


    // Updated function to add Certificate of Conformance (Annexure I) with all fields blank
     const addCertificateOfConformance = (y) => {
      doc.addPage();
      currentPage++;
      cocPageNumber = currentPage; // Store CoC page number
      const startX = 18;
      const fullWidth = 182;
      const pageWidth = doc.internal.pageSize.getWidth();
      let cursorY = 18;

      // Annexure I centered with underline and Form Number without underline
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const annexureText = 'Annexure I';
      const formNumber = 'F-Admin-005';
      doc.text(annexureText, pageWidth / 2, cursorY, { align: 'center' });
      const annexureTextWidth = doc.getTextWidth(annexureText);
      doc.line(pageWidth / 2 - annexureTextWidth / 2, cursorY + 1, pageWidth / 2 + annexureTextWidth / 2, cursorY + 1); // Underline Annexure I
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8); // Smaller font for form number
      doc.text(formNumber, pageWidth - 20, cursorY, { align: 'right' });
      cursorY += 14;

      // Authorized Distributor's/OEM Name and Address
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Authorised Distributor\'s/OEM Name and Address', startX, cursorY);
      cursorY += 10;
      const vendorDetailsText = ''; // Blank
      const wrappedVendor = doc.splitTextToSize(vendorDetailsText, fullWidth - 4);
      doc.setFont('helvetica', 'normal');
      wrappedVendor.forEach(line => {
        doc.text(line, startX, cursorY);
        cursorY += 5;
      });
      cursorY += 5;

      // Customer's Name and Address
      doc.setFont('helvetica', 'bold');
      doc.text('Customer\'s Name and Address', startX, cursorY);
      cursorY += 10;
      const customerDetails = ''; // Blank
      const wrappedCustomer = doc.splitTextToSize(customerDetails, fullWidth - 4);
      doc.setFont('helvetica', 'normal');
      wrappedCustomer.forEach(line => {
        doc.text(line, startX, cursorY);
        cursorY += 5;
      });
      cursorY += 5;

      // Date moved to right side
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Date:', pageWidth - 60, cursorY);
      drawDottedLine(pageWidth - 60 + doc.getTextWidth('Date:') + 2, cursorY, pageWidth - 20, cursorY); // Period-like dotted line
      cursorY += 10;

      // Certificate Title with underline
      doc.setFontSize(10);
      const certText = 'CERTIFICATE OF CONFORMANCE';
      doc.text(certText, pageWidth / 2, cursorY, { align: 'center' });
      const certTextWidth = doc.getTextWidth(certText);
      doc.line(pageWidth / 2 - certTextWidth / 2, cursorY + 1, pageWidth / 2 + certTextWidth / 2, cursorY + 1); // Underline
      cursorY += 10;

      // 5 lines of period-like dots
      for (let i = 0; i < 5; i++) {
        drawDottedLine(startX, cursorY, startX + fullWidth -10 , cursorY);
        cursorY += 8;
      }
      cursorY += 5;

      // PO and Invoice Details with period-like dotted lines
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PO No.:', startX, cursorY);
      drawDottedLine(startX + doc.getTextWidth('PO No.:') + 2, cursorY, startX + 60, cursorY); // Period-like dotted line
      doc.text('Date:', startX + 90, cursorY);
      drawDottedLine(startX + 90 + doc.getTextWidth('Date:') + 2, cursorY, startX + 150, cursorY); // Period-like dotted line
      cursorY += 5;
      doc.text('INVOICE No.:', startX, cursorY);
      drawDottedLine(startX + doc.getTextWidth('INVOICE No.:') + 2, cursorY, startX + 60, cursorY); // Period-like dotted line
      doc.text('Date:', startX + 90, cursorY);
      drawDottedLine(startX + 90 + doc.getTextWidth('Date:') + 2, cursorY, startX + 150, cursorY); // Period-like dotted line
      cursorY += 10;

      // Table with smaller row height
      const tableColumns = [
        { header: 'Sr. No.', dataKey: 'srNo', width: 15 },
        { header: 'Make', dataKey: 'make', width: 30 },
        { header: 'MPN\n(Part Number)', dataKey: 'mpn', width: 30 },
        { header: 'Device type\n(Components Description)', dataKey: 'deviceType', width: 40 },
        { header: 'Quantity', dataKey: 'quantity', width: 20 },
        { header: 'Lot No./Batch\nCode *', dataKey: 'lotNo', width: 20 },
        { header: 'Date\nCode *', dataKey: 'dateCode', width: 17 }
      ];

      // Empty table data for 6 rows
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

      // Authorized Signature moved to right side
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

    // doc.setFont('helvetica', 'bold').text('Sr Manager(Admin)', 14, y + 10);

    // Add footer to all pages except CoC
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


const handlePrint = () => {
  try {
    const doc = generatePDF();
    if (doc) {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow.focus();
        // Add an afterprint event listener to clean up after the print dialog closes
        const handleAfterPrint = () => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
          // Remove the event listener to avoid memory leaks
          iframe.contentWindow.removeEventListener("afterprint", handleAfterPrint);
        };
        iframe.contentWindow.addEventListener("afterprint", handleAfterPrint);
        iframe.contentWindow.print();
      };
    }
  } catch (error) {
    console.error("Error printing PDF:", error);
    message.error("Failed to print PDF. Please try again.", 5);
  }
};

  const handleDownload = () => {
    try {
      const doc = generatePDF();
      if (doc) {
        doc.save(
          `${selectedComponents[0]?.mrf_no}_${
            poNumber || "Purchase Order"
          }.pdf`
        );
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      message.error("Failed to generate PDF. Please try again.", 5);
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

  const columns = useMemo(
    () => [
{
  title: 'S.No',
  key: 's_no',
  width: 70,
  align: 'center',
  render: (_text, _record, index) => index + 1,
  fixed: 'left',
  hidden: !columnVisibility.s_no,
},

      {
        title: "MRF No",
        dataIndex: "mrf_no",
        key: "mrf_no",
        width: 120,
        render: (text) => text || "-",
      },
      {
        title: "Item Description",
        dataIndex: "item_description",
        key: "item_description",
        width: 200,
        render: (text) => text || "-",
      },
      {
        title: "MPN",
        dataIndex: "mpn",
        key: "mpn",
        width: 150,
        render: (text) => text || "-",
      },
      {
        title: "Make",
        dataIndex: "make",
        key: "make",
        width: 120,
        render: (text) => text || "-",
      },
      {
        title: "Part No",
        dataIndex: "part_no",
        key: "part_no",
        width: 120,
        render: (text) => text || "-",
      },
      {
  title: "UoM",
  dataIndex: "uom",
  key: "uom",
  width: 100,
  align: "center",
  render: (text) => text || "-",
},
      {
        title: "Tax Type",
        dataIndex: "taxType",
        key: "taxType",
        width: 150,
        render: (_, record) => (
          <Select
            value={record.taxType}
            onChange={(value) => handleTaxTypeChange(record.key, value)}
            placeholder="Select Tax Type"
            className="w-full h-10 rounded-lg"
          >
            {taxOptions.map((option) => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
          </Select>
        ),
      },
      {
        title: "Updated Quantity",
        dataIndex: "updated_requested_quantity",
        key: "updated_requested_quantity",
        width: 150,
        render: (_, record) => (
          <InputNumber
            value={record.updated_requested_quantity}
            onChange={(value) => handleQuantityChange(record.key, value)}
            min={0}
            className="w-full h-10 rounded-lg"
          />
        ),
      },
      {
        title: "Rate/Unit",
        dataIndex: "ratePerUnit",
        key: "ratePerUnit",
        width: 120,
        render: (_, record) => (
          <InputNumber
            value={record.ratePerUnit}
            onChange={(value) => handleRateChange(record.key, value)}
            min={0}
            step={0.01}
            className={`w-full h-10 rounded-lg ${
              errors.ratePerUnit && record.ratePerUnit <= 0
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300"
            }`}
          />
        ),
      },
      {
        title: "Amount in INR",
        dataIndex: "amount",
        key: "amount",
        width: 150,
        render: (text) => (typeof text === "number" ? text.toFixed(2) : "0.00"),
      },
      {
        title: "Tax Amount",
        dataIndex: "taxAmount",
        key: "taxAmount",
        width: 150,
        render: (text) => (typeof text === "number" ? text.toFixed(2) : "0.00"),
      },
          {
  title: 'Previous Purchases',
  key: 'previous_purchases',
  render: (_, record) => {
    console.log('Record component_id:', record.component_id);
    return (
      <Button
        type="link"
        onClick={() => showModal(record.component_id)}
      >
        View Details
      </Button>
    );
  },
  className: 'text-gray-700 font-medium',
  width: 120,
},
      {
        title: "Action",
        key: "action",
        width: 80,
        render: (_, record) => (
          <button
            onClick={() => handleDeleteRow(record.key)}
            className="text-red-600 hover:text-red-800 transition-all transform hover:scale-110"
            title="Delete"
          >
            <TrashIcon className="h-6 w-6" />
          </button>
        ),
      },
    ],
    [updatedItems, errors.ratePerUnit]
  );

// START: Updated total calculations to use taxType and include CESS
  const basicTotal = updatedItems.reduce(
    (sum, item) => sum + (item.amount || 0),
    0
  );
  const taxRates = [0.01, 0.02, 0.05, 0.12, 0.18, 0.28];
  const cgstTotals = taxRates.map(rate =>
  updatedItems
    .filter(i => new RegExp(`^${rate * 100}% GST$`).test(i.taxType))
    .reduce((sum, i) => sum + (i.taxAmount || 0) / 2, 0)
);

  const sgstTotals = cgstTotals;
  const igstTotals = taxRates.map(rate =>
  updatedItems
    .filter(i => new RegExp(`^${rate * 100}% IGST$`).test(i.taxType))
    .reduce((sum, i) => sum + (i.taxAmount || 0), 0)
);

  const totalPoCost = basicTotal + 
    cgstTotals.reduce((sum, val) => sum + val, 0) + 
    sgstTotals.reduce((sum, val) => sum + val, 0) + 
    igstTotals.reduce((sum, val) => sum + val, 0) ;


  const hasGST = updatedItems.some((item) => item.taxType.includes("GST") && !item.taxType.includes("IGST"));
  const hasIGST = updatedItems.some((item) => item.taxType.includes("IGST"));
  // END: Updated total calculations

  const selectedVendor = (vendors || []).find((v) => v.name === vendor) || {};

  const handleEmail = () => {
    const subject = "MRF Review";
    const body = `Please find the MRF review details.\nVendor: ${
      selectedVendor.name || "N/A"
    }\nPurchase Order No.: ${
      poNumber || "N/A"
    }\nTotal PO Cost: INR ${totalPoCost.toFixed(2)}\nComponents: ${
      updatedItems.length
    }\n\nDownload the attached PDF for detailed information.
  Note: The date code must not be older than 2 years`;
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=&subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(gmailLink, "_blank");
  };

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
    width: 100,
    render: text => {
      const value = parseFloat(text);
      return isNaN(value) ? '0.00' : value.toFixed(2);
    },
  },
  {
    title: 'Amount',
    dataIndex: 'amount',
    key: 'amount',
    width: 100,
    render: text => {
      const value = parseFloat(text);
      return isNaN(value) ? '0.00' : value.toFixed(2);
    },
  },
];

  return (
    <div className="min-h-screen elegant-bg overflow-y-auto">
      <div className="pt-0 px-4">
        <div className="w-full mx-auto p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:shadow-2xl fade-in">
            {errorMessages.length > 0 && (
              <div className="mb-6 space-y-2">
                {errorMessages.map((msg, index) => (
                  <div
                    key={index}
                    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
                    role="alert"
                  >
                    <span className="font-medium">Error: </span>
                    {msg}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mb-8">
              <div className="flex flex-col justify-center h-full">
                <h1 className="text-3xl font-bold text-blue-800 border-l-4 border-green-600 pl-4 animate-slide-in">
                  Review Selected MRF Components
                </h1>

                <div className="h-8" />
              </div>
              <div className="flex flex-col items-end space-y-2">
                <span className="text-sm font-medium text-gray-700 bg-gray-100 px-4 py-2 rounded-full shadow-sm">
                  {currentTime.format("MMMM DD, YYYY, hh:mm:ss A")}
                </span>
                <div className="flex space-x-4">
                  <button
                    onClick={handlePreview}
                    className="text-gray-600 hover:text-blue-600 transition-all transform hover:scale-110 pulse"
                    title="Preview PDF"
                  >
                    <EyeIcon className="h-8 w-8" />
                  </button>
                   <button
                    onClick={handlePrint}
                    className="text-gray-600 hover:text-blue-600 transition-all transform hover:scale-110 pulse"
                    title="Print PDF"
                  >
                    <PrinterIcon className="h-8 w-8" />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="text-gray-600 hover:text-green-600 transition-all transform hover:scale-110 pulse"
                    title="Download as PDF"
                  >
                    <ArrowDownTrayIcon className="h-8 w-8" />
                  </button>
                  <button
                    onClick={() => navigate("/mrf/purchase-head-search")}
                    className="text-gray-600 hover:text-red-600 transition-all transform hover:scale-110 pulse"
                    title="Cancel"
                  >
                    <XCircleIcon className="h-9 w-9" />
                  </button>
                    <Button
                            onClick={() => setColumnVisibilityVisible(true)}
                            className="!bg-yellow-500 !text-white hover:bg-yellow-600 h-10 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            Customize Columns
                          </Button>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl mb-8 shadow-inner fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Quotation Ref No. <span className="text-red-500"></span>
                  </label>
                  <Input
                    value={quotationRefNo}
                    onChange={(e) => handleQuotationRefNoChange(e.target.value)}
                    placeholder="Enter Quotation Ref No."
                    className={`w-full h-12 rounded-lg shadow-sm mb-4 ${
                      errors.quotationRefNo
                        ? "border-red-500 focus:border-red-500"
                        : "border-gray-300"
                    }`}
                  />
                </div>
                <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Expected Delivery Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
  value={expectedDeliveryDate ? moment(expectedDeliveryDate) : null}
  onChange={(date, dateString) => handleExpectedDeliveryDateChange(dateString)}
  format="YYYY-MM-DD"
  disabledDate={(current) => current && current < moment().startOf("day")}
  picker="date"
  showToday={true}
  yearDropdownItemNumber={5}
  scrollToYear={moment().year()}
  className={`w-full h-12 rounded-lg shadow-sm ${
    errors.expectedDeliveryDate
      ? "border-red-500 focus:border-red-500"
      : "border-gray-300"
  }`}
  placeholder="Select Expected Delivery Date"
/>
              </div>
<div>
  <label className="block text-sm font-semibold text-gray-800 mb-2">
    Vendor <span className="text-red-500">*</span>
  </label>
  <Select
    value={vendor || undefined} // Use undefined when null to reset selection
    onChange={handleVendorChange}
    placeholder="Select a vendor"
    className={`w-full h-12 rounded-lg ${
      errors.vendor ? "border-red-500 focus:border-red-500" : ""
    }`}
    loading={vendorLoading}
    disabled={vendorLoading}
    showSearch
    filterOption={(input, option) =>
      option?.value?.toLowerCase().includes(input.toLowerCase())
    }
    dropdownRender={(menu) => (
      <>
        <div
          style={{
            padding: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            backgroundColor: "#f5f5f5",
          }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => navigate("/vendor/create")}
        >
          <PlusOutlined style={{ marginRight: "8px" }} />
          Add New Vendor
        </div>
        {menu}
      </>
    )}
  >
    {Array.isArray(vendors) &&
      vendors.map((v) => (
        <Option key={v.id} value={v.name}>
          {v.name}
        </Option>
      ))}
  </Select>
</div>
              </div>

              {selectedVendor.name && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                  className="mt-10 p-6 bg-white rounded-xl shadow-inner"
                >
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    Vendor Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Address
                      </label>
                      <Input
                        value={vendorDetails.address}
                        disabled
                        className="w-full h-12 bg-gray-300 text-gray-900 font-medium rounded-lg shadow-sm border border-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        GSTIN
                      </label>
                      <Input
                        value={vendorDetails.gstin}
                        disabled
                        className="w-full h-12 bg-gray-300 text-gray-900 font-medium rounded-lg shadow-sm border border-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        PAN No.
                      </label>
                      <Input
                        value={vendorDetails.pan}
                        disabled
                        className="w-full h-12 bg-gray-300 text-gray-900 font-medium rounded-lg shadow-sm border border-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Contact No. <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={vendorDetails.contactNo}
                        onChange={(e) =>
                          handleVendorDetailChange("contactNo", e.target.value)
                        }
                        placeholder="Enter contact number"
                        className={`w-full h-12 rounded-lg shadow-sm ${
                          errors.contactNo
                            ? "border-red-500 focus:border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Email Id <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={vendorDetails.email}
                        onChange={(e) =>
                          handleVendorDetailChange("email", e.target.value)
                        }
                        placeholder="Enter email"
                        className={`w-full h-12 rounded-lg shadow-sm ${
                          errors.email
                            ? "border-red-500 focus:border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Contact Person Name{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={vendorDetails.contactPerson}
                        onChange={(e) =>
                          handleVendorDetailChange(
                            "contactPerson",
                            e.target.value
                          )
                        }
                        placeholder="Enter contact person name"
                        className={`w-full h-12 rounded-lg shadow-sm ${
                          errors.contactPerson
                            ? "border-red-500 focus:border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <Table
              dataSource={updatedItems}
              columns={columns}
              rowKey="key"
              className="w-full rounded-xl shadow-md overflow-hidden"
              rowClassName="hover:bg-blue-50 transition-colors duration-200 row-enter"
              pagination={{ pageSize: 10 }}
              scroll={{ x: "max-content", y: 400 }}
              bordered
            />

            <div className="mt-8 bg-gray-50 p-6 rounded-xl shadow-inner fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Basic Total (INR)
                  </label>
                   <div className="w-full h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                  Rs.{basicTotal.toFixed(2)}
                </div>
                </div>
                {hasGST &&
                    taxRates.map((rate, index) =>
                      cgstTotals[index] > 0 ? (
                        <React.Fragment key={index}>
                          <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-2">
                              CGST ({rate * 100 / 2}%)
                            </label>
                             <div className="w-full h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                            <span>Rs. {cgstTotals[index].toFixed(2)}</span>
                            </div>
                          </div>

                          <div >
                            <label className="block text-sm font-semibold text-gray-800 mb-2">
                              SGST ({rate * 100 / 2}%)
                              </label>
                              <div className="w-full h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                            <span>Rs. {sgstTotals[index].toFixed(2)}</span>
                          </div>
                          </div>
                        </React.Fragment>
                      ) : null
                    )}
                {hasIGST &&
                    taxRates.map((rate, index) =>
                      igstTotals[index] > 0 ? (
                        <div key={index}>
                           <label className="block text-sm font-semibold text-gray-800 mb-2">
                            IGST ({rate * 100}%)
                           </label>
                        <div className="w-full h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                          <span>Rs. {igstTotals[index].toFixed(2)}</span>
                        </div>
                        </div>
                      ) : null
                    )}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Total PO Cost (INR)
                  </label>
                   <div className="w-full h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                  {totalPoCost.toFixed(2)}
                </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 p-6 rounded-xl shadow-inner fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Payment Terms
                  </label>
                  <Select
                    value={selectedPaymentTerm}
                    onChange={(value) => setSelectedPaymentTerm(value)}
                    placeholder="Select Payment Term"
                    className="w-full h-12 rounded-lg"
                    dropdownRender={(menu) => (
                      <>
                        <div
                          style={{
                            padding: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            backgroundColor: "#f5f5f5",
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setIsAddPaymentTermModalVisible(true)}
                        >
                          <PlusOutlined style={{ marginRight: "8px" }} />
                          Add New Payment Term
                        </div>
                        {menu}
                      </>
                    )}
                  >
                    {paymentTerms.map((term) => (
                      <Option key={term.id} value={term.description}>
                        {term.description}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Other Terms and Conditions
                  </label>
                  <Select
                    value={selectedOtherTerm}
                    onChange={(value) => setSelectedOtherTerm(value)}
                    placeholder="Select Other Terms"
                    className="w-full h-12 rounded-lg"
                    dropdownRender={(menu) => (
                      <>
                        <div
                          style={{
                            padding: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            backgroundColor: "#f5f5f5",
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setIsAddOtherTermModalVisible(true)}
                        >
                          <PlusOutlined style={{ marginRight: "8px" }} />
                          Add New Term
                        </div>
                        {menu}
                      </>
                    )}
                  >
                    {otherTerms.map((term) => (
                      <Option key={term.id} value={term.description}>
                        {term.description}
                      </Option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8 space-x-4">
              <Button
                onClick={handleRaisePO}
                className="bg-green-600 text-white hover:bg-green-700 h-12 px-8 rounded-lg shadow-md hover:shadow-lg transition-all pulse text-base font-semibold"
                disabled={loading || vendorLoading}
                loading={loading}
              >
                Raise PO
              </Button>
              <Button
                onClick={handleEmail}
                className="bg-blue-600 text-white hover:bg-blue-700 h-12 px-8 rounded-lg shadow-md hover:shadow-lg transition-all pulse text-base font-semibold flex items-center"
                title="Email MRF Review via Gmail"
                disabled={loading || vendorLoading}
              >
                <EnvelopeIcon className="h-5 w-5 mr-2" />
                Email
              </Button>
           
      </div>
      {/* Hidden printable component */}
      <div className="hidden">
        
            </div>
          </div>
        </div>

        <Modal
          title="Confirm Raise PO"
          open={isModalVisible}
          onOk={confirmRaisePO}
          onCancel={() => setIsModalVisible(false)}
          okText="Yes"
          cancelText="No"
          okButtonProps={{
            className: "bg-blue-600 hover:bg-blue-700 text-white rounded-lg",
            disabled: loading,
            loading: loading,
          }}
          cancelButtonProps={{
            className: "bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg",
          }}
        >
          <p>Are you sure you want to raise PO?</p>
        </Modal>
        
<Modal
  title="Previous Purchase Details"
  visible={modalVisible}
  onCancel={() => setModalVisible(false)}
  footer={[
    <Button key="close" onClick={() => setModalVisible(false)}>
      Close
    </Button>,
  ]}
  width={800} // Increased width to accommodate data efficiently
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
      <p className="text-red-600 mt-2">* Amount is the Basic Total, and the GST was paid extra.</p> {/* Moved to bottom */}
    </div>
  )}
</Modal>

        <Modal
          title="Purchase Order Raised Successfully"
          open={isSuccessModalVisible}
          onOk={() => {
            setIsSuccessModalVisible(false);
             navigate('/mrf/purchase-head-search');
          }}
          onCancel={() => {
            setIsSuccessModalVisible(false);
            // navigate('/mrf/purchase-head-search');
          }}
          okText="OK"
          cancelText="Back"
          okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
          cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
        >
          <p>Your purchase order has been successfully raised.</p>
          <p>
            <strong>Purchase Order Number:</strong> {poNumber}
          </p>
          <p>Please note this number for your records.</p>
        </Modal>

        <Modal
  title="PDF Preview"
  open={isPreviewModalVisible}
  onCancel={() => {
    setIsPreviewModalVisible(false);
    setPdfUrl(null);
    setNumPages(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }}
  footer={[
    <Button
      key="download"
      onClick={handleDownload}
      className="bg-green-600 text-white hover:bg-green-700 rounded-lg"
    >
      Download PDF
    </Button>,
    <Button
      key="close"
      onClick={() => {
        setIsPreviewModalVisible(false);
        setPdfUrl(null);
        setNumPages(null);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      }}
      className="bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
    >
      Close
    </Button>,
  ]}
  width={900} // Keep the width as is
  styles={{
    body: {
      overflowY: "auto", // Allow vertical scrolling
      overflowX: "hidden", // Prevent horizontal scrolling
      maxHeight: "80vh", // Limit height to 80% of viewport height for better UX
      padding: "20px",
    },
  }}
>
  {pdfUrl && (
    <Document
      file={pdfUrl}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      onLoadError={(error) => {
        console.error("Error loading PDF:", error);
        message.error("Failed to load PDF preview.", 5);
      }}
    >
      {numPages &&
        Array.from({ length: numPages }, (_, index) => (
          <div
            key={`page_${index + 1}`}
            style={{
              marginBottom: "20px",
              display: "flex",
              justifyContent: "center", // Center the page horizontally
            }}
          >
            <Page pageNumber={index + 1} scale={1.4} />
          </div>
        ))}
    </Document>
  )}
</Modal>
        <Modal
          title="Add New Payment Term"
          open={isAddPaymentTermModalVisible}
          onOk={() => paymentTermForm.submit()}
          onCancel={() => {
            setIsAddPaymentTermModalVisible(false);
            paymentTermForm.resetFields();
          }}
          okText="Add"
          cancelText="Cancel"
          okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
          cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
        >
          <Form form={paymentTermForm} onFinish={handleAddPaymentTerm} layout="vertical">
            <Form.Item
              name="description"
              label="Payment Term"
              rules={[{ required: true, message: 'Please enter a payment term' }]}
            >
              <Input placeholder="Enter payment term" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Add New Other Term"
          open={isAddOtherTermModalVisible}
          onOk={() => otherTermForm.submit()}
          onCancel={() => {
            setIsAddOtherTermModalVisible(false);
            otherTermForm.resetFields();
          }}
          okText="Add"
          cancelText="Cancel"
          okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
          cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
        >
          <Form form={otherTermForm} onFinish={handleAddOtherTerm} layout="vertical">
            <Form.Item
              name="description"
              label="Other Term"
              rules={[{ required: true, message: 'Please enter a term' }]}
            >
              <Input placeholder="Enter other term" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
 <Modal
        title="Customize Columns"
        visible={columnVisibilityVisible}
        onCancel={() => setColumnVisibilityVisible(false)}
        footer={[
          <Button key="save" type="primary" onClick={() => setColumnVisibilityVisible(false)}>
            Save
          </Button>,
          <Button key="cancel" onClick={() => setColumnVisibilityVisible(false)}>
            Cancel
          </Button>,
        ]}
        width={400}
      >
        {Object.keys(columnVisibility).map((key) => (
          <div key={key} className="flex items-center mb-2">
            <Checkbox
              checked={columnVisibility[key]}
              onChange={(e) => setColumnVisibility({ ...columnVisibility, [key]: e.target.checked })}
            >
              {columns.find(col => col.key === key)?.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Checkbox>
          </div>
        ))}
      </Modal>


      <style jsx global>{`
        html,
        body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: auto;
        }
        .elegant-bg {
          background: linear-gradient(
            135deg,
            #e0f2fe 0%,
            #bae6fd 50%,
            #e0f2fe 100%
          );
          animation: subtleMove 20s ease-in-out infinite;
          position: relative;
          overflow: hidden;
        }
        @keyframes subtleMove {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .elegant-bg::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.2) 0%,
            rgba(255, 255, 255, 0) 70%
          );
          animation: gentleFade 5s ease-in-out infinite;
        }
        @keyframes gentleFade {
          0% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        .slide-in {
          animation: slideIn 0.5s ease-in-out;
        }
        .row-enter {
          animation: rowEnter 0.3s ease-in-out;
        }
        .pulse {
          animation: pulse 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes rowEnter {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
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
        .min-h-screen {
          height: 100vh;
          overflow-y: auto !important;
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
          padding-top: 60px;
        }
        .min-h-screen::-webkit-scrollbar {
          width: 10px;
        }
        .min-h-screen::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 12px;
        }
        .min-h-screen::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 12px;
          border: 2px solid #f1f1f1;
        }
        .min-h-screen::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .ant-table-wrapper {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
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
        .ant-table-wrapper .ant-table {
          border-radius: 12px;
          overflow: hidden;
        }
        .ant-table-thead > tr > th {
          background: #f8fafc;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
          text-align: center;
          padding: 14px 16px;
          font-size: 15px;
          transition: background 0.3s ease;
        }
        .ant-table-thead > tr > th:hover {
          background: #e6f0ff;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
          text-align: center;
          padding: 14px 16px;
          font-size: 14px;
          transition: background 0.3s ease;
        }
        .ant-table-tbody > tr.ant-table-row:hover > td {
          background: #e6f0ff;
        }
        .ant-select-single .ant-select-selector {
          border-radius: 8px !important;
          border: 1px solid #d1d5db !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
        }
        .ant-input-number {
          border-radius: 8px !important;
          border: 1px solid #d1d5db !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
        }
        .border-red-500 {
          border-color: #ef4444 !important;
        }
        .focus\:border-red-500:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
        }
        .bg-white {
          margin: 0 auto;
          width: 100%;
        }
        .bg-white:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        @keyframes slide-in {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.5s ease-out forwards;
        }
        .ant-message {
          z-index: 10000 !important;
          position: fixed !important;
          top: 80px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          width: auto !important;
          max-width: 600px !important;
          font-size: 16px !important;
          line-height: 1.5 !important;
          pointer-events: auto !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        .ant-message-notice {
          padding: 8px !important;
        }
        .ant-message-notice-content {
          background: #ffffff !important;
          border: 1px solid #d9d9d9 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          border-radius: 6px !important;
          padding: 12px 24px !important;
          color: #333333 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "helvetica", helvetica, sans-serif !important;
        }
        .ant-message-error .ant-message-notice-content {
          background: #fff1f0 !important;
          border-color: #ffa39e !important;
          color: #cf1322 !important;
        }
        .ant-message .anticon {
          margin-right: 8px !important;
          vertical-align: middle !important;
        }
        .bg-red-50 {
          background-color: #fef2f2 !important;
        }
        .border-red-200 {
          border-color: #fecaca !important;
        }
        .text-red-700 {
          color: #b91c1c !important;
        }
      `}</style>
    </div>
  );
};

export default MrfReviewPage;