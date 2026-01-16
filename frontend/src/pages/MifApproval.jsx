import React, { useState, useEffect } from "react";
import { Button, Table, Input, InputNumber } from "antd";
import {
  XCircleIcon,
  MagnifyingGlassIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import { DateTime } from "luxon";
import { useParams, useNavigate } from "react-router-dom";
import ConfirmationModal from "../components/ConfirmationModal";
import NotesSection from "../components/NotesSection";
import {
  fetchApprovalRequests,
  fetchPastApprovedRequests,
  fetchRequestDetails,
  rejectRequest,
  approveRequest,
  fetchMrfRequestDetails,
  rejectMrfRequest,
  approveMrfRequest,
  updateVendorDetails,
} from "../utils/api";
import VendorDetailsModal from "../components/VendorDetailsModal.jsx";

const MifApproval = ({ role, permissions }) => {
  const [requests, setRequests] = useState([]);
  const [pastApprovedRequests, setPastApprovedRequests] = useState([]);
  const [requestDetails, setRequestDetails] = useState([]);
  const [mrfDetails, setMrfDetails] = useState([]);
  const [mifPreviewItems, setMifPreviewItems] = useState([]);
  const [mrfPreviewItems, setMrfPreviewItems] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPastApproved, setShowPastApproved] = useState(false);
  const [mifFetchedNotes, setMifFetchedNotes] = useState([]);
  const [mifCurrentUserNotes, setMifCurrentUserNotes] = useState([]);
  const [mrfFetchedNotes, setMrfFetchedNotes] = useState([]);
  const [mrfCurrentUserNotes, setMrfCurrentUserNotes] = useState([]);
  const [highlightMifNote, setHighlightMifNote] = useState(false);
  const [highlightMrfNote, setHighlightMrfNote] = useState(false);
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
  const [quantityErrors, setQuantityErrors] = useState({});
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);

  const navigate = useNavigate();
  const { umi } = useParams();
  const userRole = role || localStorage.getItem("role") || "employee";
  const userId = localStorage.getItem("user_id");
  const userName = localStorage.getItem("name") || "Unknown";
  const isHead = userRole.endsWith("_head") || userRole === "admin";

  useEffect(() => {
    if (!isHead) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = showPastApproved
          ? await fetchPastApprovedRequests()
          : await fetchApprovalRequests();
        let filteredRequests = showPastApproved
          ? data
          : data.filter(
              (req) =>
                req.user_id !== userId && req.status === "Head Approval Pending"
            );

        if (searchTerm) {
          filteredRequests = filteredRequests.filter(
            (req) =>
              req.umi.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (req.user_name &&
                req.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (req.date &&
                req.date.toLowerCase().includes(searchTerm.toLowerCase())) ||
              req.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (req.project_name &&
                req.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (req.mrf_no &&
                req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        }

        const sortedRequests = [...filteredRequests].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        setRequests(
          sortedRequests.map((req, index) => ({
            ...req,
            key: index + 1,
            reference: req.umi,
            project_name: req.project_name || "N/A",
            requestedBy: req.user_name,
            date: DateTime.fromISO(req.created_at || req.date).toFormat(
              "dd-MM-yy HH:mm:ss"
            ),
            status: req.status,
            priority: req.priority || false,
            mrf_no: req.mrf_no || "N/A",
          }))
        );
      } catch (error) {
        setError(
          `Failed to fetch ${
            showPastApproved ? "past approved" : "approval"
          } requests.`
        );
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isHead, userId, showPastApproved, searchTerm]);

  useEffect(() => {
    if (
      !showMrfDetailsPanel ||
      mrfDetails.length === 0 ||
      requestDetails.length === 0
    )
      return;

    const updatedMrf = mrfDetails.map((item) => ({
      ...item,
      totalQty: calculateTotalQty(item, requestDetails),
    }));

    setMrfDetails(updatedMrf);
  }, [showMrfDetailsPanel, mrfDetails.length, requestDetails.length]);

 const handleSelectRequest = async (request) => {
    setLoading(true);
    setError(null);
    setSelectedRequest(request);
    setShowMrfDetailsPanel(false);
    try {
      const details = await fetchRequestDetails(request.umi);
      if (details.length === 0) {
        setError(`No request found for UMI: ${request.umi}`);
        return;
      }
      const updatedSelectedRequest = {
        ...request,
        mrf_no: details[0]?.mrf_no || request.mrf_no || "No MRF",
        project_name: details[0]?.project_name || "N/A",
        user_department: details[0]?.user_department|| "N/A",
      };
      setSelectedRequest(updatedSelectedRequest);

      const mappedDetails = details.map((item, index) => ({
        ...item,
        key: index + 1,
        description: item.item_description || "N/A",
        mpn: item.mpn || "N/A",
        part_no: item.part_no || "N/A",
        make: item.make || "N/A",
        uom: item.uom || "N/A",
        onHandQty: item.on_hand_quantity || 0,
        updatedQty: Number(
          item.updated_requestedqty || item.initial_requestedqty || 0
        ),
        initialQty: Number(item.initial_requestedqty || 0),
        remark: item.remark || "",
        highlightRemark: false,
        basket_id: item.basket_id,
        component_id: item.component_id,
      }));
      setRequestDetails(mappedDetails);

      const fetchedMifNotes = details[0]?.note;
      if (typeof fetchedMifNotes === "string" && fetchedMifNotes) {
        setMifFetchedNotes([
          {
            timestamp: new Date().toISOString(),
            user_name: "Unknown",
            role: "Unknown",
            content: fetchedMifNotes,
          },
        ]);
        setMifCurrentUserNotes([]);
      } else {
        const normalizedNotes = Array.isArray(fetchedMifNotes)
          ? fetchedMifNotes.map((note) => ({
              ...note,
              user_name: note.user_name || note.userName || note.username || "Unknown",
            }))
          : [];
        setMifFetchedNotes(normalizedNotes);
        setMifCurrentUserNotes([]);
      }

      setMifPriority(details[0]?.priority || false);
      setMrfPriority(false);
      setMrfPrioritySetBy(null);
      setMifPreviewItems([]);
      setMrfPreviewItems([]);
    } catch (error) {
      console.error("Fetch request details error:", error);
      setError("Failed to fetch request details.");
      setRequestDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestedQtyChange = (value, key, isMrf = false) => {
    if (showPastApproved || (isMrf ? (isMrfApproved || isMrfPastApproved) : isMifApproved)) return;

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
      const maxQty = requestDetails.find((item) => item.key === key)?.onHandQty || 0;
      newValue = Math.min(parsedValue, maxQty);


      const updatedItems = requestDetails.map((item) =>
        item.key === key
          ? { ...item, updatedQty: newValue, highlightRemark: false }
          : item
      );
      setRequestDetails(updatedItems);

      setMifPreviewItems((prev) => {
        const existingItem = prev.find((item) => item.key === key);
        const detailItem = updatedItems.find((item) => item.key === key);

        if (existingItem) {
          if (detailItem.updatedQty === detailItem.initialQty) {
            return prev.filter((item) => item.key !== key);
          }
          return prev.map((item) =>
            item.key === key
              ? { ...item, updatedQty: newValue, remark: item.remark || "" }
              : item
          );
        } else if (detailItem && detailItem.initialQty !== newValue) {
          return [
            ...prev,
            {
              ...detailItem,
              updatedQty: newValue,
              remark: detailItem.remark || "",
            },
          ];
        }
        return prev.filter((item) => item.key !== key);
      });

      if (showMrfDetailsPanel && mrfDetails.length > 0) {
        const mifItem = updatedItems.find((item) => item.key === key);
        if (mifItem) {
          const oldMifQty =
            requestDetails.find((item) => item.key === key)?.updatedQty || 0;
          const newMifQty = newValue;
          const quantityDelta = newMifQty - oldMifQty;

          const updatedMrfItems = mrfDetails.map((mrfItem) => {
            if (
              mrfItem.component_id === mifItem.component_id &&
              mrfItem.mpn === mifItem.mpn
            ) {
              const adjustedMrfQty = Math.max(
                (mrfItem.updatedQty || 0) + quantityDelta,
                0
              );
              return {
                ...mrfItem,
                updatedQty: adjustedMrfQty,
                totalQty: calculateTotalQty(
                  { ...mrfItem, updatedQty: adjustedMrfQty },
                  updatedItems
                ),
              };
            }
            return mrfItem;
          });

          setMrfDetails(updatedMrfItems);

          setMrfPreviewItems((prev) => {
            const updatedMrfItem = updatedMrfItems.find(
              (item) =>
                item.component_id === mifItem.component_id &&
                item.mpn === mifItem.mpn
            );
            if (!updatedMrfItem) return prev;

            const existingItem = prev.find(
              (item) => item.key === updatedMrfItem.key
            );
            if (updatedMrfItem.updatedQty === updatedMrfItem.initialQty) {
              return prev.filter((item) => item.key !== updatedMrfItem.key);
            }
            if (existingItem) {
              return prev.map((item) =>
                item.key === updatedMrfItem.key
                  ? {
                      ...item,
                      updatedQty: updatedMrfItem.updatedQty,
                      remark: item.remark || "",
                    }
                  : item
              );
            } else if (
              updatedMrfItem.initialQty !== updatedMrfItem.updatedQty
            ) {
              return [
                ...prev,
                {
                  ...updatedMrfItem,
                  updatedQty: updatedMrfItem.updatedQty,
                  remark: updatedMrfItem.remark || "",
                },
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
              totalQty: calculateTotalQty(
                { ...item, updatedQty: newValue },
                requestDetails
              ),
              highlightRemark: false,
            }
          : item
      );
      setMrfDetails(updatedItems);

      setMrfPreviewItems((prev) => {
        const existingItem = prev.find((item) => item.key === key);
        const detailItem = updatedItems.find((item) => item.key === key);
        let tempHistory = detailItem.quantity_change_history || [];

        if (detailItem.initialQty !== newValue) {
          const newHistoryEntry = {
            timestamp: new Date().toISOString(),
            user_name: userName,
            role: userRole,
            old_quantity: detailItem.initialQty,
            new_quantity: newValue,
          };
          tempHistory = [...tempHistory, newHistoryEntry];
        }

        if (existingItem) {
          if (detailItem.updatedQty === detailItem.initialQty) {
            return prev.filter((item) => item.key !== key);
          }
          return prev.map((item) =>
            item.key === key
              ? {
                  ...item,
                  updatedQty: newValue,
                  remark: item.remark || "",
                  quantity_change_history: tempHistory,
                }
              : item
          );
        } else if (detailItem && detailItem.initialQty !== newValue) {
          return [
            ...prev,
            {
              ...detailItem,
              updatedQty: newValue,
              remark: detailItem.remark || "",
              quantity_change_history: tempHistory,
            },
          ];
        }
        return prev.filter((item) => item.key !== key);
      });
    }
  };

  const handleRemarkChange = (value, key, isMrf = false) => {
    if (showPastApproved || (isMrf ? (isMrfApproved || isMrfPastApproved) : isMifApproved)) return;
    if (isMrf) {
      const updatedMrfDetails = mrfDetails.map((item) =>
        item.key === key ? { ...item, remark: value, highlightRemark: false } : item
      );
      setMrfDetails(updatedMrfDetails);
      setMrfPreviewItems((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, remark: value } : item
        )
      );
    } else {
      const updatedRequestDetails = requestDetails.map((item) =>
        item.key === key ? { ...item, remark: value, highlightRemark: false } : item
      );
      setRequestDetails(updatedRequestDetails);
      setMifPreviewItems((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, remark: value } : item
        )
      );
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

      const data = await fetchApprovalRequests();
      let filteredRequests = data.filter(
        (req) => req.user_id !== userId && req.status === "Head Approval Pending"
      );
      if (searchTerm) {
        filteredRequests = filteredRequests.filter(
          (req) =>
            req.umi.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.user_name &&
              req.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.date &&
              req.date.toLowerCase().includes(searchTerm.toLowerCase())) ||
            req.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.project_name &&
              req.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.mrf_no &&
              req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }
      const sortedRequests = [...filteredRequests].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      setRequests(
        sortedRequests.map((req, index) => ({
          ...req,
          key: index + 1,
          reference: req.umi,
          project_name: req.project_name || "N/A",
          requestedBy: req.user_name,
          date: DateTime.fromISO(req.created_at || req.date).toFormat(
            "dd-MM-yy HH:mm:ss"
          ),
          status: req.status,
          priority: req.priority || false,
          mrf_no: req.mrf_no || "N/A",
        }))
      );

      const updatedDetails = await fetchRequestDetails(selectedRequest.umi);
      const updatedSelectedRequest = {
        ...selectedRequest,
        status: updatedDetails[0]?.status || "Head Approval Pending",
        mrf_no: updatedDetails[0]?.mrf_no || selectedRequest.mrf_no,
        project_name:
          updatedDetails[0]?.project_name || selectedRequest.project_name,
      };
      setSelectedRequest(updatedSelectedRequest);

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
        reason: "Rejected by user",
      });

      alert("MRF Request rejected successfully!");
      const data = await fetchApprovalRequests();
      let filteredRequests = data.filter(
        (req) => req.user_id !== userId && req.status === "Head Approval Pending"
      );
      if (searchTerm) {
        filteredRequests = filteredRequests.filter(
          (req) =>
            req.umi.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.name &&
              req.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.date &&
              req.date.toLowerCase().includes(searchTerm.toLowerCase())) ||
            req.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.project_name &&
              req.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.mrf_no &&
              req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }
      const sortedRequests = [...filteredRequests].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      setRequests(
        sortedRequests.map((req, index) => ({
          ...req,
          key: index + 1,
          reference: req.umi,
          project_name: req.project_name || "N/A",
          requestedBy: req.name,
          date: DateTime.fromISO(req.created_at || req.date).toFormat(
            "dd-MM-yy HH:mm:ss"
          ),
          status: req.status,
          priority: req.priority || false,
          mrf_no: req.mrf_no || "N/A",
        }))
      );
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

  const handleApprove = async () => {
    if (!selectedRequest || !isHead || isMifApproved) {
      alert("No request selected or insufficient permissions.");
      return;
    }
    const missingRemarkItems = mifPreviewItems.filter(
      (item) => !item.remark.trim() && item.updatedQty !== item.initialQty
    );
    if (missingRemarkItems.length > 0) {
      const item = missingRemarkItems[0];
      const identifier = item.mpn !== "N/A" ? item.mpn : item.description;
      alert(
        `Remark is mandatory for "${identifier}" in MIF. Please provide a reason for the quantity change.`
      );

      const updatedItems = requestDetails.map((item) =>
        missingRemarkItems.some((missingItem) => missingItem.key === item.key)
          ? { ...item, highlightRemark: true }
          : item
      );
      setRequestDetails(updatedItems);
      return;
    }
    try {
      const updatedItems = requestDetails
        .filter((item) => item.basket_id)
        .map((item) => ({
          basket_id: item.basket_id,
          updated_requestedqty: item.updatedQty,
          remark: item.remark || "",
        }));
      if (updatedItems.length === 0) {
        alert(
          "No valid items to approve. Please ensure MIF details are populated correctly."
        );
        return;
      }

      await approveRequest(selectedRequest.umi, {
        updatedItems,
        note: mifCurrentUserNotes,
        priority: mifPriority,
      });
      alert("MIF Request approved successfully!");

      const data = await fetchApprovalRequests();
      let filteredRequests = data.filter(
        (req) => req.user_id !== userId && req.status === "Head Approval Pending"
      );
      if (searchTerm) {
        filteredRequests = filteredRequests.filter(
          (req) =>
            req.umi.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.user_name &&
              req.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.date &&
              req.date.toLowerCase().includes(searchTerm.toLowerCase())) ||
            req.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.project_name &&
              req.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.mrf_no &&
              req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }
      const sortedRequests = [...filteredRequests].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      setRequests(
        sortedRequests.map((req, index) => ({
          ...req,
          key: index + 1,
          reference: req.umi,
          project_name: req.project_name || "N/A",
          requestedBy: req.user_name,
          date: DateTime.fromISO(req.created_at || req.date).toFormat(
            "dd-MM-yy HH:mm:ss"
          ),
          status: req.status,
          priority: req.priority || false,
          mrf_no: req.mrf_no || "N/A",
        }))
      );

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
      setMifPriority(false);
      setMrfPriority(false);
      setMrfPrioritySetBy(null);
      setShowMrfDetailsPanel(false);
      setMrfDetails([]);
      setIsMifApproved(true);
    } catch (error) {
      console.error("MIF Approval error:", error.response?.data || error);
      alert(
        `Failed to approve MIF request for UMI: ${selectedRequest.umi}. ${
          error.response?.data?.message || "Please try again."
        }`
      );
    }
  };

const handleReject = async () => {
    if (!selectedRequest || !isHead || isMifApproved) return;
  
    if (mifCurrentUserNotes.length === 0) {
      setHighlightMifNote(true);
      setError("A note is required to reject the request. Please add a note.");
      return;
    }
  
    try {
      // Call the rejectRequest API to send the rejection to the backend
      await rejectRequest(selectedRequest.umi, {
        note: mifCurrentUserNotes,
      });
  
      // Show success message
      alert("MIF Request rejected successfully!");
  
      // Reset the UI state
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
      setMifPriority(false);
      setMrfPriority(false);
      setMrfPrioritySetBy(null);
      setShowMrfDetailsPanel(false);
      setMrfDetails([]);
  
      // Optionally: re-fetch or refresh the list here
      // (You can uncomment and use the code block below if needed)
  
      // /*
      // const data = await fetchApprovalRequests();
      // let filteredRequests = data.filter(
      //   (req) => req.user_id !== userId && req.status === "Head Approval Pending"
      // );
  
      // if (searchTerm) {
      //   filteredRequests = filteredRequests.filter(
      //     (req) =>
      //       req.umi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      //       (req.user_name &&
      //         req.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      //       (req.date &&
      //         req.date.toLowerCase().includes(searchTerm.toLowerCase())) ||
      //       req.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      //       (req.project_name &&
      //         req.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      //       (req.mrf_no &&
      //         req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase()))
      //   );
      // }
  
      // const sortedRequests = [...filteredRequests].sort(
      //   (a, b) => new Date(b.date) - new Date(a.date)
      // );
  
      // setRequests(
      //   sortedRequests.map((req, index) => ({
      //     ...req,
      //     key: index + 1,
      //     reference: req.umi,
      //     project_name: req.project_name || "N/A",
      //     requestedBy: req.user_name,
      //     date: DateTime.fromISO(req.created_at || req.date).toFormat(
      //       "dd-MM-yy HH:mm:ss"
      //     ),
      //     status: req.status,
      //     priority: req.priority || false,
      //     mrf_no: req.mrf_no || "N/A",
      //   }))
      // );
      // */
    } catch (error) {
      console.error("MIF Reject error:", error.response?.data || error);
      alert(
        `Failed to reject MIF request: ${
          error.response?.data?.message || error.message
        }`
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
        showPastApproved
      );
      if (!details || details.length === 0) {
        setError(`No MRF details found for MRF_NO: ${selectedRequest.mrf_no}`);
        setMrfDetails([]);
        setMrfPriority(details[0]?.priority || false);
        setMrfPrioritySetBy(details[0]?.prioritySetBy || null);
        setIsMrfPastApproved(false);
        setIsVendorModalOpen(false);
        setSelectedComponent(null);
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
          uom: item.uom || "N/A",
          onHandQty: item.on_hand_quantity || 0,
          updatedQty: Number(
            item.updated_requested_quantity|| item.initial_requested_quantity
          ),
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
      setIsMrfPastApproved(details[0]?.status !== "Head Approval Pending");
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
    setIsMrfPastApproved(false);
    setQuantityErrors({});
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
    setMrfDetails(updatedMrfDetails);

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


  const toggleSearchBar = () => {
    setSearchVisible(!searchVisible);
    if (searchVisible) setSearchTerm("");
  };

  const togglePriority = (isMrf = false) => {
    if (!showPastApproved && !(isMrf ? (isMrfApproved || isMrfPastApproved) : isMifApproved)) {
      if (isMrf) {
        if (mrfPriority && mrfPrioritySetBy !== userName) {
          alert(
            "Priority can only be changed by the user who set it to high."
          );
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

  const handleSearch = (e) => {
    if (e.key === "Enter" || e.type === "click") {
      setSearchTerm(e.target.value);
    }
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

    const normalize = (value) =>
      value ? String(value).trim().toLowerCase() : "";
    const mrfMpn = normalize(mrfItem.mpn);
    const mrfComponentId = normalize(mrfItem.component_id);

    const mifItem = mifDetails.find((mif) => {
      const mifMpn = normalize(mif.mpn);
      const mifComponentId = normalize(mif.component_id);
      return mifMpn === mrfMpn && mifComponentId === mrfComponentId;
    });

    const mrfQty = Number(mrfItem.updatedQty) || 0;
    const mifQty = mifItem ? Number(mifItem.updatedQty) || 0 : 0;

    if (isNaN(mrfQty) || isNaN(mifQty)) {
      console.warn("Invalid quantities: mrfQty or mifQty is NaN");
      return 0;
    }

    const totalQty = mrfQty + mifQty;
    return totalQty;
  };

  const confirmMifApprove = () => {
    setIsMifApproveModalOpen(true);
  };

  const confirmMifReject = () => {
    setIsMifRejectModalOpen(true);
  };

  const confirmMrfApprove = () => {
    setIsMrfApproveModalOpen(true);
  };

  const confirmMrfReject = () => {
    setIsMrfRejectModalOpen(true);
  };

  const columns = [
    { title: "UMI No.", dataIndex: "reference", key: "reference" },
    { title: "Date", dataIndex: "date", key: "date" },
    { title: "Project Name", dataIndex: "project_name", key: "project_name" },
    { title: "MRF No.", dataIndex: "mrf_no", key: "mrf_no" },
    { title: "Requested By", dataIndex: "requestedBy", key: "requestedBy" },
    { title: "Status", dataIndex: "status", key: "status" },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (_, record) => (
        <button
          className={`p-2 rounded-full ${
            record.priority ? "bg-red-500" : "bg-green-500"
          }`}
          disabled
        >
          <FlagIcon className="h-4 w-4 text-white" />
        </button>
      ),
    },
  ];

  const baseDetailColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    {
      title: "Part No",
      dataIndex: "part_no",
      key: "part_no",
      render: (text) => text || "-",
    },
    {
      title: "Make",
      dataIndex: "make",
      key: "make",
      render: (text) => text || "-",
    },
    { title: "UoM", dataIndex: "uom", key: "uom" },
    { title: "On Hand Qty", dataIndex: "onHandQty", key: "onHandQty" },
    {
      title: "Initial Requested Qty",
      dataIndex: "initialQty",
      key: "initialQty",
    },
    {
      title: "Updated Requested Qty",
      dataIndex: "updatedQty",
      key: "updatedQty",
      render: (_, record) => {
        const isEmpty =
          record.updatedQty == null || record.updatedQty === undefined;
        return (
          <div className="relative">
            <InputNumber
              min={0}
              value={record.updatedQty}
              onChange={(value) => handleRequestedQtyChange(value, record.key, false)}
              className={`w-full ${
                isEmpty ? "border-red-500 border-2 rounded" : "border-gray-300"
              }`}
              disabled={showPastApproved || isMifApproved}
            />
            {isEmpty && (
              <span className="text-red-500 text-xs mt-1 block">Required*</span>
            )}
            {quantityErrors[record.key] && (
              <span className="text-red-500 text-xs mt-1 block">
                {quantityErrors[record.key]}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const hasMifQuantityChange = requestDetails.some(
    (item) => item.updatedQty !== item.initialQty
  );

  const hasMifRemark = requestDetails.some(
    (item) => item.remark && item.remark.trim()
  );

  const mifRemarkColumn = {
    title: "Remark",
    dataIndex: "remark",
    key: "remark",
    render: (_, record) => {
      const hasQuantityDifference = record.updatedQty !== record.initialQty;
      if (isHead && !showPastApproved && !isMifApproved && hasQuantityDifference) {
        return (
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="Add your remark..."
                value={record.remark}
                onChange={(e) => handleRemarkChange(e.target.value, record.key)}
                className="w-full h-12 text-lg"
                style={
                  record.highlightRemark
                    ? {
                        borderColor: "#f5222d",
                        boxShadow: "none",
                      }
                    : {}
                }
              />
              {!record.remark.trim() && (
                <span className="text-red-500 text-xs mt-1 block">
                  Required*
                </span>
              )}
            </div>
          </div>
        );
      }
      return (
        <span
          className="leading-[48px] text-md "
          style={{ whiteSpace: "pre-line" }}
        >
          {record.remark || "-"}
        </span>
      );
    },
  };
  
  const detailColumns = [
    ...baseDetailColumns,
    ...(showPastApproved
      ? hasMifRemark
        ? [mifRemarkColumn]
        : []
      : (isHead && hasMifQuantityChange) || hasMifRemark
      ? [mifRemarkColumn]
      : []),
  ];

  const baseMrfDetailColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    {
      title: "Part No",
      dataIndex: "part_no",
      key: "part_no",
      render: (text) => text || "-",
    },
    {
      title: "Make",
      dataIndex: "make",
      key: "make",
      render: (text) => text || "-",
    },
     { title: "UoM", dataIndex: "uom", key: "uom" },
    { title: "On Hand Qty", dataIndex: "onHandQty", key: "onHandQty" },
    {
      title: "Initial Requested Qty",
      dataIndex: "initialQty",
      key: "initialQty",
    },
    {
          title: "Vendor Details",
          key: "vendorDetails",
          render: (_, record) =>
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
            ) : null,
        },
    {
      title: "Updated Requested Qty",
      dataIndex: "updatedQty",
      key: "updatedQty",
      render: (_, record) =>
        isHead && !showPastApproved && !(isMrfApproved || isMrfPastApproved) ? (
          <InputNumber
            value={record.updatedQty}
            onChange={(value) => handleRequestedQtyChange(value, record.key, true)}
            min={0}
            step={1}
            className="w-full h-12 text-lg"
            controls
            disabled={isMrfApproved || isMrfPastApproved}
          />
        ) : (
          <span className="leading-[48px] text-md">{record.updatedQty}</span>
        ),
    },
    {
      title: "Total Qty",
      dataIndex: "totalQty",
      key: "totalQty",
      render: (text) => (
        <span className="leading-[48px] text-md">{text}</span>
      ),
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
            const displayUserName =
              change.user_name ||
              change.userName ||
              change.username ||
              "Unknown";
            return (
              <div key={index}>
                {DateTime.fromISO(change.timestamp).toFormat(
                  "dd-MM-yy HH:mm"
                )}, {displayUserName}: {change.old_quantity} →{" "}
                {change.new_quantity}.
              </div>
            );
          })}
        </div>
      );
    },
  };

  const hasMrfQuantityChange = mrfDetails.some(
    (item) => item.updatedQty !== item.initialQty
  );

  const hasMrfRemark = mrfDetails.some(
    (item) => item.remark && item.remark.trim()
  );

  const hasQuantityChangeHistory = mrfDetails.some(
    (item) =>
      item.quantity_change_history && item.quantity_change_history.length > 0
  );

  const mrfRemarkColumn = {
    title: "Remark",
    dataIndex: "remark",
    key: "remark",
    render: (_, record) => {
      const hasItemQuantityChange =
        record.quantity_change_history &&
        record.quantity_change_history.length > 0;
      const hasQuantityDifference = record.updatedQty !== record.initialQty;
      if (
        isHead &&
        !showPastApproved &&
        !(isMrfApproved || isMrfPastApproved) &&
        hasQuantityDifference
      ) {
        return (
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="Add your remark..."
                value={record.remark}
                onChange={(e) =>
                  handleRemarkChange(e.target.value, record.key, true)
                }
                className="w-full h-12 text-lg"
                style={
                  record.highlightRemark
                    ? {
                        borderColor: "#f5222d",
                        boxShadow: "none",
                      }
                    : {}
                }
              />
              {!record.remark.trim() && (
                <span className="text-red-500 text-xs mt-1 block">
                  Required*
                </span>
              )}
            </div>
          </div>
        );
      } else if (
        (showPastApproved || isMrfPastApproved) &&
        (hasItemQuantityChange || record.remark)
      ) {
        return (
          <span
            className="leading-[48px] text-md "
            style={{ whiteSpace: "pre-line" }}
          >
            {record.remark || "-"}
          </span>
        );
      }
      return (
        <span
          className="leading-[48px] text-md "
          style={{ whiteSpace: "pre-line" }}
        >
          {record.remark || "-"}
        </span>
      );
    },
  };

  const mrfDetailColumns = [
    ...baseMrfDetailColumns,
    ...(hasQuantityChangeHistory ? [quantityChangeHistoryColumn] : []),
    ...((isHead && !showPastApproved && hasMrfQuantityChange) || hasMrfRemark
      ? [mrfRemarkColumn]
      : []),
  ];

  const mifPreviewColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    {
      title: "Updated Requested Qty",
      dataIndex: "updatedQty",
      key: "updatedQty",
    },
    {
      title: "Remark",
      dataIndex: "remark",
      key: "remark",
      render: (text) => (
        <span className="leading-tight" style={{ whiteSpace: "pre-line" }}>
          {text || "-"}
        </span>
      ),
    },
  ];

  const mrfPreviewColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    {
      title: "Updated Requested Qty",
      dataIndex: "updatedQty",
      key: "updatedQty",
    },
    {
      title: "Quantity Change History",
      dataIndex: "quantity_change_history",
      key: "quantity_change_history",
      render: (history) => {
        if (!history || history.length === 0) return "No changes.";
        return (
          <div className="leading-tight">
            {history.map((change, index) => {
              const displayUserName =
                change.user_name ||
                change.userName ||
                change.username ||
                "Unknown";
              return (
                <div key={index}>
                  {DateTime.fromISO(change.timestamp).toFormat(
                    "dd-MM-yy HH:mm"
                  )}, {displayUserName}: {change.old_quantity} →{" "}
                  {change.new_quantity}.
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      title: "Remark",
      dataIndex: "remark",
      key: "remark",
      render: (text) => (
        <span className="leading-tight" style={{ whiteSpace: "pre-line" }}>
          {text || "-"}
        </span>
      ),
    },
  ];

  if (!isHead)
    return (
      <div className="text-center text-red-600 p-6">Unauthorized Access</div>
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0 }}
      className="p-4 bg-gradient-to-br from-blue-50 to-gray-100 min-h-screen mt-8"
    >
      <div className={`flex transition-all duration-500 h-[calc(100vh-4rem)] gap-2 ${isMifApproveModalOpen || isMifRejectModalOpen || isMrfApproveModalOpen || isMrfRejectModalOpen ? 'backdrop-blur-sm' : ''}`}>
        <AnimatePresence>
          {!selectedRequest && (
            <motion.div
              key="table-section"
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-2xl shadow-xl p-4 overflow-y-auto w-full transform transition-all duration-500 ease-in-out"
            >
              <div className="flex justify-between items-center mb-6">
                <motion.h2
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-3xl font-bold text-gray-800 border-b-2 border-blue-300 pb-2"
                >
                  {showPastApproved
                    ? "Past Approved Requests"
                    : "Material Issue Approval"}
                </motion.h2>
                <div className="flex items-center gap-4 relative">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleSearchBar}
                    className="text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <MagnifyingGlassIcon className="h-6 w-6" />
                  </motion.button>
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
                          onPressEnter={handleSearch}
                          onBlur={handleSearch}
                          autoFocus
                          className="w-64 rounded-lg"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      type="primary"
                      onClick={() => {
                        setShowPastApproved(!showPastApproved);
                        setRequests([]);
                        setPastApprovedRequests([]);
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
                        setMifPriority(false);
                        setMrfPriority(false);
                        setMrfPrioritySetBy(null);
                        setShowMrfDetailsPanel(false);
                        setMrfDetails([]);
                        setIsMifApproved(false);
                        setIsMrfApproved(false);
                        setIsMrfPastApproved(false);
                        setQuantityErrors({});
                      }}
                      className="bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded-lg"
                    >
                      {showPastApproved
                        ? "Back to Pending Requests"
                        : "View Past Approved"}
                    </Button>
                  </motion.div>
                </div>
              </div>

              {loading && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-gray-600"
                >
                  Loading...
                </motion.p>
              )}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-600"
                >
                  {error}
                </motion.p>
              )}
              <Table
                dataSource={requests}
                columns={columns}
                rowKey="key"
                onRow={(record) => ({
                  onClick: () => handleSelectRequest(record),
                })}
                className="w-full table-fixed whitespace-nowrap rounded-lg overflow-hidden"
                rowClassName="cursor-pointer hover:bg-blue-50 transition-colors duration-200"
                pagination={{ pageSize: 10 }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {selectedRequest && (
            <motion.div
              key="mif-section"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={`bg-white rounded-2xl shadow-xl p-6 overflow-y-auto overflow-x-auto relative ${
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
              <motion.h2
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-3xl font-bold text-gray-800 border-b-2 border-blue-300 pb-2"
              >
                Material Issue Form
              </motion.h2>
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
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-600 mb-4"
                >
                  {error}
                </motion.p>
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="grid grid-cols-2 gap-4 mb-4"
              >
                <p className="text-md text-gray-800">
                  <strong>UMI No.:</strong> {selectedRequest.reference}
                </p>
                <p className="text-md text-gray-800">
                  <strong>MRF No.:</strong> {selectedRequest.mrf_no}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Department:</strong> {selectedRequest.user_department}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Requested By:</strong> {selectedRequest.requestedBy}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Status:</strong> {selectedRequest.status || "N/A"}
                </p>
              </motion.div>
              <Table
                dataSource={requestDetails.filter(item => item.initialQty > 0)
                .map((item, index) => ({
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
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    MIF Preview Changes
                  </h3>
                  <Table
                    dataSource={mifPreviewItems}
                    columns={mifPreviewColumns}
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
                readOnly={showPastApproved || isMifApproved}
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
                  onClick={() => togglePriority(false)}
                  className={`p-2 rounded-full ${
                    mifPriority ? "bg-red-500" : "bg-green-500"
                  }`}
                  disabled={showPastApproved || isMifApproved}
                  style={{
                    cursor: showPastApproved || isMifApproved ? "default" : "pointer",
                  }}
                >
                  <FlagIcon className="h-4 w-4 text-white" />
                </motion.button>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="primary"
                    onClick={confirmMifApprove}
                    className="custom-approve rounded-lg"
                    disabled={
                      showPastApproved ||
                      isMifApproved ||
                      (userRole.includes("department_head") &&
                        selectedRequest?.status !== "Head Approval Pending")
                    }
                  >
                    Approve
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="default"
                    onClick={confirmMifReject}
                    className= "custom-reject rounded-lg"
                    disabled={
                      showPastApproved ||
                      isMifApproved ||
                      (userRole.includes("department_head") &&
                        selectedRequest?.status !== "Head Approval Pending")
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
                  <>
                    Are you sure you want to approve this MIF request?
                    {selectedRequest?.mrf_no && selectedRequest.mrf_no !== "No MRF" && (
                      <p className="text-red-600 mt-2">
                        The MRF form is attached for your consideration, kindly approve or reject as necessary.
                      </p>
                    )}
                  </>
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
                content="Are you sure you want to reject this MIF request?"
                okText="Yes"
                cancelText="No"
              />
            </motion.div>
          )}
          {showMrfDetailsPanel && (
            <motion.div
              key="mrf-section"
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
                  <strong>MRF No.:</strong>{" "}
                  {mrfDetails[0]?.mrf_no || selectedRequest.mrf_no || "N/A"}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Project Name:</strong>{" "}
                  {mrfDetails[0]?.project_name ||
                    selectedRequest.project_name ||
                    "N/A"}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Department:</strong>{" "}
                  {mrfDetails[0]?.user_department}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Requested By:</strong>{" "}
                  {mrfDetails[0]?.user_name || selectedRequest.requestedBy || "N/A"}
                </p>
                <p className="text-md text-gray-800">
                  <strong>Status:</strong>{" "}
                  {mrfDetails[0]?.status || selectedRequest.status || "N/A"}
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
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    MRF Preview Changes
                  </h3>
                  <Table
                    dataSource={mrfPreviewItems}
                    columns={mrfPreviewColumns}
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
                readOnly={showPastApproved || isMrfApproved || isMrfPastApproved}
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
                  className={`p-2 rounded-full ${
                    mrfPriority ? "bg-red-500" : "bg-green-500"
                  }`}
                  disabled={showPastApproved || isMrfApproved || isMrfPastApproved}
                  style={{
                    cursor: (showPastApproved || isMrfApproved || isMrfPastApproved) ? "default" : "pointer",
                  }}
                >
                  <FlagIcon className="h-4 w-4 text-white" />
                </motion.button>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="primary"
                    onClick={confirmMrfApprove}
                    className="custom-approve rounded-lg"
                    disabled={
                      showPastApproved ||
                      isMrfApproved ||
                      isMrfPastApproved ||
                      (userRole.includes("department_head") &&
                        mrfDetails[0]?.status !== "Head Approval Pending")
                    }
                  >
                    Approve
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="default"
                    onClick={confirmMrfReject}
                    className="custom-reject rounded-lg"
                    disabled={
                      showPastApproved ||
                      isMrfApproved ||
                      isMrfPastApproved ||
                      (userRole.includes("department_head") &&
                        mrfDetails[0]?.status !== "Head Approval Pending")
                    }
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

export default MifApproval;