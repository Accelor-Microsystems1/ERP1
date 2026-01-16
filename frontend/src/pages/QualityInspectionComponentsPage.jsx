import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchComponentsForMRR, uploadMRRDocuments } from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EyeIcon, ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { Modal, message, Button } from 'antd';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import logo from "../assets/accelor-nobg.png";
import { DateTime } from "luxon";

// Dynamically set the worker source using the local pdfjs-dist worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min',
  import.meta.url
).href;

const QualityInspectionComponentsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initialPoNumber = location.state?.poNumber || localStorage.getItem('selected_po_number') || '';
  const [poNumber, setPoNumber] = useState(initialPoNumber);
  const [components, setComponents] = useState([]);
  const [mrrNo, setMrrNo] = useState('N/A');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [cocReceived, setCocReceived] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cocFiles, setCocFiles] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [attachedDocuments, setAttachedDocuments] = useState([]);
  const [numPages, setNumPages] = useState(null);
  const [hasBackorder, setHasBackorder] = useState(false);
  const [shouldDownloadPDF, setShouldDownloadPDF] = useState(null);

  useEffect(() => {
    message.config({
      top: 80,
      duration: 5,
      maxCount: 3,
      prefixCls: "ant-message",
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');

      if (!token) {
        setError('No authentication token found. Please log in.');
        return;
      }

      if (!['quality_head', 'quality_employee', 'admin'].includes(role)) {
        setError('Unauthorized: Only quality team or admin can access this page.');
        return;
      }

      if (!poNumber) {
        setError('No PO Number provided. Please select a PO from the quality inspection list.');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await fetchComponentsForMRR(poNumber);
        if (!Array.isArray(response)) {
          throw new Error('Invalid response format: Expected an array of components');
        }

        const fetchedComponents = response.map((item, index) => ({
          s_no: index + 1,
          part_no: item.part_no || '-',
          item_description: item.item_description || '-',
          mpn: item.mpn || '-',
          mpn_received: item.mpn_received || '-',
          make: item.make || '-',
          make_received: item.make_received || '-',
          updated_requested_quantity: item.backorder_sequence ? (item.reordered_quantity || '-') : (item.updated_requested_quantity || '-'),
          received_quantity: item.received_quantity || '-',
          passed_quantity: item.passed_quantity || '-',
          date_code: item.date_code || '-',
          lot_code: item.lot_code || '-',
          vendor_name: item.vendor_name || '-',
          po_number: item.po_number || '-',
          created_at: item.created_at || '-',
          mrr_no: item.mrr_no || 'N/A',
          status: 'QC Cleared',
          backorder_sequence: item.backorder_sequence || null,
        }));

        setComponents(fetchedComponents);
        setHasBackorder(fetchedComponents.some(comp => comp.backorder_sequence !== null));
        const fetchedMrrNo = response.find(item => item.mrr_no)?.mrr_no || 'N/A';
        setMrrNo(fetchedMrrNo);
        localStorage.removeItem('selected_po_number');
      } catch (err) {
        console.error('Error fetching components:', err);
        setError(err.message || 'Failed to load components. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [poNumber]);

  const refetchComponents = async (newMrrNo) => {
    try {
      const response = await fetchComponentsForMRR(poNumber);
      if (!Array.isArray(response)) {
        throw new Error('Invalid response format: Expected an array of components');
      }
      const fetchedComponents = response.map((item, index) => ({
        s_no: index + 1,
        part_no: item.part_no || '-',
        item_description: item.item_description || '-',
        mpn: item.mpn || '-',
        mpn_received: item.mpn_received || '-',
        make: item.make || '-',
        make_received: item.make_received || '-',
        updated_requested_quantity: item.backorder_sequence ? (item.reordered_quantity || '-') : (item.updated_requested_quantity || '-'),
        received_quantity: item.received_quantity || '-',
        passed_quantity: item.passed_quantity || '-',
        date_code: item.date_code || '-',
        lot_code: item.lot_code || '-',
        vendor_name: item.vendor_name || '-',
        po_number: item.po_number || '-',
        created_at: item.created_at || '-',
        mrr_no: newMrrNo || item.mrr_no || 'N/A', // Use the newMrrNo if provided
        status: 'QC Cleared',
        backorder_sequence: item.backorder_sequence || null,
      }));
      setComponents(fetchedComponents);
      setHasBackorder(fetchedComponents.some(comp => comp.backorder_sequence !== null));
      const fetchedMrrNo = newMrrNo || response.find(item => item.mrr_no)?.mrr_no || 'N/A';
      setMrrNo(fetchedMrrNo);
    } catch (err) {
      console.error('Error refetching components:', err);
      setError(err.message || 'Failed to refetch components.');
    }
  };

  const handleCocCheckboxChange = (componentSNo) => {
    setCocReceived((prev) => ({
      ...prev,
      [componentSNo]: !prev[componentSNo],
    }));
  };

  const handleFileUpload = (componentSNo, type, event) => {
    const files = Array.from(event.target.files);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'application/pdf'];
    const maxSize = 20 * 1024 * 1024;

    const validFiles = files.filter((file) => {
      if (!allowedTypes.includes(file.type)) {
        message.error(`File ${file.name} is not a valid type. Only JPG, JPEG, or PDF allowed.`, 5);
        return false;
      }
      if (file.size > maxSize) {
        message.error(`File ${file.name} exceeds 20 MB limit.`, 5);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploadedFiles((prev) => ({
      ...prev,
      [componentSNo]: {
        ...prev[componentSNo],
        [type]: [
          ...(prev[componentSNo]?.[type] || []),
          ...validFiles.map((file) => ({
            file,
            name: file.name,
            url: URL.createObjectURL(file),
          })),
        ],
      },
    }));

    setAttachedDocuments((prev) => [
      ...prev,
      ...validFiles.map((file) => ({
        file,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    ]);

    setError('');
  };

  const handleCocUpload = (event) => {
    const files = Array.from(event.target.files);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'application/pdf'];
    const maxSize = 20 * 1024 * 1024;

    const validFiles = files.filter((file) => {
      if (!allowedTypes.includes(file.type)) {
        message.error(`File ${file.name} is not a valid type. Only JPG, JPEG, or PDF allowed.`, 5);
        return false;
      }
      if (file.size > maxSize) {
        message.error(`File ${file.name} exceeds 20 MB limit.`, 5);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setCocFiles((prev) => [
      ...prev,
      ...validFiles.map((file) => ({
        file,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    ]);

    setAttachedDocuments((prev) => [
      ...prev,
      ...validFiles.map((file) => ({
        file,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    ]);

    setError('');
  };

  const handleDeleteCocFile = (fileName) => {
    setCocFiles((prev) => prev.filter((file) => file.name !== fileName));
    setAttachedDocuments((prev) => prev.filter((doc) => doc.name !== fileName));
  };

  const handleReviewFile = (fileUrl) => {
    window.open(fileUrl, '_blank');
  };

  const handleDeleteFile = (componentSNo, type, fileName) => {
    setUploadedFiles((prev) => {
      const updatedComponentFiles = { ...prev[componentSNo] };
      updatedComponentFiles[type] = updatedComponentFiles[type].filter(
        (file) => file.name !== fileName
      );
      if (updatedComponentFiles[type].length === 0) {
        delete updatedComponentFiles[type];
      }
      return {
        ...prev,
        [componentSNo]: updatedComponentFiles,
      };
    });

    setAttachedDocuments((prev) => prev.filter((doc) => doc.name !== fileName));
  };

  const generatePDF = useCallback((componentsToRender = components, currentMrrNo = mrrNo) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const boxHeight = 9;
      let currentY = 15;

      doc.rect(margin, currentY, pageWidth - 2 * margin, boxHeight);
      doc.addImage(logo, 'PNG', margin + 2, currentY + 0.5, 30, 8);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Accelor Microsystems', pageWidth / 2, currentY + 7, { align: 'center' });
      currentY += boxHeight;

      doc.rect(margin, currentY, pageWidth - 2 * margin, boxHeight);
      doc.setFontSize(11);
      doc.text('Material Receipt Report', pageWidth / 2, currentY + 7, { align: 'center' });
      currentY += boxHeight;

      doc.rect(margin, currentY, pageWidth - 2 * margin, boxHeight);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`MRR No: ${currentMrrNo || 'N/A'}`, margin + 5, currentY + 7);
      const backorderSeq = componentsToRender[0]?.backorder_sequence || null;
      if (backorderSeq) {
        doc.text(`Backorder Seq: ${backorderSeq}`, margin + 100, currentY + 7);
      }
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, currentY + 7);
      currentY += boxHeight;

      const rowY = currentY;
      const vendorName = componentsToRender[0]?.vendor_name || 'N/A';
      const created_at = componentsToRender[0]?.created_at || 'N/A';
      const colWidth = (pageWidth - 2 * margin) / 3 - 5;
      doc.text(`PO/Ref.No: ${poNumber || 'N/A'}`, margin + 5, currentY + 7);
      const formattedDate = created_at ? DateTime.fromISO(created_at).toFormat('dd/MM/yyyy') : 'N/A';
      doc.text(`Date: ${formattedDate}`, margin + colWidth + 5, currentY + 7);
      doc.text(`Supplier: ${vendorName}`, margin + 2 * colWidth + 12, currentY + 7);
      currentY += boxHeight;

      doc.rect(margin, rowY, colWidth, boxHeight);
      doc.rect(margin + colWidth, rowY, colWidth + 11, boxHeight);
      doc.rect(margin + 2 * colWidth + 11, rowY, colWidth + 4, boxHeight);

      const tableHeaders = [
        'S.No.',
        'Part No.',
        'Item Description',
        'MPN (Ordered)',
        'Make (Ordered)',
        'Qty (Ordered)',
        'MPN (Received)',
        'Make (Received)',
        '*Date Code',
        '**Lot No.',
        'Qty (Received)',
      ];

      const tableData = componentsToRender.map((component) => [
        component.s_no?.toString() || '',
        component.part_no || '',
        component.item_description || '',
        component.mpn || '',
        component.make || '',
        component.updated_requested_quantity?.toString() || '',
        component.mpn_received || '',
        component.make_received || '',
        component.date_code || '',
        component.lot_code || '',
        component.received_quantity?.toString() || '',
      ]);

      while (tableData.length < 10) {
        tableData.push(['', '', '', '', '', '', '', '', '', '', '']);
      }

      const totalTableWidth = pageWidth - 2 * margin;
      const adjustedColumnWidths = {
        0: 12,
        1: 28,
        2: 38,
        3: 23,
        4: 23,
        5: 18,
        6: 23,
        7: 23,
        8: 19,
        9: 18,
        10: 20,
      };

      autoTable(doc, {
        startY: currentY,
        head: [tableHeaders],
        body: tableData,
        theme: 'grid',
        margin: { left: 15, right: 15 },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineWidth: 0.3,
          lineColor: [0, 0, 0],
          fontSize: 8,
          halign: 'center',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
        },
        columnStyles: adjustedColumnWidths,
      });

      let y = doc.lastAutoTable.finalY;
      const signatureBoxWidth = pageWidth - 2 * margin;
      const signatureBoxHeight = 12;
      const signatureBoxX = pageWidth - margin - signatureBoxWidth;
      doc.rect(signatureBoxX, y, signatureBoxWidth, signatureBoxHeight);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Signature:', signatureBoxX + 125, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.text('', signatureBoxX + 35, y + 8);

      const footerY = y + signatureBoxHeight;
      const footerBoxHeight = 10;
      const footerBoxWidth = (pageWidth - 2 * margin) / 3;

      doc.rect(margin, footerY, footerBoxWidth - 8, footerBoxHeight);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Accelor Microsystems', margin + 5, footerY + 7);

      doc.rect(margin + footerBoxWidth - 8, footerY, footerBoxWidth + 34.8, footerBoxHeight);
      doc.text('Revision No: 01', margin + footerBoxWidth + 5, footerY + 7);

      doc.rect(margin + 2 * footerBoxWidth + 27, footerY, footerBoxWidth - 27, footerBoxHeight);
      doc.text(`Sheet No: ${doc.internal.getCurrentPageInfo().pageNumber}/-`, margin + footerBoxWidth + 135, footerY + 7);

      autoTable(doc, {
        startY: footerY + 10,
        head: [['', 'Name', 'Sign', 'Date', 'Description of Changes', 'Change By', 'Date']],
        body: [
          ['Created By:', 'Ms. Shagun', 'Shagun', '25/11/24', 'Added "Part No." column', 'Ms. Shagun', '25/11/24'],
          ['Approved By:', 'Dr. Salil Dey', 'Salil Dey', '25/11/24', '', '', ''],
        ],
        theme: 'grid',
        margin: { left: 15, right: 15 },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineWidth: 0.3,
          lineColor: [0, 0, 0],
          fontSize: 8,
          halign: 'center',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
        },
      });

      const notesY = doc.lastAutoTable.finalY + 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('*Date code should be within 2 years from the Date of PO.', margin + 2, notesY);
      doc.text('**Lot No./Batch Code and Date code should be available and filled accordingly.', margin + 2, notesY + 4);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('F-STORE-004', 14, notesY - 6, { angle: 90 });

      return doc;
    } catch (err) {
      console.error('PDF generation error:', err);
      message.error('Failed to generate PDF.', 5);
      return null;
    }
  }, [components, mrrNo, poNumber]);

  const handlePreviewPDF = useCallback(async () => {
    try {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      setPdfUrl(null);
      setNumPages(null);
      setIsPreviewModalVisible(true);

      const doc = generatePDF();
      if (!doc) {
        throw new Error('Failed to generate PDF document');
      }

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);

      setPdfUrl(url);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      message.error('Failed to generate PDF preview. Please try again.', 5);
      setIsPreviewModalVisible(false);
    }
  }, [generatePDF, pdfUrl]);

  const handleModalClose = useCallback(() => {
    setIsPreviewModalVisible(false);
    setNumPages(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  }, [pdfUrl]);

  const handlePrintPDF = () => {
    if (!pdfUrl) return;

    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.top = '-9999px';
    printContainer.style.left = '-9999px';
    printContainer.style.width = '100%';
    printContainer.style.height = '100%';
    printContainer.className = 'print-container';

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.src = pdfUrl;
    printContainer.appendChild(iframe);
    document.body.appendChild(printContainer);

    iframe.onload = () => {
      const iframeDoc = iframe.contentWindow || iframe.contentDocument;
      if (iframeDoc.document) iframeDoc.document = iframeDoc.document;

      const style = iframeDoc.document.createElement('style');
      style.innerHTML = `
        body {
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: #fff;
        }
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .pdf-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            page-break-after: always;
            box-sizing: border-box;
            padding: 10mm;
          }
          .pdf-page img {
            width: 100%;
            height: auto;
            display: block;
          }
        }
      `;
      iframeDoc.document.head.appendChild(style);

      setTimeout(() => {
        iframeDoc.focus();
        iframeDoc.print();
        document.body.removeChild(printContainer);
      }, 500);
    };
  };

  const handleDownloadPDF = useCallback((componentsToRender = components, currentMrrNo = mrrNo) => {
    try {
      const doc = generatePDF(componentsToRender, currentMrrNo);
      if (doc) {
        doc.save(`MRR_${poNumber || 'N/A'}_${currentMrrNo || 'N/A'}.pdf`);
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error('Failed to generate PDF. Please try again.', 5);
    }
  }, [generatePDF, poNumber, mrrNo]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (!poNumber) {
        throw new Error('PO Number is required');
      }

      for (const component of components) {
        const sNo = component.s_no;
        const isCocChecked = cocReceived[sNo] || false;
        if (isCocChecked && cocFiles.length === 0) {
          throw new Error('CoC attachment is mandatory. Please upload a CoC document.');
        }
      }

      const idFiles = [];
      Object.keys(uploadedFiles).forEach((sNo) => {
        if (uploadedFiles[sNo]?.id) {
          idFiles.push(...uploadedFiles[sNo].id);
        }
      });

      const allowedTypes = ['image/jpeg', 'image/jpg', 'application/pdf'];
      const maxFileSize = 20 * 1024 * 1024;

      const validateFiles = (files, type) => {
        files.forEach((f, index) => {
          if (!allowedTypes.includes(f.file.type)) {
            throw new Error(`Invalid file type for ${type} file ${index + 1}: Only JPG, JPEG, or PDF allowed`);
          }
          if (f.file.size > maxFileSize) {
            throw new Error(`File ${type} ${index + 1} exceeds 20 MB limit`);
          }
        });
      };

      validateFiles(cocFiles, 'CoC');
      validateFiles(idFiles, 'ID Card');

      if (cocFiles.length === 0 && idFiles.length === 0) {
        throw new Error('Kindly attach the required documents');
      }
      if (idFiles.length === 0) {
        throw new Error('ID document is required. Please attach an ID file.');
      }

      const componentGroups = components.reduce((acc, component) => {
        const key = component.backorder_sequence || 'null';
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(component);
        return acc;
      }, {});

      let newMrrNo = mrrNo;

      for (const [backorderSeq, groupComponents] of Object.entries(componentGroups)) {
        const backorderSequence = backorderSeq === 'null' ? null : backorderSeq;
        console.log(`Submitting for backorder_sequence: ${backorderSequence}`, groupComponents);

        const response = await uploadMRRDocuments(
          poNumber,
          groupComponents,
          cocFiles.map((f) => f.file),
          idFiles.map((f) => f.file),
          backorderSequence
        );

        if (response.mrr_no && response.mrr_no !== 'N/A') {
          newMrrNo = response.mrr_no;
          setMrrNo(newMrrNo);
          setComponents((prevComponents) =>
            prevComponents.map((comp) =>
              comp.backorder_sequence === backorderSequence || (!comp.backorder_sequence && !backorderSequence)
                ? { ...comp, mrr_no: newMrrNo }
                : comp
            )
          );
        }

        setShouldDownloadPDF({ components: groupComponents, mrrNo: newMrrNo });
      }

      await refetchComponents(newMrrNo);

      setSuccess('Documents uploaded successfully!');
      setUploadedFiles({});
      setCocReceived({});
      setCocFiles([]);
      setAttachedDocuments([]);
    } catch (err) {
      console.error('Error uploading documents:', err);
      message.error(err.message || 'Failed to upload documents. Please try again.', 5);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (shouldDownloadPDF) {
      handleDownloadPDF(shouldDownloadPDF.components, shouldDownloadPDF.mrrNo);
      setShouldDownloadPDF(null);
    }
  }, [shouldDownloadPDF, handleDownloadPDF]);

  return (
    <div className="min-h-screen elegant-bg overflow-y-auto">
      <div className="pt-6 px-6">
        <div className="w-full mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-xl p-10 transform transition-all hover:shadow-2xl fade-in">
            {error && (
              <div className="mb-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
                  <span className="font-medium">Error: </span>{error}
                </div>
              </div>
            )}
            {success && (
              <div className="mb-6">
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg" role="alert">
                  <span className="font-medium">Success: </span>{success}
                </div>
              </div>
            )}
            <div className="flex justify-between items-center mb-10">
              <h1 className="text-4xl font-bold text-blue-800 border-l-4 border-green-600 pl-4 animate-slide-in">
                Material Receipt Report
              </h1>
              <div className="flex space-x-4">
                <button
                  onClick={handlePreviewPDF}
                  className="text-gray-600 hover:text-blue-600 transition-all transform hover:scale-105 pulse p-2 rounded-full bg-gray-100 hover:bg-blue-50"
                  title="Preview PDF"
                >
                  <EyeIcon className="h-7 w-7" />
                </button>
                {/* <button
                  onClick={handlePrintPDF}
                  className="text-gray-600 hover:text-purple-600 transition-all transform hover:scale-105 pulse p-2 rounded-full bg-gray-100 hover:bg-purple-50"
                  title="Print PDF"
                >
                  <PrinterIcon className="h-7 w-7" />
                </button> */}
                <button
                  onClick={() => handleDownloadPDF()}
                  className="text-gray-600 hover:text-green-600 transition-all transform hover:scale-105 pulse p-2 rounded-full bg-gray-100 hover:bg-green-50"
                  title="Download as PDF"
                >
                  <ArrowDownTrayIcon className="h-7 w-7" />
                </button>
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl mb-10 shadow-inner fade-in">
              <div className="flex justify-between items-center mb-6">
                <div className="text-xl font-bold text-gray-900">
                  PO: {poNumber || 'N/A'} | MRR No: {mrrNo}
                </div>
                <div className="flex items-center gap-3">
                  <label className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 flex items-center gap-2 shadow-sm">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2m-2-6l5 5m0-5l-5 5"
                      />
                    </svg>
                    Attach CoC
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.pdf"
                      multiple
                      onChange={handleCocUpload}
                      className="hidden"
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
              </div>
              {cocFiles.length > 0 && (
                <div className="mb-4 flex justify-end space-x-3">
                  {cocFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg">
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-gray-600">{file.name}</span>
                      <button
                        onClick={() => handleReviewFile(file.url)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-all transform hover:scale-105 disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        Review
                      </button>
                      <button
                        onClick={() => handleDeleteCocFile(file.name)}
                        className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700 transition-all transform hover:scale-105 disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {attachedDocuments.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Attached Documents:</h3>
                  <div className="flex flex-wrap gap-3">
                    {attachedDocuments.map((doc, index) => (
                      <div key={index} className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg">
                        <button
                          onClick={() => handleReviewFile(doc.url)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {doc.name}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {loading ? (
              <div className="text-center text-gray-600 text-lg">Loading components...</div>
            ) : components.length === 0 ? (
              <div className="text-center text-gray-600 text-lg">
                No components found for this PO with status QC Cleared.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto shadow-md rounded-xl">
                  <table className="w-full border-collapse rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">S No</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Part No</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Item Description</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">MPN</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Received MPN</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Make</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Received Make</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Ordered Qty</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Received Qty</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Passed Qty</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Date Code</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Lot Code</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Vendor Name</th>
                        {hasBackorder && (
                          <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Backorder Seq</th>
                        )}
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Status</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">CoC Received</th>
                        <th className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-800">Documents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((component) => {
                        const componentFiles = uploadedFiles[component.s_no] || {};
                        const idFiles = componentFiles['id'] || [];

                        return (
                          <tr key={component.s_no} className="hover:bg-blue-50 transition-colors duration-200 row-enter">
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.s_no}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.part_no}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.item_description}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.mpn}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.mpn_received}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.make}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.make_received}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.updated_requested_quantity}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.received_quantity}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.passed_quantity}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.date_code}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.lot_code}</td>
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.vendor_name}</td>
                            {hasBackorder && (
                              <td className="border-b border-gray-200 p-4 text-sm text-gray-700">{component.backorder_sequence || '-'}</td>
                            )}
                            <td className="border-b border-gray-200 p-4 text-sm text-gray-700">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  component.status === 'QC Cleared'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {component.status}
                              </span>
                            </td>
                            <td className="border-b border-gray-200 p-4 text-sm text-center">
                              <input
                                type="checkbox"
                                checked={cocReceived[component.s_no] || false}
                                onChange={() => handleCocCheckboxChange(component.s_no)}
                                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                disabled={isSubmitting}
                              />
                            </td>
                            <td className="border-b border-gray-200 p-4 text-sm">
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">ID:</label>
                                  {idFiles.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                      {idFiles.map((file, index) => (
                                        <div key={index} className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg">
                                          <svg
                                            className="w-5 h-5 text-green-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth="2"
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                          <span className="text-sm text-gray-600">{file.name}</span>
                                          <button
                                            onClick={() => handleReviewFile(file.url)}
                                            className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-all transform hover:scale-105 disabled:opacity-50"
                                            disabled={isSubmitting}
                                          >
                                            Review
                                          </button>
                                          <button
                                            onClick={() => handleDeleteFile(component.s_no, 'id', file.name)}
                                            className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700 transition-all transform hover:scale-105 disabled:opacity-50"
                                            disabled={isSubmitting}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.pdf"
                                    multiple
                                    onChange={(e) => handleFileUpload(component.s_no, 'id', e)}
                                    className="mt-2 text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                                    disabled={isSubmitting}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-10 space-x-4">
                  <button
                    onClick={handleSubmit}
                    className="bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 h-12 px-8 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 pulse text-base font-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Modal
        title="PDF Preview"
        open={isPreviewModalVisible}
        onCancel={handleModalClose}
        footer={[
          <Button
            key="download"
            onClick={() => handleDownloadPDF()}
            className="bg-green-600 text-white hover:bg-green-700 rounded-lg"
          >
            Download PDF
          </Button>,
          <Button
            key="close"
            onClick={handleModalClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
          >
            Close
          </Button>,
        ]}
        width={1200}
        styles={{
          body: {
            height: '600px',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
          },
          content: {
            padding: 0,
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
          header: {
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            padding: '16px 24px',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
          },
          footer: {
            borderTop: '1px solid #e5e7eb',
            padding: '12px 24px',
            backgroundColor: '#ffffff',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
          },
        }}
        centered
      >
        {pdfUrl ? (
          <div
            style={{
              width: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              backgroundColor: '#ffffff',
              borderRadius: '4px',
              padding: '16px 0',
            }}
          >
            <div
              style={{
                minWidth: '1100px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={(error) => {
                  console.error('Error loading PDF:', error);
                  message.error('Failed to load PDF preview.', 5);
                  handleModalClose();
                }}
                loading={<div className="text-center text-gray-600 p-4">Loading PDF...</div>}
                options={{
                  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.3.136/cmaps/',
                  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.3.136/standard_fonts/',
                }}
              >
                {numPages ? (
                  Array.from({ length: numPages }, (_, index) => (
                    <div
                      key={`page_${index + 1}`}
                      style={{
                        margin: '16px 0',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        backgroundColor: '#fff',
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <Page
                        pageNumber={index + 1}
                        scale={0.9}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        onRenderError={(error) => {
                          console.error('Error rendering PDF page:', error);
                          message.error('Failed to render PDF page.', 5);
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-600 p-4">Rendering PDF...</div>
                )}
              </Document>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-600 p-4">Generating PDF...</div>
        )}
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
          content: '';
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
        table {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
        }
        table::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        table::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 12px;
        }
        table::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 12px;
          border: 2px solid #f1f1f1;
        }
        table::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        table thead tr th {
          background: #f8fafc;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
          text-align: center;
          padding: 16px;
          font-size: 14px;
          transition: background 0.3s ease;
        }
        table thead tr th:hover {
          background: #e6f0ff;
        }
        table tbody tr td {
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
          text-align: center;
          padding: 16px;
          font-size: 14px;
          transition: background 0.3s ease;
        }
        table tbody tr:hover td {
          background: #e6f0ff;
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            'Helvetica Neue', Arial, sans-serif !important;
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
        .bg-green-50 {
          background-color: #f0fdf4 !important;
        }
        .border-green-200 {
          border-color: #bbf7d0 !important;
        }
        .text-green-700 {
          color: #15803d !important;
        }
        .ant-modal {
          top: 20px !important;
        }
        .ant-modal-content {
          border-radius: 8px !important;
          overflow: hidden !important;
        }
        .ant-modal-header {
          margin-bottom: 0 !important;
        }
        .ant-modal-title {
          font-size: 18px !important;
          font-weight: 600 !important;
          color: #1f2937 !important;
        }
        .ant-modal-footer {
          display: flex !important;
          justify-content: flex-end !important;
          gap: 12px !important;
        }
        .ant-modal-footer .ant-btn {
          padding: 8px 20px !important;
          height: auto !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          border-radius: 6px !important;
          transition: all 0.3s ease !important;
        }
        .ant-modal-footer .ant-btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        }
        .ant-modal-body::-webkit-scrollbar {
          width: 8px !important;
          height: 8px !important;
        }
        .ant-modal-body::-webkit-scrollbar-track {
          background: #f1f1f1 !important;
          border-radius: 4px !important;
        }
        .ant-modal-body::-webkit-scrollbar-thumb {
          background: #888 !important;
          border-radius: 4px !important;
        }
        .ant-modal-body::-webkit-scrollbar-thumb:hover {
          background: #555 !important;
        }
        .print-container {
          display: none;
        }
        @media print {
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-container {
            display: block !important;
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
};

export default QualityInspectionComponentsPage;