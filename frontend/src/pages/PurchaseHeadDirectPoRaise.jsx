import React, { useState, useEffect } from "react";
// Add this import at the top of the file with other imports
import { useNavigate } from "react-router-dom";
import { Table, Input, Modal, Button, Spin, message, Card, Typography, Row, Col, DatePicker, Tabs, Checkbox } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { raiseDirectPurchaseOrder, fetchCeoApprovedMrfRequestsForPo } from "../utils/api";
import moment from "moment";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import logo from "../assets/accelor-nobg.png";


pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min',
  import.meta.url
).href;

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const PurchaseHeadDirectPoRaise = ({ role }) => {
  const [groupedComponents, setGroupedComponents] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [pastRaisedPOs, setPastRaisedPOs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(null);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [otherTerms, setOtherTerms] = useState("");
  const navigate = useNavigate();
  const [errors, setErrors] = useState({
    expectedDeliveryDate: false,
    paymentTerms: false,
    otherTerms: false,
  });
  const [columnVisibility, setColumnVisibility] = useState({});
  const [componentColumnVisibility, setComponentColumnVisibility] = useState({});
  const [columnVisibilityVisible, setColumnVisibilityVisible] = useState(false);
  const [emailComponents, setEmailComponents] = useState([]);
  const [componentColumnVisibilityVisible, setComponentColumnVisibilityVisible] = useState(false);
   const [isEmailConfirmModalVisible, setIsEmailConfirmModalVisible] = useState(false);
   
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [poNumber, setPoNumber] = useState("");
  const [currentTime, setCurrentTime] = useState(moment());

  const userRole = role || localStorage.getItem("role") || "employee";
  const isPurchaseHead = userRole === "purchase_head";

 
  useEffect(() => {
    if (!isPurchaseHead) return;
    fetchData();
    fetchPastRaisedData();
  }, [isPurchaseHead]);

  

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await fetchCeoApprovedMrfRequestsForPo();
      const groupedData = data.reduce((acc, item) => {
        const sequence = item.direct_sequence || "N/A";
        if (!acc[sequence]) {
          let remark = "N/A";
          if (item.note) {
            try {
              remark = typeof item.note === "string" && item.note.trim().startsWith("[")
                ? JSON.parse(item.note).map(n => n.content || "").join("\n") || "N/A"
                : item.note.trim() || "N/A";
            } catch (e) {
              console.error(`Error parsing note for direct_sequence ${sequence}:`, e.message);
              remark = item.note || "N/A";
            }
          }

          const formattedCreatedAt = item.created_at !== "N/A"
            ? moment(item.created_at).utcOffset("+05:30").format("DD-MM-YYYY HH:mm:ss")
            : "N/A";

          const components = (item.components || []).map(comp => {
            const formattedSubmittedAt = comp.submitted_at !== "N/A"
              ? moment(comp.submitted_at).utcOffset("+05:30").format("DD-MM-YYYY HH:mm:ss")
              : "N/A";

            return {
              mpn: comp.mpn || "N/A",
              item_description: comp.item_description || "N/A",
              make: comp.make || "N/A",
              part_no: comp.part_no || "N/A",
              uom: comp.uom || "N/A",
              requested_quantity: parseInt(comp.requested_quantity, 10) || 0,
              gst_type: comp.gst_type || "N/A",
              rate_per_unit: parseFloat(comp.rate_per_unit) || 0,
              amount_inr: parseFloat(comp.amount_inr) || 0,
              gst_amount: parseFloat(comp.gst_amount) || 0,
              status: comp.status || "CEO Approval Done",
              submitted_at: formattedSubmittedAt,
              raw_submitted_at: comp.submitted_at,
              component_id: comp.component_id, // Ensure component_id is included
            };
          });

          const totalPoCost = components.reduce((sum, comp) => 
            sum + (comp.amount_inr || 0) + (comp.gst_amount || 0), 0);

          acc[sequence] = {
            direct_sequence: sequence,
            vendor: item.vendor || "N/A",
            created_at: formattedCreatedAt,
            raw_created_at: item.created_at,
            remark,
            project_name: item.project_name || "N/A",
            mrf_no: item.mrf_no || "N/A",
            total_po_cost: totalPoCost,
            components,
            key: sequence,
          };
        }
        return acc;
      }, {});
      const groupedArray = Object.values(groupedData);
      setGroupedComponents(groupedArray);
      setFilteredComponents(groupedArray);

      const initialColumnVisibility = columns.reduce((acc, col) => {
        acc[col.key] = true;
        return acc;
      }, {});
      setColumnVisibility(initialColumnVisibility);

      const initialComponentColumnVisibility = componentColumns.reduce((acc, col) => {
        acc[col.key] = true;
        return acc;
      }, {});
      setComponentColumnVisibility(initialComponentColumnVisibility);
    } catch (error) {
      message.error(`Failed to fetch components: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchPastRaisedData = async () => {
    setLoading(true);
    try {
      const data = await fetchCeoApprovedMrfRequestsForPo({ status: ["PO Raised"] });
      const groupedData = data.reduce((acc, item) => {
        const sequence = item.direct_sequence || "N/A";
        if (!acc[sequence]) {
          const components = (item.components || []).map(comp => ({
            mpn: comp.mpn || "N/A",
            item_description: comp.item_description || "N/A",
            make: comp.make || "N/A",
            part_no: comp.part_no || "N/A",
            uom: comp.uom || "N/A",
            requested_quantity: parseInt(comp.requested_quantity, 10) || 0,
            gst_type: comp.gst_type || "N/A",
            rate_per_unit: parseFloat(comp.rate_per_unit) || 0,
            amount_inr: parseFloat(comp.amount_inr) || 0,
            gst_amount: parseFloat(comp.gst_amount) || 0,
            status: comp.status || "PO Raised",
            component_id: comp.component_id, // Ensure component_id is included
            po_number: comp.po_number || "N/A",
            created_at: comp.created_at || "N/A",
            vendor_name: item.vendor?.name || item.vendor || "N/A",
          }));

          const totalPoCost = components.reduce((sum, comp) => 
            sum + (comp.amount_inr || 0) + (comp.gst_amount || 0), 0);

          acc[sequence] = {
            direct_sequence: sequence,
            vendor: item.vendor || "N/A",
            created_at: item.created_at !== "N/A"
              ? moment(item.created_at).utcOffset("+05:30").format("DD-MM-YYYY HH:mm:ss")
              : "N/A",
            remark: item.note?.length ? item.note.map(n => n.content).join("\n") : "N/A",
            project_name: item.project_name || "N/A",
            mrf_no: item.mrf_no || "N/A",
            total_po_cost: totalPoCost,
            components,
            key: sequence,
          };
        }
        return acc;
      }, {});
      const groupedArray = Object.values(groupedData);
      setPastRaisedPOs(groupedArray);
    } catch (error) {
      message.error(`Failed to fetch past raised POs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e, tab) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    const source = tab === "active" ? groupedComponents : pastRaisedPOs;
    const filtered = source.filter(
      group =>
        group.direct_sequence.toLowerCase().includes(term) ||
        group.project_name.toLowerCase().includes(term) ||
        group.vendor.toLowerCase().includes(term) ||
        group.remark.toLowerCase().includes(term) ||
        group.mrf_no.toLowerCase().includes(term)
    );
    if (tab === "active") {
      setFilteredComponents(filtered);
    } else {
      setPastRaisedPOs(filtered);
    }
  };

  const showDetails = group => {
    setSelectedGroup(group);
    setIsDetailsModalOpen(true);
  };

 const handleRaisePO = () => {
  if (!selectedGroup) {
    message.error("No group selected to raise PO.");
    return;
  }
  // Pass all data to the /mrf/review page via state
  navigate("/direct-po-review-page", {
    state: {
      poData: {
        direct_sequence: selectedGroup.direct_sequence,
        vendor: selectedGroup.vendor,
        created_at: selectedGroup.created_at,
        remark: selectedGroup.remark,
        project_name: selectedGroup.project_name,
        mrf_no: selectedGroup.mrf_no,
        total_po_cost: selectedGroup.total_po_cost,
        components: selectedGroup.components,
        expectedDeliveryDate: expectedDeliveryDate,
        paymentTerms: paymentTerms,
        otherTerms: otherTerms,
      },
    },
  });
};

  const handleModalDeliveryDateChange = (date) => {
    setExpectedDeliveryDate(date);
    if (!date) {
      setErrors(prev => ({ ...prev, expectedDeliveryDate: true }));
      message.error("Expected delivery date is required.", 5);
    } else if (date.isBefore(moment(), "day")) {
      setErrors(prev => ({ ...prev, expectedDeliveryDate: true }));
      message.error("Expected delivery date cannot be in the past.", 5);
    } else {
      setErrors(prev => ({ ...prev, expectedDeliveryDate: false }));
    }
  };

  const handlePaymentTermsChange = (e) => {
    const value = e.target.value;
    setPaymentTerms(value);
    if (!value || !value.trim()) {
      setErrors(prev => ({ ...prev, paymentTerms: true }));
      message.error("Payment Terms are required.", 5);
    } else {
      setErrors(prev => ({ ...prev, paymentTerms: false }));
    }
  };

  const handleOtherTermsChange = (e) => {
    const value = e.target.value;
    setOtherTerms(value);
    if (!value || !value.trim()) {
      setErrors(prev => ({ ...prev, otherTerms: true }));
      message.error("Other Terms and Conditions are required.", 5);
    } else {
      setErrors(prev => ({ ...prev, otherTerms: false }));
    }
  };

  const validateFields = () => {
    const newErrors = {
      expectedDeliveryDate: false,
      paymentTerms: false,
      otherTerms: false,
    };
    let isValid = true;

    if (!expectedDeliveryDate) {
      newErrors.expectedDeliveryDate = true;
      message.error("Expected delivery date is required.", 5);
      isValid = false;
    } else if (expectedDeliveryDate.isBefore(moment(), "day")) {
      newErrors.expectedDeliveryDate = true;
      message.error("Expected delivery date cannot be in the past.", 5);
      isValid = false;
    }

    if (!paymentTerms || !paymentTerms.trim()) {
      newErrors.paymentTerms = true;
      message.error("Payment Terms are required.", 5);
      isValid = false;
    }

    if (!otherTerms || !otherTerms.trim()) {
      newErrors.otherTerms = true;
      message.error("Other Terms and Conditions are required.", 5);
      isValid = false;
    }

    const totalPoCost = selectedGroup?.components.reduce((sum, comp) => 
      sum + (comp.amount_inr || 0) + (comp.gst_amount || 0), 0) || 0;
    if (isNaN(totalPoCost) || totalPoCost <= 0) {
      message.error("Total PO cost must be a positive number.", 5);
      isValid = false;
    }

    if (!selectedGroup?.components?.length) {
      message.error("No components available to raise the PO.", 5);
      isValid = false;
    } else {
      for (const comp of selectedGroup.components) {
        const qty = parseInt(comp.requested_quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          message.error(`Invalid requested quantity for MPN ${comp.mpn}: must be a positive number.`, 5);
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    if (!isValid) {
      message.warning("Please fix the errors before submitting.", 5);
    }
    return isValid;
  };

  const confirmRaisePO = async () => {
    const isValid = validateFields();
    if (!isValid) return;

    if (loading) {
      message.warning("Please wait, a request is already in progress.");
      return;
    }

    setLoading(true);
    try {
      const vendorDetails = typeof selectedGroup.vendor === 'string'
        ? { name: selectedGroup.vendor }
        : selectedGroup.vendor;

      const purchaseOrderData = {
        items: selectedGroup.components.map(comp => ({
          requested_quantity: comp.requested_quantity,
          uom: comp.uom,
          ratePerUnit: comp.rate_per_unit,
          amount: comp.amount_inr,
          gstAmount: comp.gst_amount,
          mpn: comp.mpn,
          item_description: comp.item_description,
          make: comp.make,
          part_no: comp.part_no || null,
        })),
        vendor: vendorDetails,
        quotation_no: selectedGroup.quotation_no || null,
        totalpo_cost: selectedGroup.total_po_cost,
        expected_delivery_date: expectedDeliveryDate.format('YYYY-MM-DD'),
        paymentTerms,
        otherTerms,
        direct_sequence: selectedGroup.direct_sequence,
        mrf_no: selectedGroup.mrf_no,
        po_number: poNumber,
      };

      await raiseDirectPurchaseOrder(purchaseOrderData);
      message.success("Purchase Order raised successfully!");
      setIsConfirmModalVisible(false);
      setIsDetailsModalOpen(true);
      fetchData();
      fetchPastRaisedData();
    } catch (error) {
      message.error(`Failed to raise PO: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchComponentPreviousPurchases = async (component_id) => {
    setLoading(true);
    try {
      const filters = { componentId: component_id, limit: 5, sort: "created_at DESC" };
      const data = await fetchCeoApprovedMrfRequestsForPo(filters);
      const enhancedData = data.map(item => ({
        po_number: item.po_number || "N/A",
        created_at: item.created_at !== "N/A"
          ? moment(item.created_at).utcOffset("+05:30").format("DD-MM-YYYY HH:mm:ss")
          : "N/A",
        vendor_name: item.vendor?.name || item.vendor || "N/A",
        updated_requested_quantity: item.requested_quantity || "N/A",
        rate_per_unit: parseFloat(item.rate_per_unit) || 0,
        amount: parseFloat(item.amount_inr) || 0,
        key: item.po_number || Math.random().toString(),
      }));
      return enhancedData.slice(0, 5); // Ensure only top 5
    } catch (error) {
      message.error("Failed to fetch previous purchases.");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const vendorDetails = typeof selectedGroup.vendor === 'string'
        ? { name: selectedGroup.vendor }
        : selectedGroup.vendor || {};
      let currentPage = 1;
      let cocPageNumber = null;
      const footerHeight = 20;
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentThreshold = pageHeight - footerHeight - margin;

      const drawBox = (x, y, width, height) => {
        doc.setLineWidth(0.3);
        doc.rect(x, y, width, height);
      };

      const drawDottedLine = (x1, y1, x2, y2) => {
        doc.setLineWidth(0.3);
        doc.setLineDash([0.3, 0.7]);
        doc.line(x1, y1, x2, y2);
        doc.setLineDash([]);
      };

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

        const numLines = Math.max(billingLines.length, rightDetails.length);
        const row2Height = numLines * 5 + 6;

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

        doc.rect(startX + halfWidth, y, halfWidth, row2Height);
        drawLinesWithStyledLabel(rightDetails, startX + halfWidth + 2, y + 6);

        y += row2Height;

        const label = 'Name and Address of Vendor:';
        const vendorName = vendorDetails.name || 'N/A';
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

        const leftLines = [
          `Address: ${vendorDetails.address || 'N/A'}`,
          `GSTIN: ${vendorDetails.gstin || 'N/A'}`,
          `PAN: ${vendorDetails.pan || 'N/A'}`
        ].flatMap(line => doc.splitTextToSize(line, halfWidth - 6));
        const rightLines = [
          `Quotation Ref No: ${selectedGroup.quotation_no || 'N/A'}`,
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
        if (pageNum === cocPageNumber) return;
        const footerText =
          "+91 7087229840/41 scm@accelorindia.com https://www.accelorindia.com 03AWNPS2671N1ZX";
        const pageWidth = doc.internal.pageSize.getWidth();
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
        const basicTotal = selectedGroup.components.reduce((sum, comp) => sum + (comp.amount_inr || 0), 0);
        drawTwoColumnRow('Basic Total:', `Rs. ${basicTotal.toFixed(2)}`, currentY);
        currentY += rowHeight;

        const gstTotal = selectedGroup.components.reduce((sum, comp) => sum + (comp.gst_amount || 0), 0);
        if (gstTotal > 0) {
          drawTwoColumnRow('GST Total:', `Rs. ${gstTotal.toFixed(2)}`, currentY);
          currentY += rowHeight;
        }

        const totalRowHeight = 15;
        if (currentY + totalRowHeight + 20 > contentThreshold) {
          doc.addPage();
          currentPage++;
          currentY = 15;
        }
        drawBox(tableStartX, currentY, fullWidth, totalRowHeight);
        doc.setFont('helvetica', 'bold');
        doc.text('Total PO Value in INR:', tableStartX + labelColWidth / 2, currentY + 7, { align: 'center' });
        const totalText = `Rs. ${selectedGroup.total_po_cost.toFixed(2)}`;
        doc.setFont('helvetica', 'bold');
        doc.text(totalText, tableStartX + fullWidth - 2, currentY + 7, { align: 'right' });
        const inWords = `${numberToWords(selectedGroup.total_po_cost)} Rupees`;
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
          `Payment Terms: ${paymentTerms || 'N/A'}`,
          `Other Terms and Conditions: ${otherTerms || 'N/A'}`
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

        doc.setFont('helvetica', 'normal');
        doc.text('Signature not available', 16, cursorY);
        cursorY += 10;

        doc.setFont('helvetica', 'bold');
        doc.text('N/A', 16, cursorY);
        cursorY += 6;
        doc.text('N/A', 16, cursorY);
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
        const vendorDetailsText = '';
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
        const customerDetails = '';
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

      let y = addHeader();

      const tableData = selectedGroup.components.map((item, i) => [
        `${i + 1}`,
        item.item_description || '-',
        item.mpn || '-',
        item.part_no || '-',
        item.requested_quantity?.toString() || '0',
        item.uom || '-',
        item.rate_per_unit?.toFixed(2) || '0.00',
        item.amount_inr?.toFixed(2) || '0.00'
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
          cellPadding: 3,
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

 const handleEmail = (components) => {
    setEmailComponents(components);
    setIsEmailConfirmModalVisible(true);
  };

  const confirmSendEmail = () => {
    const subject = 'Purchase Order Details';
    const body = `Please find the purchase order details.\n\nVendor: ${emailComponents[0]?.vendor || 'N/A'}\nExpected Delivery Date: ${expectedDeliveryDate ? expectedDeliveryDate.format('DD/MM/YYYY') : 'N/A'}\nPayment Terms: ${selectedPaymentTerm || 'N/A'}\nOther Terms and Conditions: ${selectedOtherTerm || 'N/A'}\nTotal PO Cost: INR ${emailComponents.reduce((sum, item) => sum + (item.amount || 0) + (item.taxAmount || 0), 0).toFixed(2)}\nComponents: ${emailComponents.length}\n\nDownload the attached PDF for detailed information.`;
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailLink, '_blank');
    setIsEmailConfirmModalVisible(false);
    setEmailComponents([]);
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
          const handleAfterPrint = () => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
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
        doc.save(`${selectedGroup.mrf_no}_${poNumber || "Purchase_Order"}.pdf`);
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

  const columns = [
    {
      title: "Sequence No",
      dataIndex: "direct_sequence",
      key: "direct_sequence",
      sorter: (a, b) => a.direct_sequence.localeCompare(b.direct_sequence),
    },
    {
      title: "MRF No",
      dataIndex: "mrf_no",
      key: "mrf_no",
      sorter: (a, b) => a.mrf_no.localeCompare(b.mrf_no),
    },
    {
      title: "Project Name",
      dataIndex: "project_name",
      key: "project_name",
      sorter: (a, b) => a.project_name.localeCompare(b.project_name),
    },
    {
      title: "Vendor",
      dataIndex: "vendor",
      key: "vendor",
      render: vendor => (typeof vendor === 'string' ? vendor : vendor.name || "N/A"),
      sorter: (a, b) => {
        const vendorA = typeof a.vendor === 'string' ? a.vendor : a.vendor.name || "";
        const vendorB = typeof b.vendor === 'string' ? b.vendor : b.vendor.name || "";
        return vendorA.localeCompare(vendorB);
      },
    },
    {
      title: "Created At",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (a, b) => moment(a.raw_created_at).diff(moment(b.raw_created_at)),
    },
    {
      title: "Total PO Cost",
      dataIndex: "total_po_cost",
      key: "total_po_cost",
      render: (_, record) => {
        const totalPoCost = record.components.reduce((sum, comp) => 
          sum + (comp.amount_inr || 0) + (comp.gst_amount || 0), 0);
        return `₹${totalPoCost.toFixed(2)}`;
      },
      sorter: (a, b) => {
        const totalPoCostA = a.components.reduce((sum, comp) => 
          sum + (comp.amount_inr || 0) + (comp.gst_amount || 0), 0);
        const totalPoCostB = b.components.reduce((sum, comp) => 
          sum + (comp.amount_inr || 0) + (comp.gst_amount || 0), 0);
        return totalPoCostA - totalPoCostB;
      },
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="link" onClick={() => showDetails(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const componentColumns = [
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    { title: "Description", dataIndex: "item_description", key: "item_description" },
    { title: "Make", dataIndex: "make", key: "make" },
    { title: "Part No", dataIndex: "part_no", key: "part_no" },
    { title: "UOM", dataIndex: "uom", key: "uom" },
    { title: "Requested Quantity", dataIndex: "requested_quantity", key: "requested_quantity" },
    { title: "GST Type", dataIndex: "gst_type", key: "gst_type" },
    { title: "Rate per Unit", dataIndex: "rate_per_unit", key: "rate_per_unit", render: rate => `₹${rate.toFixed(2)}` },
    { title: "Amount (INR)", dataIndex: "amount_inr", key: "amount_inr", render: amount => `₹${amount.toFixed(2)}` },
    { title: "GST Amount", dataIndex: "gst_amount", key: "gst_amount", render: amount => `₹${amount.toFixed(2)}` },
    { title: "Status", dataIndex: "status", key: "status" },
    { title: "Submitted At", dataIndex: "submitted_at", key: "submitted_at" },
    // {
    //   title: "Previous Purchases",
    //   key: "previousPurchases",
    //   render: (_, record) => (
    //     <Button
    //       type="link"
    //       onClick={async () => {
    //         const data = await fetchComponentPreviousPurchases(record.component_id);
    //         Modal.info({
    //           title: `Previous Purchase Details for MPN ${record.mpn}`,
    //           content: (
    //             <Table
    //               columns={[
    //                 { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
    //                 { title: 'Purchase Date', dataIndex: 'created_at', key: 'created_at' },
    //                 { title: 'Vendor Name', dataIndex: 'vendor_name', key: 'vendor_name' },
    //                 { title: 'Ordered Quantity', dataIndex: 'updated_requested_quantity', key: 'updated_requested_quantity' },
    //                 { title: 'Rate/Unit', dataIndex: 'rate_per_unit', key: 'rate_per_unit', render: text => `₹${parseFloat(text).toFixed(2)}` },
    //                 { title: 'Amount', dataIndex: 'amount', key: 'amount', render: text => `₹${parseFloat(text).toFixed(2)}` },
    //               ]}
    //               dataSource={data}
    //               pagination={false}
    //               bordered
    //               size="small"
    //             />
    //           ),
    //           width: 800,
    //           okText: 'Close',
    //           onOk: () => {},
    //         });
    //       }}
    //     >
    //       View
    //     </Button>
    //   ),
    // },
  ];

    // Handle review button click
  const handleNavigate = () => {
    navigate("/direct-po-requests-history");
  };

  const filteredColumns = columns.filter(col => columnVisibility[col.key]);
  const filteredComponentColumns = componentColumns.filter(col => componentColumnVisibility[col.key]);

  return (
    <div style={{ padding: "80px" }}>
     <div className="flex justify-between items-center mb-4">
  <Title level={2}>Direct PO Raise</Title>
  
  <div className="flex gap-4">
    <button
      className="bg-blue-500 text-white px-2 py-1 rounded-full whitespace-nowrap hover:bg-blue-700 transition duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
      onClick={handleNavigate}
    >
      View Past Direct Raised PO's
    </button>

    <Button onClick={() => setColumnVisibilityVisible(true)}
      className="!bg-purple-500 !text-white !px-2 !py-2 !rounded-full !whitespace-nowrap hover:!bg-purple-700 transition duration-300 transform hover:scale-105 shadow-md hover:shadow-lg">
      Customize Columns
    </Button>
  </div>
</div>


      {isPurchaseHead ? (
        <>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="Active Requests" key="active">
              <Row justify="space-between" style={{ marginBottom: 16 }}>
                <Input
                  placeholder="Search by Sequence, Project, Vendor, Remark, or MRF No"
                  prefix={<SearchOutlined />}
                  value={searchTerm}
                  onChange={e => handleSearch(e, "active")}
                  style={{ width: 300 }}
                />
             
              </Row>
              <Table
                columns={filteredColumns}
                dataSource={filteredComponents}
                loading={loading}
                rowKey="direct_sequence"
                pagination={{ pageSize: 10 }}
              />
            </TabPane>
            {/* <TabPane tab="Past Raised POs" key="past">
              <Row justify="space-between" style={{ marginBottom: 16 }}>
                <Input
                  placeholder="Search by Sequence, Project, Vendor, Remark, or MRF No"
                  prefix={<SearchOutlined />}
                  value={searchTerm}
                  onChange={e => handleSearch(e, "past")}
                  style={{ width: 300 }}
                />
                <Button onClick={() => setColumnVisibilityVisible(true)}>
                  Customize Columns
                </Button>
              </Row>
              <Table
                columns={filteredColumns}
                dataSource={pastRaisedPOs}
                loading={loading}
                rowKey="direct_sequence"
                pagination={{ pageSize: 10 }}
              />
            </TabPane> */}
          </Tabs>
          <Modal
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Component Details</span>
                <Button 
                  onClick={() => setComponentColumnVisibilityVisible(true)} 
                  className="flex items-center gap-2 !bg-yellow-500 !text-white !hover:bg-blue-600 mr-10"
                >
                  Customize Columns
                </Button>
              </div>
            }
            open={isDetailsModalOpen}
            onCancel={() => setIsDetailsModalOpen(false)}
            footer={[
              <Button key="preview" onClick={handlePreview} className="bg-blue-600 text-white hover:bg-blue-700">
                Preview PDF
              </Button>,
              <Button key="download" onClick={handleDownload} className="bg-green-600 text-white hover:bg-green-700">
                Download PDF
              </Button>,
              <Button key="print" onClick={handlePrint} className="bg-gray-600 text-white hover:bg-gray-700">
                Print PDF
              </Button>,
              <Button onClick={() => handleEmail([record])} className="bg-gray-600 text-white hover:bg-gray-700">
                Email
              </Button>,


              <Button key="close" onClick={() => setIsDetailsModalOpen(false)}>
                Close
              </Button>,
              activeTab === "active" && (
                <Button key="raise" type="primary" onClick={handleRaisePO}>
                  Raise PO
                </Button>
              ),
            ]}
            width={1400}
            styles={{ body: { padding: 24, maxHeight: '70vh', overflowY: 'auto' } }}
          >
            {selectedGroup && (
              <Card>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text strong>Sequence No: </Text>
                    <Text>{selectedGroup.direct_sequence}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>MRF No: </Text>
                    <Text>{selectedGroup.mrf_no}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Project Name: </Text>
                    <Text>{selectedGroup.project_name}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Vendor: </Text>
                    <Text>{typeof selectedGroup.vendor === 'string' ? selectedGroup.vendor : selectedGroup.vendor.name || "N/A"}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Created At: </Text>
                    <Text>{selectedGroup.created_at}</Text>
                  </Col>
                  <Col span={24}>
                    <Text strong>Total PO Cost: </Text>
                    <Text>₹{selectedGroup.total_po_cost.toFixed(2)}</Text>
                  </Col>
                </Row>
                <Table
                  columns={filteredComponentColumns}
                  dataSource={selectedGroup.components}
                  rowKey="mpn"
                  pagination={false}
                  style={{ marginTop: 16 }}
                />
              </Card>
            )}
          </Modal>

          <Modal
            title="Confirm Purchase Order"
            open={isConfirmModalVisible}
            onOk={confirmRaisePO}
            onCancel={() => setIsConfirmModalVisible(false)}
            okText="Raise PO"
            confirmLoading={loading}
            footer={[
              // <Button key="preview" onClick={handlePreview} className="bg-blue-600 text-white hover:bg-blue-700">
              //   Preview PDF
              // </Button>,
              // <Button key="download" onClick={handleDownload} className="bg-green-600 text-white hover:bg-green-700">
              //   Download PDF
              // </Button>,
              // <Button key="print" onClick={handlePrint} className="bg-gray-600 text-white hover:bg-gray-700">
              //   Print PDF
              // </Button>,
              <Button key="cancel" onClick={() => setIsConfirmModalVisible(false)}>
                Cancel
              </Button>,
              <Button key="raise" type="primary" onClick={confirmRaisePO} loading={loading}>
                Raise PO
              </Button>,
            ]}
            styles={{ body: { padding: 24 } }}
          >
            <Spin spinning={loading}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Text strong>Expected Delivery Date: </Text>
                  <DatePicker
                    value={expectedDeliveryDate}
                    onChange={handleModalDeliveryDateChange}
                    format="YYYY-MM-DD"
                    style={{ width: '100%', borderColor: errors.expectedDeliveryDate ? 'red' : '' }}
                    disabled={loading}
                  />
                </Col>
                <Col span={24}>
                  <Text strong>Payment Terms: </Text>
                  <Input.TextArea
                    value={paymentTerms}
                    onChange={handlePaymentTermsChange}
                    rows={3}
                    style={{ borderColor: errors.paymentTerms ? 'red' : '' }}
                    disabled={loading}
                  />
                </Col>
                <Col span={24}>
                  <Text strong>Other Terms and Conditions: </Text>
                  <Input.TextArea
                    value={otherTerms}
                    onChange={handleOtherTermsChange}
                    rows={3}
                    style={{ borderColor: errors.otherTerms ? 'red' : '' }}
                    disabled={loading}
                  />
                </Col>
              </Row>
            </Spin>
          </Modal>

          <Modal
            title="Customize Main Table Columns"
            open={columnVisibilityVisible}
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

          <Modal
            title="Customize Component Table Columns"
            open={componentColumnVisibilityVisible}
            onCancel={() => setComponentColumnVisibilityVisible(false)}
            footer={[
              <Button key="save" type="primary" onClick={() => setComponentColumnVisibilityVisible(false)}>
                Save
              </Button>,
              <Button key="cancel" onClick={() => setComponentColumnVisibilityVisible(false)}>
                Cancel
              </Button>,
            ]}
            width={400}
          >
            {Object.keys(componentColumnVisibility).map((key) => (
              <div key={key} className="flex items-center mb-2">
                <Checkbox
                  checked={componentColumnVisibility[key]}
                  onChange={(e) => setComponentColumnVisibility({ ...componentColumnVisibility, [key]: e.target.checked })}
                >
                  {componentColumns.find(col => col.key === key)?.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Checkbox>
              </div>
            ))}
          </Modal>

          <Modal
                  title="Confirm Send Email"
                  visible={isEmailConfirmModalVisible}
                  onOk={confirmSendEmail}
                  onCancel={() => setIsEmailConfirmModalVisible(false)}
                  okText="Yes"
                  cancelText="No"
                  okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
                  cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
                >
                  <p>Are you sure you want to send the email for this purchase order?</p>
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
                className="bg-green-600 text-white hover:bg-green-700"
              >
                Download PDF
              </Button>,
              <Button
                key="print"
                onClick={handlePrint}
                className="bg-gray-600 text-white hover:bg-gray-700"
              >
                Print PDF
              </Button>,
              <Button
                key="close"
                onClick={() => {
                  setIsPreviewModalVisible(false);
                  setPdfUrl(null);
                  setNumPages(null);
                  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                }}
              >
                Close
              </Button>,
            ]}
            width={900}
            styles={{
              body: {
                overflowY: "auto",
                overflowX: "hidden",
                maxHeight: "80vh",
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
                        justifyContent: "center",
                      }}
                    >
                      <Page pageNumber={index + 1} scale={1.4} />
                    </div>
                  ))}
              </Document>
            )}
          </Modal>
        </>
      ) : (
        <Text>You do not have permission to view this page.</Text>
      )}
    </div>
  );
};

export default PurchaseHeadDirectPoRaise;