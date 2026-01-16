import React, { useState, useEffect } from "react";
import { Button, Table, Input, InputNumber, Alert, Select } from "antd";
import {
  fetchPendingNonCOCIssueRequests,
  fetchPastNonCOCIssuedRequests,
  fetchNonCOCIssueRequestDetails,
  approveNonCOCMaterialIssueForm,
  rejectNonCOCMaterialIssueForm,
  submitNonCOCMaterialIssueForm,
  fetchPastIssuedRequestDetails,
  confirmReceipt,
  fetchMrfRequestDetails,
  rejectMrfRequest,
  approveMrfRequest,
   updateVendorDetails,
} from "../utils/api.js";
import { DateTime } from "luxon";
import { useParams, useNavigate } from "react-router-dom";
import ConfirmationModal from "../components/ConfirmationModal";
import NotesSection from "../components/NotesSection";
import VendorDetailsModal from "../components/VendorDetailsModal.jsx";
import {
  XCircleIcon,
  MagnifyingGlassIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";

// Component: NonCOCrequests
// Description: Manages non-COC material issue requests, displaying pending and past issued requests,
// with functionality to approve, reject, and view MRF details.
const NonCOCrequests = () => {
  // State Definitions
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [pastIssuedRequests, setPastIssuedRequests] = useState([]);
  const [filteredPastIssuedRequests, setFilteredPastIssuedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetails, setRequestDetails] = useState([]);
  const [mrfDetails, setMrfDetails] = useState([]);
  const [mifPreviewItems, setMifPreviewItems] = useState([]);
  const [mrfPreviewItems, setMrfPreviewItems] = useState([]);
  const [issueDate, setIssueDate] = useState(DateTime.now().toISO());
  const [mifFetchedNotes, setMifFetchedNotes] = useState([]);
  const [mifCurrentUserNotes, setMifCurrentUserNotes] = useState([]);
  const [mrfFetchedNotes, setMrfFetchedNotes] = useState([]);
  const [mrfCurrentUserNotes, setMrfCurrentUserNotes] = useState([]);
  const [highlightMifNote, setHighlightMifNote] = useState(false);
  const [highlightMrfNote, setHighlightMrfNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPastIssued, setShowPastIssued] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [mifPriority, setMifPriority] = useState(false);
  const [mrfPriority, setMrfPriority] = useState(false);
  const [mrfPrioritySetBy, setMrfPrioritySetBy] = useState(null);
  const [showMrfDetailsPanel, setShowMrfDetailsPanel] = useState(false);
  const [isMifApproved, setIsMifApproved] = useState(false);
  const [isMrfApproved, setIsMrfApproved] = useState(false);
  const [isMifApproveModalOpen, setIsMifApproveModalOpen] = useState(false);
  const [isMifRejectModalOpen, setIsMifRejectModalOpen] = useState(false);
  const [isMrfApproveModalOpen, setIsMrfApproveModalOpen] = useState(false);
  const [isMrfRejectModalOpen, setIsMrfRejectModalOpen] = useState(false);
  const [isMrfPastApproved, setIsMrfPastApproved] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  // Add new state for quantity errors
  const [quantityErrors, setQuantityErrors] = useState({});

  // User Information
  const userId = localStorage.getItem("user_id") || null;
  const userRole = localStorage.getItem("role") || "employee";
  const userName = localStorage.getItem("name") || "Unknown";
  const isHead = userRole.endsWith("_head") || userRole === "admin";
  const department = userRole.match(/^(\w+)_(head|employee)$/)?.[1] || "N/A";

  // Effect: Initial Fetch of Pending Requests
  useEffect(() => {
    if (!["inventory_head", "inventory_employee", "admin"].includes(userRole)) {
      setError("Unauthorized: Only inventory team and admin can access this page.");
      return;
    }

    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPendingNonCOCIssueRequests();
        const mappedRequests = data
          .map((req, index) => ({
            key: index + 1,
            reference: `${req.umi}`,
            requestedBy: req.user_name,
            date: req.date,
            status: req.status,
            umi: req.umi,
            project_name: req.project_name || "N/A",
            userId: req.user_id,
            priority: req.priority || false,
            mrf_no: req.mrf_no || "No MRF",
          }))
          .sort((a, b) => DateTime.fromISO(b.date) - DateTime.fromISO(a.date));
        setRequests(mappedRequests);
        setFilteredRequests(mappedRequests);
      } catch (error) {
        setError("Failed to fetch pending issue requests.");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [userRole]);

  // Effect: Filter Pending Requests Based on Search Term
  useEffect(() => {
    let filtered = requests;
    if (searchTerm) {
      filtered = filtered.filter(
        (req) =>
          req.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
          DateTime.fromISO(req.date)
            .toFormat("dd-MM-yyyy HH:mm:ss")
            .includes(searchTerm.toLowerCase()) ||
          req.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    filtered = filtered.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return DateTime.fromISO(b.date) - DateTime.fromISO(a.date);
    });
    setFilteredRequests(filtered);
  }, [searchTerm, requests]);

  // Effect: Filter Past Issued Requests Based on Search Term
  useEffect(() => {
    let filtered = pastIssuedRequests;
    if (searchTerm) {
      filtered = filtered.filter(
        (req) =>
          req.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.mi.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
          DateTime.fromISO(req.date)
            .toFormat("dd-MM-yyyy HH:mm:ss")
            .includes(searchTerm.toLowerCase()) ||
          req.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredPastIssuedRequests(
      filtered.sort((a, b) => DateTime.fromISO(b.date) - DateTime.fromISO(a.date))
    );
  }, [searchTerm, pastIssuedRequests]);

  // Effect: Update MRF Details with Total Quantity
  useEffect(() => {
    if (!showMrfDetailsPanel || mrfDetails.length === 0 || requestDetails.length === 0) return;

    const updatedMrf = mrfDetails.map((item) => ({
      ...item,
      totalQty: calculateTotalQty(item, requestDetails),
    }));
    setMrfDetails(updatedMrf);
  }, [showMrfDetailsPanel, mrfDetails.length, requestDetails.length]);

  // Utility Functions
  const formatDate = (dateString) => {
    return DateTime.fromISO(dateString).toFormat("dd-MM-yyyy HH:mm:ss");
  };

  const calculateTotalQty = (mrfItem, mifDetails) => {
    if (!mrfItem || !mifDetails) {
      console.warn("Invalid inputs: mrfItem or mifDetails is missing");
      return 0;
    }
    if (!mrfItem.component_id || !mrfItem.mpn) {
      console.warn("Missing component_id or mpn in mrfItem:", mrfItem);
      return Number(mrfItem.updatedQty) || 0;
    }

    const normalize = (value) => (value ? String(value).trim().toLowerCase() : "");
    const mrfMpn = normalize(mrfItem.mpn);
    const mrfComponentId = normalize(mrfItem.component_id);

    const mifItem = mifDetails.find((mif) => {
      const mifMpn = normalize(mif.mpn);
      const mifComponentId = normalize(mif.component_id);
      return mifMpn === mrfMpn && mifComponentId === mrfComponentId;
    });

    const mrfQty = Number(mrfItem.updatedQty) || 0;
    const mifQty = mifItem ? Number(mifItem.issuedQty || 0) : 0;

    if (isNaN(mrfQty) || isNaN(mifQty)) {
      console.warn("Invalid quantities: mrfQty or mifQty is NaN");
      return 0;
    }

    return mrfQty + mifQty;
  };

// Handler: Fetch Past Issued Requests
const handleFetchPastIssued = async () => {
  setLoading(true);
  setError(null);
  setShowPastIssued(true);
  try {
    const data = await fetchPastNonCOCIssuedRequests();
    const mappedData = data
    .map((req, index) => ({
      key: index + 1,
      reference: `${req.umi}`,
      mi: req.mi,
      requestedBy: req.user_name,
      issuedDate: req.issue_date,
      date: req.date,
      status: req.status,
      umi: req.umi,
      project_name: req.project_name || "N/A",
      priority: req.priority || false,
      mrf_no: req.mrf_no || "No MRF",
      user_department: req.user_department || "N/A",
      mrr_options: req.mrr_options || [],
    }))
      .sort((a, b) => DateTime.fromISO(b.date) - DateTime.fromISO(a.date));
    setPastIssuedRequests(mappedData);
    setFilteredPastIssuedRequests(mappedData);
  } catch (error) {
    setError("Failed to fetch past issued requests.");
    setPastIssuedRequests([]);
  } finally {
    setLoading(false);
  }
};
// In the handleSelectRequest function, replace the past issued request details fetching logic with the following:
const handleSelectRequest = async (request) => {
  setSelectedRequest(request);
  setIssueDate(DateTime.now().toISO());
  setShowMrfDetailsPanel(false);
  setMrfDetails([]);
  setMifPreviewItems([]);
  setMrfPreviewItems([]);
  setMifFetchedNotes([]);
  setMifCurrentUserNotes([]);
  setMrfFetchedNotes([]);
  setMrfCurrentUserNotes([]);
  setHighlightMifNote(false);
  setHighlightMrfNote(false);
  setError(null);
  setMifPriority(false);
  setMrfPriority(false);
  setMrfPrioritySetBy(null);
  setIsMifApproved(false);
  setIsMrfApproved(false);
  setIsMrfPastApproved(false);
  try {
    if (showPastIssued) {
      const details = await fetchPastIssuedRequestDetails(request.umi);
      if (details.length === 0) {
        setError("No details available for this request.");
        setRequestDetails([]);
        return;
      }

      // Log raw details for debugging
      console.log("Raw past issued details:", details);
      // Group details by umi and component_id to prevent duplicates
      const groupedByUmi = details.reduce((acc, item) => {
        const umiKey = item.umi;
        if (!acc[umiKey]) {
          acc[umiKey] = {
            umi: item.umi,
            mi: item.mi,
            issue_date: item.issue_date,
            user_name: item.user_name,
            user_department: item.user_department,
            mif_note: item.mif_note,
            head_note: item.head_note,
            priority: item.priority,
            components: [],
          };
        }

        // Avoid duplicate components
        const componentKey = item.component_id;
        const existingComponent = acc[umiKey].components.find(
          (comp) => comp.component_id === componentKey
        );

        if (!existingComponent) {
          acc[umiKey].components.push({
            component_id: item.component_id,
            mpn: item.mpn,
            item_description: item.item_description,
            part_no: item.part_no,
            make: item.make,
            uom: item.uom,
            on_hand_quantity: item.on_hand_quantity,
            location: item.location,
            issued_quantity: Number(item.issued_quantity) || 0,
            updated_requestedqty: Number(item.updated_requestedqty) || 0,
            initial_requestedqty: Number(item.initial_requestedqty) || 0,
            mif_remark: item.mif_remark || "N/A",
            head_remark: item.head_remark || "N/A",
            mrr_options: item.mrr_options || [],
            mrr_allocations: item.mrr_allocations || [], // Use mrr_allocations from backend
          });
        } else {
          // Aggregate quantities if duplicate component exists
          existingComponent.issued_quantity += Number(item.issued_quantity) || 0;
          existingComponent.updated_requestedqty += Number(item.updated_requestedqty) || 0;
          existingComponent.initial_requestedqty += Number(item.initial_requestedqty) || 0;
          if (item.mif_remark && item.mif_remark !== "N/A") {
            existingComponent.mif_remark = existingComponent.mif_remark.includes(item.mif_remark)
              ? existingComponent.mif_remark
              : `${existingComponent.mif_remark}; ${item.mif_remark}`;
          }
        }

        return acc;
      }, {});

      // Convert grouped data into the format expected by the table
      const umiDetails = Object.values(groupedByUmi)[0]; // Single UMI
      if (!umiDetails) {
        setError("No valid UMI details found for this request.");
        setRequestDetails([]);
        return;
      }

// Inside handleSelectRequest for showPastIssued
setRequestDetails(
  umiDetails.components.map((item, index) => {
    // Map mrr_allocations to selected_mrrs format
    const selectedMrrs = (item.mrr_allocations || []).map((alloc) => ({
      mrr_no: alloc.mrr_no || "N/A",
      quantity: Number(alloc.quantity) || 0,
    }));

    // Validate mrr_options
          const mrrOptions = Array.isArray(item.mrr_options)
            ? item.mrr_options.map((opt) => ({
                mrr_no: opt.mrr_no || "N/A",
                material_in_quantity: Number(opt.material_in_quantity) || 0,
                source: opt.source || "N/A",
              }))
            : [];
            // Log for debugging
          console.log(
            `Component ${item.component_id} - MRR Options:`,
            mrrOptions,
            "Selected MRRs:",
            selectedMrrs
          );

    const matchingMrrs =
            selectedMrrs.length > 0
              ? mrrOptions.filter((opt) =>
                  selectedMrrs.some((alloc) =>
                    String(opt.mrr_no)
                      .trim()
                      .toLowerCase() ===
                    String(alloc.mrr_no)
                      .trim()
                      .toLowerCase()
                  )
                )
              : mrrOptions;

    return {
      key: index + 1,
      umi: umiDetails.umi,
      mi: umiDetails.mi,
      component_id: item.component_id,
      description: item.item_description || "N/A",
      mpn: item.mpn || "N/A",
      part_no: item.part_no || "N/A",
      make: item.make || "N/A",
      uom: item.uom || "N/A",
      onHandQty: item.on_hand_quantity || 0,
      location: item.location || "N/A",
      updatedQty: item.updated_requestedqty || 0,
      issuedQty: item.issued_quantity || 0,
      initialQty: item.initial_requestedqty || 0,
      issueDate: umiDetails.issue_date,
      requestedBy: umiDetails.user_name || "N/A",
      mif_note: umiDetails.mif_note || "N/A",
      head_note: umiDetails.head_note || "N/A",
      mif_remark: item.mif_remark || "N/A",
      head_remark: item.head_remark || "N/A",
      priority: umiDetails.priority || false,
      user_department: umiDetails.user_department || "N/A",
      mrr_options: matchingMrrs,
      selected_mrrs: selectedMrrs,
    };
  })
);

      setIssueDate(DateTime.fromISO(umiDetails.issue_date || DateTime.now().toISO()).toISO());

      const headNote = umiDetails.head_note;
      const mifNote = umiDetails.mif_note;
      const combinedNotes = [];
      if (Array.isArray(headNote)) {
        const normalizedHeadNotes = headNote.map((note) => ({
          ...note,
          user_name: note.user_name || note.userName || note.username || "Previous User",
        }));
        combinedNotes.push(...normalizedHeadNotes);
      }
      if (Array.isArray(mifNote)) {
        const normalizedMifNotes = mifNote.map((note) => ({
          ...note,
          user_name: note.user_name || note.userName || note.username || "Inventory Head",
        }));
        combinedNotes.push(...normalizedMifNotes);
      }
      setMifFetchedNotes(combinedNotes);
      setMifCurrentUserNotes([]);
    } else {
      const details = await fetchNonCOCIssueRequestDetails(request.umi);
      if (details.length === 0) {
        setError("No details available for this request.");
        setRequestDetails([]);
        return;
      }
      const updatedSelectedRequest = {
        ...request,
        mrf_no: details[0]?.mrf_no || request.mrf_no,
        project_name: details[0]?.project_name || request.project_name,
        user_department: details[0]?.user_department || "N/A",
      };
      setSelectedRequest(updatedSelectedRequest);

      console.log("Raw details from backend:", details);

      const mappedDetails = details.map((item, index) => {
        const mrrOptions = Array.isArray(item.mrr_options)
          ? item.mrr_options.map((option) => ({
              mrr_no: option.mrr_no || "N/A",
              material_in_quantity: option.material_in_quantity || 0,
              source: option.source || "N/A",
            }))
          : [];

        let allocatedMrrs = [];
        try {
          const parsedAllocations = item.mrr_allocations
            ? typeof item.mrr_allocations === "string"
              ? JSON.parse(item.mrr_allocations)
              : item.mrr_allocations
            : [];
          allocatedMrrs = Array.isArray(parsedAllocations)
            ? parsedAllocations.map((alloc) => ({
                mrr_no: alloc.mrr_no || "N/A",
                quantity: Number(alloc.quantity) || 0,
              }))
            : [];
        } catch (error) {
          console.error("Error parsing mrr_allocations for component_id:", item.component_id, error);
          allocatedMrrs = [];
        }

      console.log(
          `Component ${item.component_id} - MRR Options:`,
          mrrOptions,
          "Selected MRRs:",
          allocatedMrrs
        );

       const filteredMrrOptions =
          allocatedMrrs.length > 0
            ? mrrOptions.filter((option) =>
                allocatedMrrs.some((alloc) =>
                  String(option.mrr_no)
                    .trim()
                    .toLowerCase() ===
                  String(alloc.mrr_no)
                    .trim()
                    .toLowerCase()
                )
              )
            : mrrOptions;

        return {
          key: index + 1,
          umi: item.umi,
          basket_id: item.basket_id,
          component_id: item.component_id,
          description: item.item_description || "N/A",
          mpn: item.mpn || "N/A",
          part_no: item.part_no || "N/A",
          make: item.make || "N/A",
          uom: item.uom|| "N/A",
          onHandQty: item.on_hand_quantity || 0,
          location: item.location || "N/A",
          updatedQty: Number(item.updated_requestedqty) || 0,
          issuedQty: Number(item.updated_requestedqty) || 0,
          initialQty: Number(item.initial_requestedqty) || 0,
          user_department: item.user_department || "N/A",
          requestedBy: item.user_name || "N/A",
          head_note: item.head_note,
          mif_note: item.mif_note,
          head_remark: item.head_remark,
          mif_remark: item.mif_remark || "",
          priority: item.priority || false,
          highlightRemark: false,
          mrr_options: filteredMrrOptions,
          selected_mrrs: allocatedMrrs,
        };
      });

      console.log("Mapped request details:", mappedDetails);

      setRequestDetails(mappedDetails);

      const headNote = details[0]?.head_note;
      const mifNote = details[0]?.mif_note;
      const combinedNotes = [];
      if (Array.isArray(headNote)) {
        const normalizedHeadNotes = headNote.map((note) => ({
          ...note,
          user_name: note.user_name || note.userName || note.username || "Previous User",
        }));
        combinedNotes.push(...normalizedHeadNotes);
      }
      if (Array.isArray(mifNote)) {
        const normalizedMifNotes = mifNote.map((note) => ({
          ...note,
          user_name: note.user_name || note.userName || note.username || "Inventory Head",
        }));
        combinedNotes.push(...normalizedMifNotes);
      }
      setMifFetchedNotes(combinedNotes);
      setMifCurrentUserNotes([]);
    }
  } catch (error) {
    setError(error.response?.data?.message || "Failed to fetch request details.");
    setRequestDetails([]);
  }
};

const handleApprove = async () => {
  if (!selectedRequest || showPastIssued) {
    setError("No editable request selected or this is a past issued request.");
    return;
  }
  if (selectedRequest.status !== "Inventory Approval Pending") {
    setError("This request is not ready for approval.");
    return;
  }

  const missingRemarkItems = requestDetails.filter(
    (item) => item.issuedQty !== item.updatedQty && !item.remark
  );
  if (missingRemarkItems.length > 0) {
    setError("Remarks are required for items with changed quantities.");
    return;
  }

  const invalidQuantities = requestDetails.some(
    (item) =>
      item.issuedQty === undefined ||
      item.issuedQty === null ||
      isNaN(item.issuedQty) ||
      item.issuedQty < 0 ||
      !Number.isInteger(Number(item.issuedQty))
  );
  if (invalidQuantities) {
    setError("All issued quantities must be valid non-negative integers.");
    return;
  }

  // Validate MRR allocations
  const invalidMrrAllocations = requestDetails.some((item) => {
    if (!item.selected_mrrs || item.selected_mrrs.length === 0) {
      return false; // MRR allocations are optional
    }
    const totalMrrQty = item.selected_mrrs.reduce(
      (sum, mrr) => sum + Number(mrr.quantity),
      0
    );
    return totalMrrQty !== item.issuedQty || // Must match issuedQty
           item.selected_mrrs.some(
             (mrr) =>
               (mrr.mrr_no && (typeof mrr.mrr_no !== 'string' || mrr.mrr_no.trim() === '')) ||
               typeof mrr.quantity !== 'number' ||
               mrr.quantity <= 0 ||
               !Number.isInteger(mrr.quantity)
           );
  });
  if (invalidMrrAllocations) {
    setError("Invalid MRR allocations: Total quantities must match issued quantity, and each allocation must have valid quantity (positive integer).");
    return;
  }

  try {
    const items = requestDetails.map((item) => ({
      component_id: item.component_id,
      issued_quantity: Number(item.issuedQty),
      remark: item.remark || "",
      mrr_allocations: item.selected_mrrs && item.selected_mrrs.length > 0
        ? item.selected_mrrs.map((mrr) => ({
            mrr_no: mrr.mrr_no || null, // Allow null if mrr_no is optional
            quantity: Number(mrr.quantity),
          }))
        : [],
    }));

    console.log("Submitting MIF with items:", items);

    const response = await submitNonCOCMaterialIssueForm(
      selectedRequest.umi,
      items,
      issueDate,
      mifCurrentUserNotes
    );

    setRequests((prev) => prev.filter((req) => req.umi !== selectedRequest.umi));
    setFilteredRequests((prev) =>
      prev.filter((req) => req.umi !== selectedRequest.umi)
    );
    setSelectedRequest(null);
    setRequestDetails([]);
    setMrfDetails([]);
    setMifPreviewItems([]);
    setMrfPreviewItems([]);
    setIssueDate(DateTime.now().toISO());
    setShowMrfDetailsPanel(false);
    setError(null);
    alert(`Request approved successfully! MI: ${response.mi}`);
  } catch (error) {
    const errorMessage =
      error.error || error.message || "Failed to approve request.";
    setError(errorMessage);
    if (errorMessage.includes("Invalid time value")) {
      setError(
        "Invalid issue date format. Please ensure the date is in ISO format (e.g., 2025-04-16T12:00:00Z)."
      );
    } else if (errorMessage.includes("Insufficient stock")) {
      setError(
        "Insufficient stock for one or more components. Please adjust the issued quantities."
      );
    }
  }
};

  // Handler: Reject MIF Request
  const handleReject = async () => {
    if (!selectedRequest || showPastIssued) {
      setError("No editable request selected or this is a past issued request.");
      return;
    }
    if (mifCurrentUserNotes.length === 0) {
      setHighlightMifNote(true);
      setError("Note is required for rejection.");
      return;
    }
    if (selectedRequest.status !== "Inventory Approval Pending") {
      setError("This request is not ready for rejection.");
      return;
    }
    try {
      const response = await rejectNonCOCMaterialIssueForm(selectedRequest.umi, mifCurrentUserNotes);
      console.log("Rejection response:", response);
      setRequests((prev) => prev.filter((req) => req.umi !== selectedRequest.umi));
      setFilteredRequests((prev) => prev.filter((req) => req.umi !== selectedRequest.umi));
      setSelectedRequest(null);
      setRequestDetails([]);
      setMrfDetails([]);
      setMifPreviewItems([]);
      setMrfPreviewItems([]);
      setIssueDate(DateTime.now().toISO());
      setShowMrfDetailsPanel(false);
      setError(null);
      alert(`Request rejected successfully. MI: ${response.mi}`);
    } catch (error) {
      console.error("Rejection error:", error);
      setError(error.response?.data?.message || "Failed to reject request.");
    }
  };

  // Handler: Close Details Panel
  const handleCloseDetails = () => {
    setSelectedRequest(null);
    setRequestDetails([]);
    setMifPreviewItems([]);
    setMrfPreviewItems([]);
    setMifFetchedNotes([]);
    setMifCurrentUserNotes([]);
    setMrfFetchedNotes([]);
    setMrfCurrentUserNotes([]);
    setHighlightMifNote(false);
    setHighlightMrfNote(false);
    setError(null);
    setMifPriority(false);
    setMrfPriority(false);
    setMrfPrioritySetBy(null);
    setShowMrfDetailsPanel(false);
    setMrfDetails([]);
    setIsMifApproved(false);
    setIsMrfApproved(false);
    setIsMrfPastApproved(false);
    setIsVendorModalOpen(false);
    setSelectedComponent(null);
  };

  // Handler: Change Issued Quantity and Update MRF Details
  const handleIssuedQtyChange = (value, key, isMrf = false) => {
    if (showPastIssued || (isMrf ? (isMrfApproved || isMrfPastApproved) : isMifApproved)) return;

    if (value === null || value === undefined) {
      console.warn(`Invalid value: ${value}. Value cannot be null or undefined.`);
      return;
    }

    const parsedValue = Number(value);
    if (isNaN(parsedValue) || parsedValue < 0) {
      console.warn(`Invalid value: ${value}. Must be a non-negative number.`);
      return;
    }

    let newValue = parsedValue;
    if (!isMrf) {
      const maxQty = requestDetails.find((item) => item.key === key)?.updatedQty || 0;
      newValue = Math.min(parsedValue, maxQty);

      const updatedItems = requestDetails.map((item) =>
        item.key === key
          ? { ...item, issuedQty: newValue, highlightRemark: false }
          : item
      );
      setRequestDetails(updatedItems);

      setMifPreviewItems((prev) => {
        const existingItem = prev.find((item) => item.key === key);
        const detailItem = updatedItems.find((item) => item.key === key);

        if (existingItem) {
          if (detailItem.issuedQty === detailItem.updatedQty) {
            return prev.filter((item) => item.key !== key);
          }
          return prev.map((item) =>
            item.key === key
              ? { ...item, issuedQty: newValue, remark: item.remark || "" }
              : item
          );
        } else if (detailItem && detailItem.updatedQty !== newValue) {
          return [
            ...prev,
            { ...detailItem, issuedQty: newValue, remark: detailItem.remark || "" },
          ];
        }
        return prev.filter((item) => item.key !== key);
      });

      if (showMrfDetailsPanel && mrfDetails.length > 0) {
        const mifItem = updatedItems.find((item) => item.key === key);
        if (mifItem) {
          const oldMifQty = requestDetails.find((item) => item.key === key)?.issuedQty || 0;
          const newMifQty = newValue;
          const quantityDelta = newMifQty - oldMifQty;

          const updatedMrfItems = mrfDetails.map((mrfItem) => {
            if (mrfItem.component_id === mifItem.component_id && mrfItem.mpn === mifItem.mpn) {
              const adjustedMrfQty = Math.max((mrfItem.updatedQty || 0) + quantityDelta, 0);
              return {
                ...mrfItem,
                updatedQty: adjustedMrfQty,
                totalQty: calculateTotalQty({ ...mrfItem, updatedQty: adjustedMrfQty }, updatedItems),
              };
            }
            return mrfItem;
          });

          setMrfDetails(updatedMrfItems);

          setMrfPreviewItems((prev) => {
            const updatedMrfItem = updatedMrfItems.find(
              (item) => item.component_id === mifItem.component_id && item.mpn === mifItem.mpn
            );
            if (!updatedMrfItem) return prev;

            const existingItem = prev.find((item) => item.key === updatedMrfItem.key);
            if (updatedMrfItem.updatedQty === updatedMrfItem.requestedQty) {
              return prev.filter((item) => item.key !== updatedMrfItem.key);
            }
            if (existingItem) {
              return prev.map((item) =>
                item.key === updatedMrfItem.key
                  ? { ...item, updatedQty: updatedMrfItem.updatedQty, remark: item.remark || "" }
                  : item
              );
            } else if (updatedMrfItem.requestedQty !== updatedMrfItem.updatedQty) {
              return [
                ...prev,
                { ...updatedMrfItem, updatedQty: updatedMrfItem.updatedQty, remark: updatedMrfItem.remark || "" },
              ];
            }
            return prev;
          });
        }
      }
    } else {
      newValue = parsedValue;
      const updatedItems = mrfDetails.map((item) =>
        item.key === key
          ? {
              ...item,
              updatedQty: newValue,
              totalQty: calculateTotalQty({ ...item, updatedQty: newValue }, requestDetails),
              highlightRemark: false,
            }
          : item
      );
      setMrfDetails(updatedItems);

      setMrfPreviewItems((prev) => {
        const existingItem = prev.find((item) => item.key === key);
        const detailItem = updatedItems.find((item) => item.key === key);
        let tempHistory = detailItem.quantity_change_history || [];

        if (detailItem.requestedQty !== newValue) {
          const newHistoryEntry = {
            timestamp: new Date().toISOString(),
            user_name: userName,
            role: userRole,
            old_quantity: detailItem.requestedQty,
            new_quantity: newValue,
          };
          tempHistory = [...tempHistory, newHistoryEntry];
        }

        if (existingItem) {
          if (detailItem.updatedQty === detailItem.requestedQty) {
            return prev.filter((item) => item.key !== key);
          }
          return prev.map((item) =>
            item.key === key
              ? { ...item, updatedQty: newValue, remark: item.remark || "", quantity_change_history: tempHistory }
              : item
          );
        } else if (detailItem && detailItem.requestedQty !== newValue) {
          return [
            ...prev,
            { ...detailItem, updatedQty: newValue, remark: detailItem.remark || "", quantity_change_history: tempHistory },
          ];
        }
        return prev.filter((item) => item.key !== key);
      });
    }
  };

const handleMrrChange = (mrr_no, quantity, key, action) => {
  if (
    showPastIssued ||
    isMifApproved ||
    selectedRequest.status !== "Inventory Approval Pending"
  )
    return;

  setRequestDetails((prevDetails) => {
    const updatedItems = prevDetails.map((item) => {
      if (item.key !== key) return item;

      let newSelectedMrrs = [...(item.selected_mrrs || [])];
      const mrrOption = item.mrr_options?.find(
        (opt) =>
          String(opt.mrr_no).trim().toLowerCase() ===
          String(mrr_no).trim().toLowerCase()
      );

      if (!mrrOption && action === "add") {
        console.warn(`MRR ${mrr_no} not found in mrr_options for key ${key}`);
        return item;
      }

      if (action === "add") {
        const existingMrr = newSelectedMrrs.find(
          (mrr) =>
            String(mrr.mrr_no).trim().toLowerCase() ===
            String(mrr_no).trim().toLowerCase()
        );
        if (existingMrr) {
          newSelectedMrrs = newSelectedMrrs.map((mrr) =>
            String(mrr.mrr_no).trim().toLowerCase() ===
            String(mrr_no).trim().toLowerCase()
              ? { ...mrr, quantity: Number(quantity) || 0 }
              : mrr
          );
        } else {
          newSelectedMrrs.push({
            mrr_no: mrr_no,
            quantity: Number(quantity) || 0,
          });
        }
      } else if (action === "remove") {
        newSelectedMrrs = newSelectedMrrs.filter(
          (mrr) =>
            String(mrr.mrr_no).trim().toLowerCase() !==
            String(mrr_no).trim().toLowerCase()
        );
      }

      const totalMrrQty = newSelectedMrrs.reduce(
        (sum, mrr) => sum + Number(mrr.quantity),
        0
      );
      if (totalMrrQty > item.issuedQty) {
        console.warn(
          `Total MRR quantity (${totalMrrQty}) exceeds issued quantity (${item.issuedQty}) for key ${key}`
        );
        return item;
      }

      return { ...item, selected_mrrs: newSelectedMrrs };
    });

    setMifPreviewItems((prev) => {
      const detailItem = updatedItems.find((item) => item.key === key);
      if (!detailItem) return prev;

      const existingPreview = prev.find((item) => item.key === key);
      if (existingPreview) {
        return prev.map((item) =>
          item.key === key
            ? { ...item, selected_mrrs: detailItem.selected_mrrs }
            : item
        );
      }
      return prev;
    });

    return updatedItems;
  });
};
  // Handler: Change Remark for MIF or MRF Items
  const handleRemarkChange = (value, key, isMrf = false) => {
    if (showPastIssued || (isMrf ? (isMrfApproved || isMrfPastApproved) : isMifApproved)) return;
    if (isMrf) {
      const updatedMrfDetails = mrfDetails.map((item) =>
        item.key === key ? { ...item, remark: value, highlightRemark: false } : item
      );
      setMrfDetails(updatedMrfDetails);
      setMrfPreviewItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, remark: value } : item))
      );
    } else {
      const updatedRequestDetails = requestDetails.map((item) =>
        item.key === key ? { ...item, remark: value, highlightRemark: false } : item
      );
      setRequestDetails(updatedRequestDetails);
      setMifPreviewItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, remark: value } : item))
      );
    }
  };

 const handleViewMrfDetails = async () => {
    if (
      !selectedRequest ||
      !selectedRequest.mrf_no ||
      !selectedRequest.mrf_no.startsWith("MRF")
    ) {
      setError("No valid MRF number available.");
      setShowMrfDetailsPanel(true);
      return;
    }
    setLoading(true);
    setError(null);
    setShowMrfDetailsPanel(true);
    try {
      const details = await fetchMrfRequestDetails(
        selectedRequest.mrf_no,
        showPastIssued
      );
      if (!details || details.length === 0) {
        setError(`No MRF details found for MRF_NO: ${selectedRequest.mrf_no}`);
        setMrfDetails([]);
        setMrfPriority(details[0]?.priority || false);
        setMrfPrioritySetBy(details[0]?.prioritySetBy || null);
        setIsMrfPastApproved(false);
        return;
      }
      const validDetails = details.filter(
        (item) => item.mrf_id && item.component_id
      );
      if (validDetails.length === 0) {
        setError("No valid MRF items found with required fields.");
        setMrfDetails([]);
        setIsMrfPastApproved(false);
        return;
      }
      const mifDetails = requestDetails;
      const mappedDetails = validDetails.map((item, index) => {
        const quantityChangeHistory = Array.isArray(item.quantity_change_history)
          ? item.quantity_change_history.map((change) => ({
              ...change,
              user_name:
                change.user_name || change.userName || change.username || "Unknown",
            }))
          : [];
        const updatedQty = Number(item.updated_requested_quantity || 0); // Calculate updatedQty
        return {
          key: index + 1,
          mrf_no: item.mrf_no,
          project_name: item.project_name || "N/A",
          user_department: item.user_department || "N/A",
          user_name: item.name || "N/A",
          status: item.status || "N/A",
          description: item.item_description || "N/A",
          mpn: item.mpn || "N/A",
          part_no: item.part_no || "N/A",
          make: item.make || "N/A",
          uom: item.uom|| "N/A",
          onHandQty: item.on_hand_quantity || 0,
          updatedQty: item.updated_requested_quantity || 0,
          requestedQty: item.updated_requested_quantity || 0,
          initialQty: Number(item.initial_requested_quantity || 0),
          remark: item.remark || "",
          highlightRemark: false,
          totalQty: calculateTotalQty(item, mifDetails),
          mrf_id: item.mrf_id,
          component_id: item.component_id,
          quantity_change_history: quantityChangeHistory,
          vendorDetails: {
            vendorName: item.vendor || "",
            vendor_link: item.vendor_link || "",
            approxPrice: item.approx_price || "",
            expected_deliverydate: item.expected_deliverydate || "",
            certificate_desired: item.certificate_desired || false,
          },
        };
      });
      setMrfDetails(mappedDetails);
  
      const fetchedMrfNotes = details[0]?.note;
      if (typeof fetchedMrfNotes === "string" && fetchedMrfNotes) {
        setMrfFetchedNotes([
          {
            timestamp: new Date().toISOString(),
            user_name: "Unknown",
            role: "Unknown",
            content: fetchedMrfNotes,
          },
        ]);
        setMrfCurrentUserNotes([]);
      } else {
        const normalizedNotes = Array.isArray(fetchedMrfNotes)
          ? fetchedMrfNotes.map((note) => ({
              ...note,
              user_name: note.user_name || note.userName || note.username || "Unknown",
            }))
          : [];
        setMrfFetchedNotes(normalizedNotes);
        setMrfCurrentUserNotes([]);
      }
  
      setMrfPriority(details[0]?.priority || false);
      setMrfPrioritySetBy(details[0]?.prioritySetBy || null);
      setIsMrfPastApproved(details[0]?.status !== "Inventory Approval Pending");
    } catch (error) {
      console.error("Fetch MRF details error:", error);
      setError(
        "Failed to fetch MRF details: " + (error.message || "Unknown error")
      );
      setMrfDetails([]);
      setMrfPriority(false);
      setMrfPrioritySetBy(null);
      setIsMrfPastApproved(false);
      setIsVendorModalOpen(false);
      setSelectedComponent(null);
    } finally {
      setLoading(false);
    }
  };

 const handleCloseMrfDetails = () => {
    setShowMrfDetailsPanel(false);
    setMrfDetails([]);
    setMrfPreviewItems([]);
    setMrfFetchedNotes([]);
    setMrfCurrentUserNotes([]);
    setHighlightMrfNote(false);
    setError(null);
    setIsMrfPastApproved(false);
    setIsVendorModalOpen(false);
    setSelectedComponent(null);
  };

  // NEW: Function to open the VendorDetailsModal
 const handleOpenVendorModal = (component) => {
  setSelectedComponent(component);
  setIsVendorModalOpen(true);
};

// NEW: Function to close the VendorDetailsModal
const handleCloseVendorModal = () => {
  setIsVendorModalOpen(false);
  setSelectedComponent(null);
};

const handleSaveVendorDetails = async (basketId, vendorDetails) => {
  try {
    // Update the requestDetails state
    const updatedMrfDetails = mrfDetails.map((item) =>
      item.basket_id === basketId
        ? {
            ...item,
            vendorDetails: {
              vendorName: vendorDetails.vendorName,
              vendor_link: vendorDetails.vendor_link,
              approxPrice: vendorDetails.approxPrice,
              expected_deliverydate: vendorDetails.expected_deliverydate,
              certificate_desired: vendorDetails.certificate_desired,
            },
            vendor: vendorDetails.vendorName,
            vendor_link: vendorDetails.vendor_link,
            approx_price: vendorDetails.approxPrice,
            expected_deliverydate: vendorDetails.expected_deliverydate,
            certificate_desired: vendorDetails.certificate_desired,
          }
        : item
    );
    setRequestDetails(updatedMrfDetails);

    // Call API to update vendor details in the material_request_form table
    const mrfItem = updatedMrfDetails.find((item) => item.basket_id === basketId);
    if (mrfItem && mrfItem.mrf_id && mrfItem.component_id) {
      await updateVendorDetails(mrfItem.mrf_id, mrfItem.component_id, {
        vendor: vendorDetails.vendorName,
        vendor_link: vendorDetails.vendor_link,
        approx_price: vendorDetails.approxPrice,
        expected_deliverydate: vendorDetails.expected_deliverydate,
        certificate_desired: vendorDetails.certificate_desired,
      });
      alert("Vendor details updated successfully!");
    } else {
      throw new Error("Invalid MRF item data. Missing mrf_id or component_id.");
    }
  } catch (error) {
    console.error("Error saving vendor details:", error);
    alert("Failed to save vendor details: " + error.message);
  }
};


const handlemrfApprove = async () => {
    if (!selectedRequest || !isHead) {
      alert("No request selected or insufficient permissions.");
      return;
    }
    const missingRemarkItems = mrfPreviewItems.filter(
      (item) => !item.remark.trim() && item.updatedQty !== item.initialQty
    );
    if (missingRemarkItems.length > 0) {
      const item = missingRemarkItems[0];
      const identifier = item.mpn !== "N/A" ? item.mpn : item.description;
      alert(
        `Remark is mandatory for "${identifier}" in MRF. Please provide a reason for the quantity change.`
      );

      const updatedItems = mrfDetails.map((item) =>
        missingRemarkItems.some((missingItem) => missingItem.key === item.key)
          ? { ...item, highlightRemark: true }
          : item
      );
      setMrfDetails(updatedItems);
      return;
    }
    try {
      const updatedItems = mrfDetails
        .filter((item) => item.mrf_id && item.component_id)
        .map((item) => ({
          mrf_id: item.mrf_id,
          component_id: item.component_id,
          updated_requested_quantity: item.updatedQty,
          remark: item.remark,
        }));
      if (updatedItems.length === 0) {
        alert(
          "No valid items to approve. Please ensure MRF details are populated correctly."
        );
        return;
      }

      await approveMrfRequest(selectedRequest.mrf_no, {
        updatedItems,
        note: mrfCurrentUserNotes,
        priority: mrfPriority,
        prioritySetBy: mrfPriority ? userName : null,
      });
      alert("MRF Request approved successfully!");

      setShowMrfDetailsPanel(false);
      setMrfDetails([]);
      setMrfPreviewItems([]);
      setMrfFetchedNotes([]);
      setMrfCurrentUserNotes([]);
      setHighlightMrfNote(false);
      setIsMrfApproved(true);
      setIsMrfPastApproved(true);
      setIsVendorModalOpen(false);
      setSelectedComponent(null);
    } catch (error) {
      console.error("MRF Approval error:", error.response?.data || error);
      alert(
        `Failed to approve MRF request for MRF_NO: ${selectedRequest.mrf_no}. ${
          error.response?.data?.message || "Please try again."
        }`
      );
    }
  };

  const handlemrfReject = async () => {
    if (!selectedRequest || !isHead || isMrfApproved || isMrfPastApproved) return;

    const allMrfNotes = [...mrfFetchedNotes, ...mrfCurrentUserNotes];
    if (allMrfNotes.length === 0) {
      setHighlightMrfNote(true);
      alert("A note is required to reject the request. Please add a note.");
      return;
    }

    try {
      await rejectMrfRequest(selectedRequest.mrf_no, {
        note: mrfCurrentUserNotes,
        // reason: "Rejected by user",
      });

      alert("MRF Request rejected successfully!");
      setSelectedRequest(null);
      setRequestDetails([]);
      setMifPreviewItems([]);
      setMrfPreviewItems([]);
      setMifFetchedNotes([]);
      setMifCurrentUserNotes([]);
      setMrfFetchedNotes([]);
      setMrfCurrentUserNotes([]);
      setHighlightMifNote(false);
      setHighlightMrfNote(false);
      setShowMrfDetailsPanel(false);
      setMrfDetails([]);
      setIsVendorModalOpen(false);
      setSelectedComponent(null);
    } catch (error) {
      console.error("MRF Reject error:", error.response?.data || error);
      alert(
        "Failed to reject MRF request: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

  // Handler: Confirm Receipt of Material
  const handleConfirmReceipt = async (umi) => {
    try {
      const response = await confirmReceipt(umi);
      alert(response.message);
      const data = await fetchPendingNonCOCIssueRequests();
      const mappedRequests = data
        .map((req, index) => ({
          key: index + 1,
          reference: `${req.umi}`,
          requestedBy: req.user_name,
          date: req.date,
          status: req.status,
          umi: req.umi,
          project_name: req.project_name || "N/A",
          userId: req.user_id,
          priority: req.priority || false,
          mrf_no: req.mrf_no || "No MRF",
        }))
        .sort((a, b) => DateTime.fromISO(b.date) - DateTime.fromISO(a.date));
      setRequests(mappedRequests);
      setFilteredRequests(mappedRequests);
    } catch (error) {
      setError(error.response?.data?.message || "Failed to confirm receipt.");
    }
  };

  // Handler: Toggle Priority for MIF or MRF
  const togglePriority = (isMrf = false) => {
    if (!showPastIssued && !(isMrf ? (isMrfApproved || isMrfPastApproved) : isMifApproved)) {
      if (isMrf) {
        if (mrfPriority && mrfPrioritySetBy !== userName) {
          alert("Priority can only be changed by the user who set it to high.");
          return;
        }
        const newPriority = !mrfPriority;
        setMrfPriority(newPriority);
        setMrfPrioritySetBy(newPriority ? userName : null);
      } else {
        setMifPriority((prev) => !prev);
      }
    }
  };

  // Handler: Confirm MRF Approval/Rejection
  const confirmMrfApprove = () => setIsMrfApproveModalOpen(true);
  const confirmMrfReject = () => setIsMrfRejectModalOpen(true);

  // Table Columns for Pending Requests
  const columns = [
    { title: "UMI No.", dataIndex: "reference", key: "reference" },
    { title: "MRF No.", dataIndex: "mrf_no", key: "mrf_no" },
    { title: "Date", dataIndex: "date", key: "date", render: formatDate },
    { title: "Project Name", dataIndex: "project_name", key: "project_name" },
    { title: "Requested By", dataIndex: "requestedBy", key: "requestedBy" },
    { title: "Status", dataIndex: "status", key: "status" },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (_, record) => (
        <button
          onClick={() => togglePriority(false)}
          className={`p-2 rounded-full ${record.priority ? "bg-red-500" : "bg-green-500"}`}
          disabled={showPastIssued}
        >
          <FlagIcon className="h-4 w-4 text-white" />
        </button>
      ),
    },
  ];

  // Table Columns for Past Issued Requests
  const pastIssuedColumns = [
    { title: "UMI No.", dataIndex: "reference", key: "reference" },
    { title: "MRF No.", dataIndex: "mrf_no", key: "mrf_no" },
    { title: "MI No.", dataIndex: "mi", key: "mi" },
   { 
    title: "Issued Date", 
    dataIndex: "issuedDate", 
    key: "issuedDate", 
    render: (date) => formatDate(date) // Apply formatDate function
  },
    { title: "Requested By", dataIndex: "requestedBy", key: "requestedBy" },
    { title: "Status", dataIndex: "status", key: "status" },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (_, record) => (
        <button
          className={`p-2 rounded-full ${record.priority ? "bg-red-500" : "bg-green-500"}`}
          disabled
        >
          <FlagIcon className="h-4 w-4 text-white" />
        </button>
      ),
    },
  ];

  // MIF Table Conditions
  const hasMifQuantityChange = requestDetails.some((item) => item.issuedQty !== item.updatedQty);
  const hasMifRemark = requestDetails.some(
    (item) => item.mif_remark && item.mif_remark.trim() && item.mif_remark !== "N/A"
  );
  const hasHeadRemark = requestDetails.some(
    (item) => item.head_remark && item.head_remark.trim() && item.head_remark.trim() !== "N/A"
  );

  // MIF Detail Table Columns
  const baseDetailColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    { title: "Part No", dataIndex: "part_no", key: "part_no" },
    { title: "Make", dataIndex: "make", key: "make" },
    { title: "UoM", dataIndex: "uom", key: "uom" },
    { title: "On Hand Qty", dataIndex: "onHandQty", key: "onHandQty" },
    { title: "Location", dataIndex: "location", key: "location" },
    { title: "Initial Requested Qty", dataIndex: "initialQty", key: "initialQty" },
    { title: "Updated Requested Qty", dataIndex: "updatedQty", key: "updatedQty" },
{
    title: "MRR No",
    dataIndex: "selected_mrrs",
    key: "selected_mrrs",
    render: (_, record) => {
      if (
        showPastIssued ||
        isMifApproved ||
        selectedRequest.status !== "Inventory Approval Pending"
      ) {
        return (
          <div className="space-y-2">
            {record.selected_mrrs && record.selected_mrrs.length > 0 ? (
              record.selected_mrrs.map((mrr, index) => (
                <div key={index}>
                  {mrr.mrr_no} (Qty: {mrr.quantity})
                </div>
              ))
            ) : (
              <span>N/A</span>
            )}
          </div>
        );
      }

      const totalMrrQty =
        record.selected_mrrs?.reduce(
          (sum, mrr) => sum + Number(mrr.quantity),
          0
        ) || 0;
      const maxAllocatableQty = record.issuedQty - totalMrrQty;

      return (
        <div className="space-y-2">
          {record.selected_mrrs?.map((mrr, index) => (
            <div key={index} className="flex items-center gap-2">
              <span>{mrr.mrr_no} (Qty: {mrr.quantity})</span>
              <Button
                type="link"
                onClick={() =>
                  handleMrrChange(mrr.mrr_no, 0, record.key, "remove")
                }
                className="text-red-500"
              >
                Remove
              </Button>
            </div>
          ))}
          {maxAllocatableQty > 0 && record.mrr_options?.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                placeholder="Select MRR"
                style={{ width: 150 }}
                onChange={(mrr_no) => {
                  const option = record.mrr_options.find(
                    (opt) => opt.mrr_no === mrr_no
                  );
                  if (option) {
                    handleMrrChange(
                      mrr_no,
                      Math.min(
                        option.material_in_quantity,
                        maxAllocatableQty
                      ),
                      record.key,
                      "add"
                    );
                  }
                }}
              >
                {record.mrr_options
                  .filter(
                    (opt) =>
                      !record.selected_mrrs?.some(
                        (mrr) =>
                          String(mrr.mrr_no)
                            .trim()
                            .toLowerCase() ===
                          String(opt.mrr_no)
                            .trim()
                            .toLowerCase()
                      )
                  )
                  .map((opt) => (
                    <Select.Option key={opt.mrr_no} value={opt.mrr_no}>
                      {opt.mrr_no} ({opt.material_in_quantity} available)
                    </Select.Option>
                  ))}
              </Select>
              <InputNumber
                min={0}
                max={maxAllocatableQty}
                defaultValue={1}
                onChange={(quantity) => {
                  const selectedMrr = record.selected_mrrs?.[record.selected_mrrs.length - 1];
                  if (selectedMrr) {
                    handleMrrChange(
                      selectedMrr.mrr_no,
                      quantity,
                      record.key,
                      "add"
                    );
                  }
                }}
                style={{ width: 80 }}
              />
            </div>
          )}
          {(!record.mrr_options || record.mrr_options.length === 0) && (
            <span className="text-red-500">No MRR options available</span>
          )}
        </div>
      );
    },
  },
    {
      title: "Issued Qty",
      dataIndex: "issuedQty",
      key: "issuedQty",
      render: (_, record) => {
        const isEmpty = record.issuedQty == null || record.issuedQty === undefined;
        return (
          <div className="relative">
            <InputNumber
              min={0}
              value={record.issuedQty}
              onChange={(value) => handleIssuedQtyChange(value, record.key)}
              className={`w-full ${isEmpty ? "border-red-500 border-2 rounded" : "border-gray-300"}`}
              disabled={
                showPastIssued ||
                isMifApproved ||
                selectedRequest.status !== "Inventory Approval Pending"
              }
            />
            {isEmpty && (
              <span className="text-red-500 text-xs mt-1 block">Required*</span>
            )}
          </div>
        );
      },
    },
  ];

  const headRemarkColumn = {
    title: "Head's Remark",
    dataIndex: "head_remark",
    key: "head_remark",
    render: (text) => <span>{text || "-"}</span>,
  };

  const inventoryRemarkColumn = {
    title: "Inventory Remark",
    dataIndex: "mif_remark",
    key: "mif_remark",
    render: (_, record) => {
      const hasQuantityDifference = record.issuedQty !== record.updatedQty;
      if (isHead && !showPastIssued && !isMifApproved && hasQuantityDifference) {
        return (
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="Add your remark..."
                value={record.remark}
                onChange={(e) => handleRemarkChange(e.target.value, record.key)}
                className="w-full h-12 text-lg"
                style={record.highlightRemark ? { borderColor: "#f5222d", boxShadow: "none" } : {}}
                disabled={
                  showPastIssued ||
                  isMifApproved ||
                  selectedRequest.status !== "Inventory Approval Pending"
                }
              />
              {!record.remark && (
                <span className="text-red-500 text-xs mt-1 block">Required*</span>
              )}
            </div>
          </div>
        );
      }
      return (
        <span className="leading-[48px] text-md" style={{ whiteSpace: "pre-line" }}>
          {record.mif_remark && record.mif_remark !== "N/A" ? record.mif_remark : "-"}
        </span>
      );
    },
  };

  const detailColumns = [
    ...baseDetailColumns,
    ...(hasHeadRemark ? [headRemarkColumn] : []),
    ...((isHead && !showPastIssued && hasMifQuantityChange) || hasMifRemark ? [inventoryRemarkColumn] : []),
  ];

  // MRF Detail Table Columns
  const baseMrfDetailColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    { title: "Part No", dataIndex: "part_no", key: "part_no", render: (text) => text || "-" },
    { title: "Make", dataIndex: "make", key: "make", render: (text) => text || "-" },
     { title: "UoM", dataIndex: "uom", key: "uom" },
    { title: "On Hand Qty", dataIndex: "onHandQty", key: "onHandQty" },
    { title: "Initial Requested Qty", dataIndex: "initialQty", key: "initialQty" },
    {
  title: "Vendor Details",
  key: "vendorDetails",
  render: (_, record) =>
    isHead ? (
      record.vendorDetails?.vendorName ||
      record.vendorDetails?.vendor_link ||
      record.vendorDetails?.approxPrice ||
      record.vendorDetails?.expected_deliverydate ||
      record.vendorDetails?.certificate_desired ? (
        <Button
          type="primary"
          onClick={() => handleOpenVendorModal(record)}
        >
          View Vendor Details
        </Button>
      ) : (
        <Button
          type="primary"
          onClick={() => handleOpenVendorModal(record)}
          className="border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
        >
          Add Vendor Details
        </Button>
      )
    ) : record.vendorDetails?.vendorName ||
     // record.vendorDetails?.vendor_link ||
      record.vendorDetails?.approxPrice ||
      record.vendorDetails?.expected_deliverydate ||
      record.vendorDetails?.certificate_desired ? (
      <Button
        type="primary"
        onClick={() => handleOpenVendorModal(record)}
      >
        View Vendor Details
      </Button>
    ) : (
      <span>-</span>
    ),
},
    {
      title: "Updated Requested Qty",
      dataIndex: "updatedQty",
      key: "updatedQty",
      render: (_, record) => {
        const isEmpty = record.updatedQty == null || record.updatedQty === undefined;
        return (
          <div className="relative">
            <InputNumber
              min={0}
              value={record.updatedQty}
              onChange={(value) => handleIssuedQtyChange(value, record.key, true)}
              className={`w-full ${isEmpty ? "border-red-500 border-2 rounded" : "border-gray-300"}`}
              disabled={showPastIssued || isMrfApproved || isMrfPastApproved}
            />
            {isEmpty && (
              <span className="text-red-500 text-xs mt-1 block">Required*</span>
            )}
          </div>
        );
      },
    },
    {
      title: "Total Qty",
      dataIndex: "totalQty",
      key: "totalQty",
      render: (text) => <span className="leading-[48px] text-md">{text}</span>,
    },
  ];

  const quantityChangeHistoryColumn = {
    title: "Quantity Change History",
    dataIndex: "quantity_change_history",
    key: "quantity_change_history",
    render: (history) => {
      if (!history || history.length === 0) return "No changes.";
      return (
        <div className="leading-tight">
          {history.map((change, index) => {
            const displayUserName = change.user_name || change.userName || change.username || "Unknown";
            return (
              <div key={index}>
                {DateTime.fromISO(change.timestamp).toFormat("dd-MM-yy HH:mm")}, {displayUserName}: {change.old_quantity} → {change.new_quantity}.
              </div>
            );
          })}
        </div>
      );
    },
  };

  const hasMrfRemark = mrfDetails.some((item) => item.remark && item.remark.trim());
  const hasQuantityChangeHistory = mrfDetails.some(
    (item) => item.quantity_change_history && item.quantity_change_history.length > 0
  );
  const hasMrfQuantityChange = mrfDetails.some((item) => item.updatedQty !== item.requestedQty);

  const mrfRemarkColumn = {
    title: "Remark",
    dataIndex: "remark",
    key: "remark",
    render: (_, record) => {
      const hasItemQuantityChange = record.quantity_change_history && record.quantity_change_history.length > 0;
      const hasQuantityDifference = record.updatedQty !== record.requestedQty;
      if (isHead && !showPastIssued && !(isMrfApproved || isMrfPastApproved) && hasQuantityDifference) {
        return (
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="Add your remark..."
                value={record.remark}
                onChange={(e) => handleRemarkChange(e.target.value, record.key, true)}
                className="w-full h-12 text-lg"
                style={record.highlightRemark ? { borderColor: "#f5222d", boxShadow: "none" } : {}}
              />
              {!record.remark && (
                <span className="text-red-500 text-xs mt-1 block">Required*</span>
              )}
            </div>
          </div>
        );
      } else if ((showPastIssued || isMrfPastApproved) && (hasItemQuantityChange || record.remark)) {
        return (
          <span className="leading-[48px] text-md" style={{ whiteSpace: "pre-line" }}>
            {record.remark || "-"}
          </span>
        );
      }
      return (
        <span className="leading-[48px] text-md" style={{ whiteSpace: "pre-line" }}>
          {record.remark || "-"}
        </span>
      );
    },
  };

  const mrfDetailColumns = [
    ...baseMrfDetailColumns,
    ...(hasQuantityChangeHistory ? [quantityChangeHistoryColumn] : []),
    ...((isHead && !showPastIssued && hasMrfQuantityChange) || hasMrfRemark ? [mrfRemarkColumn] : []),
  ];

  // Preview Table Columns for MIF and MRF
  const getPreviewColumns = (isMif = false) => {
    const remarkColumn = {
      title: "Remark",
      dataIndex: "remark",
      key: "remark",
      render: (text) => (
        <span className="leading-tight" style={{ whiteSpace: "pre-line" }}>
          {text || "-"}
        </span>
      ),
    };

    if (!isMif) {
      return [
        { title: "S.No", dataIndex: "key", key: "key" },
        { title: "Description", dataIndex: "description", key: "description" },
        { title: "Requested Qty", dataIndex: "updatedQty", key: "updatedQty" },
        {
          title: "Quantity Change History",
          dataIndex: "quantity_change_history",
          key: "quantity_change_history",
          render: (history) => {
            if (!history || history.length === 0) return "No changes.";
            return (
              <div className="leading-tight">
                {history.map((change, index) => {
                  const displayUserName = change.user_name || change.userName || change.username || "Unknown";
                  return (
                    <div key={index}>
                      {DateTime.fromISO(change.timestamp).toFormat("dd-MM-yy HH:mm")}, {displayUserName}: {change.old_quantity} → {change.new_quantity}.
                    </div>
                  );
                })}
              </div>
            );
          },
        },
        remarkColumn,
      ];
    } else {
      return [
        { title: "S.No", dataIndex: "key", key: "key" },
        { title: "Description", dataIndex: "description", key: "description" },
        { title: "Issued Qty", dataIndex: "issuedQty", key: "issuedQty" },
        {
          title: "MRR Allocations",
          dataIndex: "selected_mrrs",
          key: "selected_mrrs",
          render: (mrrs) => (
            <div>
              {mrrs && mrrs.length > 0 ? (
                mrrs.map((mrr, index) => (
                  <div key={index}>
                    {mrr.mrr_no}: {mrr.quantity}
                  </div>
                ))
              ) : (
                "-"
              )}
            </div>
          ),
        },
        remarkColumn,
      ];
    }
  };

  // Render UI
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-12 mt-8 bg-gradient-to-br from-blue-50 to-gray-100 min-h-screen"
    >
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          className="mb-4"
        />
      )}
      <div
        className={`flex transition-all duration-500 h-[calc(100vh-4rem)] gap-2 ${
          isMifApproveModalOpen || isMifRejectModalOpen || isMrfApproveModalOpen || isMrfRejectModalOpen
            ? "backdrop-blur-sm"
            : ""
        }`}
      >
        <AnimatePresence>
          {!selectedRequest && (
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-lg shadow-md p-2 overflow-y-auto w-full"
            >
              <div className="flex justify-between mb-4">
                <h2 className="text-3xl font-bold text-gray-800 border-b-2 border-blue-300 pb-2">
                  {showPastIssued ? "Past Issued Requests" : "Pending Issue Requests"}
                </h2>
                <div className="flex items-center gap-4 relative">
                  <Button
                    onClick={() => setSearchVisible(!searchVisible)}
                    icon={<MagnifyingGlassIcon className="h-6 w-6" />}
                  />
                  <AnimatePresence>
                    {searchVisible && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 256, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Input
                          placeholder="Search..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-48 rounded-lg"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Button
                    type="primary"
                    onClick={
                      showPastIssued
                        ? () => {
                            setShowPastIssued(false);
                            handleCloseDetails();
                          }
                        : handleFetchPastIssued
                    }
                  >
                    {showPastIssued ? "View Pending" : "View Past Issued"}
                  </Button>
                </div>
              </div>
              {loading && <p>Loading...</p>}
              <Table
                dataSource={showPastIssued ? filteredPastIssuedRequests : filteredRequests}
                columns={showPastIssued ? pastIssuedColumns : columns}
                rowKey="key"
                onRow={(record) => ({
                  onClick: () => handleSelectRequest(record),
                })}
                rowClassName="cursor-pointer hover:bg-gray-50"
                pagination={{ pageSize: 10 }}
              />
            </motion.div>
          )}
          {selectedRequest && (
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`bg-white rounded-lg shadow-md p-6 overflow-y-auto overflow-x-auto relative ${
                showMrfDetailsPanel ? "w-1/2" : "w-full"
              } mr-2`}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleCloseDetails}
                className="absolute top-4 right-4 text-gray-600 hover:text-red-600 transition-colors"
              >
                <XCircleIcon className="h-8 w-8" />
              </motion.button>
              <h2 className="text-3xl font-bold text-gray-800 border-b-2 border-blue-300 pb-2">
                Material Issue Form
              </h2>
                            {selectedRequest.mrf_no && selectedRequest.mrf_no !== "No MRF" && (
                <div className="overflow-hidden w-full mt-2 mb-4">
                  <div
                    className="text-red-600 text-sm whitespace-nowrap animate-marquee"
                    style={{
                      display: "inline-block",
                      paddingLeft: "100%",
                      animation: "marquee 15s linear infinite",
                    }}
                  >
                    MRF Details are attached, kindly view it using the View MRF Button
                  </div>
                  <style>
                    {`
                      @keyframes marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-100%); }
                      }
                    `}
                  </style>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <p className="text-md text-gray-800">
                  <strong>UMI No.:</strong> {selectedRequest.reference}
                </p>
                <p className="text-md text-gray-800">
                  <strong>MRF No.:</strong> {selectedRequest.mrf_no}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Project Name:</strong> {selectedRequest.project_name}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Department:</strong> {selectedRequest.user_department || "N/A"}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Requested By:</strong> {selectedRequest.requestedBy}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Status:</strong> {selectedRequest.status || "N/A"}
                </p>
              </div>
              <Table
                 dataSource={requestDetails.filter(item => item.initialQty > 0) .map((item, index) => ({
                  ...item,
                  key: index + 1,
                }))
               } // Filter for display only
                columns={detailColumns}
                rowKey="key"
                className="w-full table-fixed rounded-lg"
                rowClassName="hover:bg-blue-50 transition-colors duration-200"
                pagination={false}
              />
              {selectedRequest.mrf_no && selectedRequest.mrf_no !== "No MRF" && (
                              <div className="mt-4">
                                <Button
                                  onClick={handleViewMrfDetails}
                                  variant="ghost"
                                  className="!bg-yellow-500 !text-white hover:bg-teal-600 rounded-lg font-semibold"
                                >
                                  View MRF Details
                                </Button>
                              </div>
                            )}
              {mifPreviewItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 p-4 bg-blue-50 rounded-lg"
                >
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">MIF Preview Changes</h3>
                  <Table
                    dataSource={mifPreviewItems}
                    columns={getPreviewColumns(true)}
                    rowKey="key"
                    className="w-full table-fixed rounded-lg overflow-auto"
                    pagination={false}
                  />
                </motion.div>
              )}
              <NotesSection
                fetchedNotes={mifFetchedNotes}
                currentUserNotes={mifCurrentUserNotes}
                setCurrentUserNotes={setMifCurrentUserNotes}
                currentUser={userName}
                userRole={userRole}
                readOnly={showPastIssued || isMifApproved}
                highlightNote={highlightMifNote}
                setHighlightNote={setHighlightMifNote}
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.6 }}
                className="flex justify-end gap-4 mt-6"
              >
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="primary"
                  className={`p-2 rounded-full ${mifPriority ? "bg-red-500" : "bg-green-500"}`}
                  disabled={showPastIssued || isMifApproved}
                  style={{ cursor: showPastIssued || isMifApproved ? "default" : "pointer" }}
                >
                  <FlagIcon className="h-4 w-4 text-white" />
                </motion.button>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => setIsMifApproveModalOpen(true)}
                    className="custom-approve px-4 py-2 rounded-md"
                    disabled={
                      showPastIssued ||
                      isMifApproved ||
                      selectedRequest.status !== "Inventory Approval Pending"
                    }
                  >
                    Approve
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => setIsMifRejectModalOpen(true)}
                    className="custom-reject px-4 py-2 rounded-md"
                    disabled={
                      showPastIssued ||
                      isMifApproved ||
                      selectedRequest.status !== "Inventory Approval Pending"
                    }
                  >
                    Reject
                  </Button>
                </motion.div>
              </motion.div>
              <ConfirmationModal
                isOpen={isMifApproveModalOpen}
                onClose={() => setIsMifApproveModalOpen(false)}
                onConfirm={() => {
                  handleApprove();
                  setIsMifApproveModalOpen(false);
                }}
                title="Confirm MIF Approval"
                content={
                  selectedRequest.mrf_no !== "No MRF" ? (
                    <div>
                      Are you sure you want to approve this MIF request?
                      <p className="text-red-500 mt-2">
                       The MRF form is attached for your consideration, kindly approve or reject as necessary.</p>
                    </div>
                  ) : (
                    "Are you sure you want to approve this MIF request?"
                  )
                }
                okText="Yes"
                cancelText="No"
              />
              <ConfirmationModal
                isOpen={isMifRejectModalOpen}
                onClose={() => {
                  setIsMifRejectModalOpen(false);
                  setHighlightMifNote(false);
                }}
                onConfirm={() => {
                  handleReject();
                  setIsMifRejectModalOpen(false);
                }}
                title="Confirm MIF Rejection"
                content={
                  selectedRequest.mrf_no !== "No MRF" ? (
                    <div>
                      Are you sure you want to reject this MIF request?
                      <p className="text-red-500 mt-2">Kindly approve the attached MRF, ignore if approved.</p>
                    </div>
                  ) : (
                    "Are you sure you want to reject this MIF request?"
                  )
                }
                okText="Yes"
                cancelText="No"
              />
            </motion.div>
          )}
          {showMrfDetailsPanel && (
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl shadow-xl p-6 overflow-y-auto overflow-x-auto relative w-1/2"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleCloseMrfDetails}
                className="absolute top-4 right-4 text-gray-600 hover:text-red-600 transition-colors"
              >
                <XCircleIcon className="h-8 w-8" />
              </motion.button>
              <motion.h2
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-3xl font-bold text-gray-800 border-b-2 border-blue-300 pb-2"
              >
                Material Request Form
              </motion.h2>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="grid grid-cols-2 gap-4 mb-4"
              >
                <p className="text-md text-gray-800">
                  <strong>MRF No.:</strong> {mrfDetails[0]?.mrf_no || "N/A"}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Project Name:</strong> {mrfDetails[0]?.project_name || "N/A"}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Department:</strong> {mrfDetails[0]?.user_department || "N/A"}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Requested By:</strong> {mrfDetails[0]?.user_name || "N/A"}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Status:</strong> {mrfDetails[0]?.status || "N/A"}
                </p>
              </motion.div>
              <Table
                dataSource={mrfDetails}
                columns={mrfDetailColumns}
                rowKey="key"
                className="w-full table-fixed rounded-lg"
                rowClassName="hover:bg-blue-50 transition-colors duration-200"
                pagination={false}
              />
              {mrfPreviewItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 p-4 bg-blue-50 rounded-lg"
                >
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">MRF Preview Changes</h3>
                  <Table
                    dataSource={mrfPreviewItems}
                    columns={getPreviewColumns(false)}
                    rowKey="key"
                    className="w-full table-fixed rounded-lg"
                    pagination={false}
                  />
                </motion.div>
              )}
              <NotesSection
                fetchedNotes={mrfFetchedNotes}
                currentUserNotes={mrfCurrentUserNotes}
                setCurrentUserNotes={setMrfCurrentUserNotes}
                currentUser={userName}
                userRole={userRole}
                readOnly={showPastIssued || isMrfApproved || isMrfPastApproved}
                highlightNote={highlightMrfNote}
                setHighlightNote={setHighlightMrfNote}
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.6 }}
                className="flex justify-end gap-4 mt-6"
              >
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="primary"
                  onClick={() => togglePriority(true)}
                  className={`p-2 rounded-full ${mrfPriority ? "bg-red-500" : "bg-green-500"}`}
                  disabled={showPastIssued || isMrfApproved || isMrfPastApproved}
                  style={{ cursor: (showPastIssued || isMrfApproved || isMrfPastApproved) ? "default" : "pointer" }}
                >
                  <FlagIcon className="h-4 w-4 text-white" />
                </motion.button>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    type="primary"
                    onClick={confirmMrfApprove}
                    className="custom-approve px-4 py-2 rounded-lg"
                    disabled={showPastIssued || isMrfApproved || isMrfPastApproved}
                  >
                    Approve
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    type="default"
                    onClick={confirmMrfReject}
                    className="custom-reject px-4 py-2 rounded-md"
                    disabled={showPastIssued || isMrfApproved || isMrfPastApproved}
                  >
                    Reject
                  </Button>
                </motion.div>
              </motion.div>
              <ConfirmationModal
                isOpen={isMrfApproveModalOpen}
                onClose={() => setIsMrfApproveModalOpen(false)}
                onConfirm={() => {
                  handlemrfApprove();
                  setIsMrfApproveModalOpen(false);
                }}
                title="Confirm MRF Approval"
                content="Are you sure you want to approve this MRF request?"
                okText="Yes"
                cancelText="No"
              />
              <ConfirmationModal
                isOpen={isMrfRejectModalOpen}
                onClose={() => {
                  setIsMrfRejectModalOpen(false);
                  setHighlightMrfNote(false);
                }}
                onConfirm={() => {
                  handlemrfReject();
                  setIsMrfRejectModalOpen(false);
                }}
                title="Confirm MRF Rejection"
                content="Are you sure you want to reject this MRF request?"
                okText="Yes"
                cancelText="No"
              />
               {/* NEW: Add the VendorDetailsModal component */}
                           <VendorDetailsModal
                            open={isVendorModalOpen}
                            onClose={handleCloseVendorModal}
                            onSave={handleSaveVendorDetails}
                            component={selectedComponent}
                           readOnly={false}
                          />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default NonCOCrequests;