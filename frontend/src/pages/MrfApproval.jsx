import React, { useState, useEffect } from "react";
import { Button, Table, DatePicker, Input, Select, InputNumber, Modal, Checkbox, Dropdown, Menu } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { XCircleIcon, MagnifyingGlassIcon, FlagIcon } from "@heroicons/react/24/outline";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import {
  fetchMrfApprovalRequests,
  fetchPastMrfApprovedRequests,
  fetchMrfRequestDetails,
  approveMrfRequest,
  rejectMrfRequest,
  updateVendorDetails,
  fetchPreviousPurchases,
  fetchAllVendors,
  fetchPreviousVendors,
} from "../utils/api";
import ConfirmationModal from "../components/ConfirmationModal";
import VendorDetailsModal from "../components/VendorDetailsModal.jsx";
import NotesSection from "../components/NotesSection";
import moment from "moment";

const { Option } = Select;
const API_BASE_URL = "http://localhost:5000/api";

const MrfApproval = ({ role, permissions }) => {
  const [requests, setRequests] = useState([]);
  const [pastApprovedRequests, setPastApprovedRequests] = useState([]);
  const [requestDetails, setRequestDetails] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const userRole = role || localStorage.getItem("role") || "employee";
  const isCeo = userRole === "ceo";
    const isPurchase = userRole === "purchase_head";
  const [error, setError] = useState(null);
  const [showPastApproved, setShowPastApproved] = useState(localStorage.getItem("showPastApproved") === "true");
  const [fetchedNotes, setFetchedNotes] = useState({});
  const [currentUserNotes, setCurrentUserNotes] = useState({});
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [priority, setPriority] = useState(false);
  const [prioritySetBy, setPrioritySetBy] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [selectedComponentKeys, setSelectedComponentKeys] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const userId = localStorage.getItem("user_id");
  const userEmail = localStorage.getItem("email") || "";
  const isSpecialUser = userEmail === "kkpurchase@gmail.com" && userId === "6";
  const [previewItems, setPreviewItems] = useState([]);
  const [currentUserRemarks, setCurrentUserRemarks] = useState({});
  const [showRemarkInput, setShowRemarkInput] = useState({});
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [highlightNote, setHighlightNote] = useState({});
  const [currentUser, setCurrentUser] = useState(localStorage.getItem("name") || "Unknown");
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [pastPurchasesModalVisible, setPastPurchasesModalVisible] = useState(false);
  const [pastPurchasesData, setPastPurchasesData] = useState([]);
  const [pastPurchasesLoading, setPastPurchasesLoading] = useState(false);
  const [previousVendors, setPreviousVendors] = useState([]);
  const [isPreviousVendorsModalOpen, setIsPreviousVendorsModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    key: true,
    description: true,
    mpn: true,
    part_no: true,
    make: true,
    uom: true,
    onHandQty: true,
    initialRequestedQty: true,
    vendorDetails: true,
    updatedRequestedQty: true,
    past_purchases: isSpecialUser || isCeo,
    quantity_change_history: true,
    remark: true,
    status: true,
    notes: true,
  });
  const [editedVendorDetails, setEditedVendorDetails] = useState({});

  const navigate = useNavigate();
  const { mrf_no } = useParams();
  
  const isHead = userRole.endsWith("_head") || userRole === "admin" || userRole === "ceo";
  const department = userRole.match(/^(\w+)_(head|employee)$/)?.[1] || "N/A";
  const userName = localStorage.getItem("name") || "Unknown";
  const isHeadId3 = userId === "3" && isHead;

  useEffect(() => {
    const storedUser = localStorage.getItem("name") || "Unknown";
    if (storedUser !== currentUser) {
      setCurrentUser(storedUser);
      setFetchedNotes({});
      setCurrentUserNotes({});
    }
  }, [userName]);

  useEffect(() => {
    localStorage.setItem("showPastApproved", showPastApproved.toString());
  }, [showPastApproved]);

  useEffect(() => {
    if (!isHead) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let data;
        if (mrf_no) {
          data = await fetchMrfRequestDetails(mrf_no, showPastApproved);
          if (data.length === 0) {
            setError(`No request found for MRF No. ${mrf_no}`);
            return;
          }
          const request = {
            mrf_no,
            reference: mrf_no,
            project_name: data[0]?.project_name || "N/A",
            requestedBy: data[0]?.name || "Unknown",
            date: data[0]?.date || new Date().toISOString(),
            priority: data[0]?.priority || false,
            prioritySetBy: data[0]?.prioritySetBy || null,
          };
          setSelectedRequest(request);
          setPriority(request.priority);
          setPrioritySetBy(request.prioritySetBy);
          const mappedDetails = await Promise.all(data.map(async (item, index) => {
            let avgApproxPrice = 0;
            if (isSpecialUser || isCeo) {
              try {
                const pastPurchases = await fetchPreviousPurchases({ componentId: item.component_id, limit: 5, sort: "created_at DESC" });
                const validPurchases = pastPurchases.filter(p => !isNaN(parseFloat(p.rate_per_unit)) && parseFloat(p.rate_per_unit) > 0);
                if (validPurchases.length > 0) {
                  avgApproxPrice = validPurchases.reduce((sum, p) => sum + parseFloat(p.rate_per_unit), 0) / validPurchases.length;
                }
              } catch (error) {
                console.error(`Error fetching past purchases for component ${item.component_id}:`, error);
              }
            }
            const quantityChangeHistory = Array.isArray(item.quantity_change_history)
              ? item.quantity_change_history.map((change) => ({
                  ...change,
                  user_name: change.user_name || change.userName || change.username || "Unknown",
                }))
              : [];
            let noteData = item.note;
            let parsedNotes = [];
            if (typeof noteData === "string" && noteData) {
              try {
                const parsed = JSON.parse(noteData);
                parsedNotes = Array.isArray(parsed) ? parsed : [{
                  timestamp: new Date().toISOString(),
                  user_name: "Unknown",
                  content: parsed,
                }];
              } catch (e) {
                parsedNotes = [{
                  timestamp: new Date().toISOString(),
                  user_name: "Unknown",
                  content: noteData,
                }];
              }
            } else if (Array.isArray(noteData)) {
              parsedNotes = noteData.map(n => ({
                timestamp: n.timestamp || new Date().toISOString(),
                user_name: n.user_name || "Unknown",
                content: n.content || "",
              }));
            }
            return {
              ...item,
              key: index + 1,
              description: item.item_description || "N/A",
              mpn: item.mpn || "N/A",
              part_no: item.part_no || "N/A",
              make: item.make || "N/A",
              uom: item.uom || "N/A",
              onHandQty: item.on_hand_quantity || 0,
              initialRequestedQty: item.initial_requested_quantity || 0,
              updatedRequestedQty: item.updated_requested_quantity !== null
                ? item.updated_requested_quantity
                : item.initial_requested_quantity || 0,
              currentQty: item.updated_requested_quantity !== null
                ? item.updated_requested_quantity
                : item.initial_requested_quantity || 0,
              remark: item.remark || "",
              highlightRemark: false,
              status: item.status || "Unknown",
              quantity_change_history: quantityChangeHistory,
              vendorDetails: {
                vendorName: item.vendor || "",
                vendor_link: item.vendor_link || "",
                approxPrice: isSpecialUser || isCeo ? avgApproxPrice.toFixed(2) : item.approx_price || "",
                expected_deliverydate: item.expected_deliverydate || "",
                certificate_desired: item.certificate_desired || false,
              },
              avgApproxPrice: isSpecialUser || isCeo ? avgApproxPrice.toFixed(2) : null,
              avgBasicAmount: isSpecialUser || isCeo ? (avgApproxPrice * (item.updated_requested_quantity || item.initial_requested_quantity || 0)).toFixed(2) : null,
              note: parsedNotes,
            };
          }));
          setRequestDetails(mappedDetails);
          const initialNotes = {};
          const initialUserNotes = {};
          mappedDetails.forEach(item => {
            initialNotes[item.key] = item.note || [];
            initialUserNotes[item.key] = [];
          });
          setFetchedNotes(initialNotes);
          setCurrentUserNotes(initialUserNotes);
          setPreviewItems([]);
          const initialRemarks = {};
          const initialShowRemarkInput = {};
          mappedDetails.forEach((item) => {
            initialRemarks[item.key] = "";
            initialShowRemarkInput[item.key] = false;
          });
          setCurrentUserRemarks(initialRemarks);
          setShowRemarkInput(initialShowRemarkInput);
        } else {
          data = showPastApproved ? await fetchPastMrfApprovedRequests() : await fetchMrfApprovalRequests();
          let filteredRequests = data.filter(
            (req) => req.user_id !== userId && (!showPastApproved || req.status !== "Issued")
          );
          if (searchTerm) {
            filteredRequests = filteredRequests.filter(
              (req) =>
                req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (req.user_name && req.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (req.date && req.date.toLowerCase().includes(searchTerm.toLowerCase()))
            );
          }
          const uniqueRequests = Array.from(new Map(filteredRequests.map((req) => [req.mrf_no, req])).values());
          const sortedRequests = [...uniqueRequests].sort((a, b) => new Date(b.date) - new Date(a.date));
          setRequests(
            sortedRequests.map((req, index) => ({
              ...req,
              key: index + 1,
              reference: req.mrf_no,
              project_name: req.project_name || "N/A",
              requestedBy: req.name,
              date: DateTime.fromISO(req.date).toFormat("dd-MM-yy HH:mm:ss"),
              priority: req.priority || false,
              prioritySetBy: req.prioritySetBy || null,
            }))
          );
        }
      } catch (error) {
        console.error("Fetch Error Details:", error.response?.data || error.message);
        setError(
          `Failed to fetch ${
            mrf_no
              ? "request details"
              : showPastApproved
              ? "past approved"
              : "approval"
          } requests.`
        );
      } finally {
        setLoading(false);
        setSelectedComponentKeys([]);
        setSelectAll(false);
      }
    };
    fetchData();
  }, [isHead, mrf_no, userId, searchTerm, showPastApproved]);

  useEffect(() => {
    const fetchVendors = async () => {
      setVendorLoading(true);
      try {
        const response = await fetchAllVendors();
        const vendorList = Array.isArray(response)
          ? response.map(v => ({ id: v.id, name: v.name }))
          : [];
        setVendors(vendorList);
      } catch (error) {
        console.error("Error fetching vendors:", error);
        setVendors([]);
      } finally {
        setVendorLoading(false);
      }
    };
    fetchVendors();
  }, []);

  useEffect(() => {
    if (isHeadId3 && selectedComponent) {
      const fetchPreviousVendorsData = async () => {
        try {
          const data = await fetchPreviousVendors({ componentId: selectedComponent.component_id });
          setPreviousVendors(data.map(v => v.vendor_name).filter(v => v));
        } catch (error) {
          console.error("Error fetching previous vendors:", error);
          setPreviousVendors([]);
        }
      };
      fetchPreviousVendorsData();
    }
  }, [isHeadId3, selectedComponent]);

  const handleViewToggle = async () => {
    setLoading(true);
    setError(null);
    const newShowPastApproved = !showPastApproved;
    setShowPastApproved(newShowPastApproved);
    try {
      const data = newShowPastApproved
        ? await fetchPastMrfApprovedRequests(filterDate ? { date: filterDate } : undefined)
        : await fetchMrfApprovalRequests();
      let filteredRequests = newShowPastApproved
        ? data
        : data.filter((req) => req.user_id !== userId && req.status !== "Issued");

      if (searchTerm) {
        filteredRequests = filteredRequests.filter(
          (req) =>
            req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.user_name && req.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.date && req.date.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      const uniqueRequests = Array.from(new Map(filteredRequests.map((req) => [req.mrf_no, req])).values());
      const sortedRequests = [...uniqueRequests].sort((a, b) => new Date(b.date) - new Date(a.date));
      setRequests(
        sortedRequests.map((req, index) => ({
          ...req,
          key: index + 1,
          reference: req.mrf_no,
          project_name: req.project_name || "N/A",
          requestedBy: req.name,
          date: DateTime.fromISO(req.date).toFormat("dd-MM-yy HH:mm:ss"),
          priority: req.priority || false,
          prioritySetBy: req.prioritySetBy || null,
        }))
      );
      setPastApprovedRequests(newShowPastApproved ? data : []);
      setSelectedRequest(null);
      setRequestDetails([]);
      setFetchedNotes({});
      setCurrentUserNotes({});
      setPriority(false);
      setPrioritySetBy(null);
      setPreviewItems([]);
      setCurrentUserRemarks({});
      setShowRemarkInput({});
      setShowTimeline(false);
      setIsVendorModalOpen(false);
      setSelectedComponent(null);
      setSelectedComponentKeys([]);
      setSelectAll(false);
    } catch (error) {
      setError(`Failed to fetch ${newShowPastApproved ? "past approved" : "approval"} requests.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (showPastApproved) return;
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      const selectableKeys = requestDetails
        .filter(item => !showPastApproved && (isCeo ? item.status === "CEO Approval Pending" : ["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending", "CEO Approval Pending"].includes(item.status)))
        .map(item => item.key);
      setSelectedComponentKeys(selectableKeys);
    } else {
      setSelectedComponentKeys([]);
    }
  };

  const handleSelectComponent = (key) => {
    if (showPastApproved) return;
    setSelectedComponentKeys(prev => {
      const item = requestDetails.find(r => r.key === key);
      if (!item) return prev;
      const isSelectable = !showPastApproved && (isCeo ? item.status === "CEO Approval Pending" : ["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending", "CEO Approval Pending"].includes(item.status));
      if (!isSelectable) return prev;
      const newKeys = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      setSelectAll(newKeys.length === requestDetails.filter(item => !showPastApproved && (isCeo ? item.status === "CEO Approval Pending" : ["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending", "CEO Approval Pending"].includes(item.status))).length);
      return newKeys;
    });
  };

  const handleSelectRequest = async (request) => {
    setSelectedRequest(request);
    setPriority(request.priority || false);
    setPrioritySetBy(request.prioritySetBy || null);
    setPreviewItems([]);
    setShowTimeline(false);
    try {
      const details = await fetchMrfRequestDetails(request.mrf_no, showPastApproved);
      const mappedDetails = await Promise.all(details.map(async (item, index) => {
        let avgApproxPrice = 0;
        if (isSpecialUser || isCeo) {
          try {
            const pastPurchases = await fetchPreviousPurchases({ componentId: item.component_id, limit: 5, sort: "created_at DESC" });
            const validPurchases = pastPurchases.filter(p => !isNaN(parseFloat(p.rate_per_unit)) && parseFloat(p.rate_per_unit) > 0);
            if (validPurchases.length > 0) {
              avgApproxPrice = validPurchases.reduce((sum, p) => sum + parseFloat(p.rate_per_unit), 0) / validPurchases.length;
            }
          } catch (error) {
            console.error(`Error fetching past purchases for component ${item.component_id}:`, error);
          }
        }
        const quantityChangeHistory = Array.isArray(item.quantity_change_history)
          ? item.quantity_change_history.map((change) => ({
              ...change,
              user_name: change.user_name || change.userName || change.username || "Unknown",
            }))
          : [];
        let noteData = item.note;
        let parsedNotes = [];
        if (typeof noteData === "string" && noteData) {
          try {
            const parsed = JSON.parse(noteData);
            parsedNotes = Array.isArray(parsed) ? parsed : [{
              timestamp: new Date().toISOString(),
              user_name: "Unknown",
              content: parsed,
            }];
          } catch (e) {
            parsedNotes = [{
              timestamp: new Date().toISOString(),
              user_name: "Unknown",
              content: noteData,
            }];
          }
        } else if (Array.isArray(noteData)) {
          parsedNotes = noteData.map(n => ({
            timestamp: n.timestamp || new Date().toISOString(),
            user_name: n.user_name || "Unknown",
            content: n.content || "",
          }));
        }
        return {
          ...item,
          key: index + 1,
          description: item.item_description || "N/A",
          mpn: item.mpn || "N/A",
          part_no: item.part_no || "N/A",
          make: item.make || "N/A",
          uom: item.uom || "N/A",
          onHandQty: item.on_hand_quantity || 0,
          initialRequestedQty: item.initial_requested_quantity || 0,
          updatedRequestedQty: item.updated_requested_quantity !== null
            ? item.updated_requested_quantity
            : item.initial_requested_quantity || 0,
          currentQty: item.updated_requested_quantity !== null
            ? item.updated_requested_quantity
            : item.initial_requested_quantity || 0,
          remark: item.remark || "",
          highlightRemark: false,
          status: item.status || "Unknown",
          quantity_change_history: quantityChangeHistory,
          vendorDetails: {
            vendorName: item.vendor || "",
            vendor_link: item.vendor_link || "",
            approxPrice: isSpecialUser || isCeo ? avgApproxPrice.toFixed(2) : item.approx_price || "",
            expected_deliverydate: item.expected_deliverydate || "",
            certificate_desired: item.certificate_desired || false,
          },
          avgApproxPrice: isSpecialUser || isCeo ? avgApproxPrice.toFixed(2) : null,
          avgBasicAmount: isSpecialUser || isCeo ? (avgApproxPrice * (item.updated_requested_quantity || item.initial_requested_quantity || 0)).toFixed(2) : null,
          note: parsedNotes,
        };
      }));
      setRequestDetails(mappedDetails);
      const initialNotes = {};
      const initialUserNotes = {};
      mappedDetails.forEach(item => {
        initialNotes[item.key] = item.note || [];
        initialUserNotes[item.key] = [];
      });
      setFetchedNotes(initialNotes);
      setCurrentUserNotes(initialUserNotes);
      const initialRemarks = {};
      const initialShowRemarkInput = {};
      mappedDetails.forEach((item) => {
        initialRemarks[item.key] = "";
        initialShowRemarkInput[item.key] = false;
      });
      setCurrentUserRemarks(initialRemarks);
      setShowRemarkInput(initialShowRemarkInput);
    } catch (error) {
      setError("Failed to fetch request details.");
      setRequestDetails([]);
    }
  };

  const handleRequestedQtyChange = (value, key) => {
    if (showPastApproved) return;

    if (value === null || value === undefined) {
      console.warn(`Invalid value: ${value}. Value cannot be null or undefined.`);
      return;
    }

    const parsedValue = Number(value);
    if (isNaN(parsedValue) || parsedValue < 0) {
      console.warn(`Invalid value: ${value}. Must be a non-negative number.`);
      return;
    }

    const updatedItems = requestDetails.map((item) =>
      item.key === key
        ? { 
            ...item, 
            updatedRequestedQty: parsedValue, 
            highlightRemark: false,
            avgBasicAmount: isCeo || isSpecialUser ? (parseFloat(item.avgApproxPrice || 0) * parsedValue).toFixed(2) : item.avgBasicAmount
          }
        : item
    );
    setRequestDetails(updatedItems);

    setPreviewItems((prev) => {
      const existingItem = prev.find((item) => item.key === key);
      const detailItem = updatedItems.find((item) => item.key === key);
      let tempHistory = detailItem.quantity_change_history || [];

      if (detailItem.currentQty !== parsedValue) {
        const newHistoryEntry = {
          timestamp: new Date().toISOString(),
          user_name: userName,
          role: userRole,
          old_quantity: detailItem.currentQty,
          new_quantity: parsedValue,
        };
        tempHistory = [...tempHistory, newHistoryEntry];
      }

      if (existingItem) {
        if (detailItem.updatedRequestedQty === detailItem.currentQty) {
          return prev.filter((item) => item.key !== key);
        }
        return prev.map((item) =>
          item.key === key
            ? { ...item, updatedRequestedQty: parsedValue, remark: currentUserRemarks[key] || "", quantity_change_history: tempHistory }
            : item
        );
      } else if (detailItem && detailItem.currentQty !== parsedValue) {
        return [
          ...prev,
          {
            ...detailItem,
            updatedRequestedQty: parsedValue,
            remark: currentUserRemarks[key] || "",
            quantity_change_history: tempHistory,
          },
        ];
      }
      return prev.filter((item) => item.key !== key);
    });
  };

  const handleRemarkChange = (value, key) => {
    if (showPastApproved) return;
    setCurrentUserRemarks((prev) => ({
      ...prev,
      [key]: value,
    }));

    setPreviewItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, remark: value } : item))
    );
  };

const handleNoteChange = (value, key) => {
  if (showPastApproved) return;
  setCurrentUserNotes(prev => ({
    ...prev,
    [key]: [
      {
        timestamp: new Date().toISOString(),
        user_name: userName,
        role: userRole,
        content: value
      }
    ]
  }));
};

const handleVendorDetailsChange = (key, field, value) => {
  if (showPastApproved) return; // Disable for past approved or CEO
  const item = requestDetails.find(r => r.key === key);
  if (!item) return;

 const isEditable = (isHead || isCeo || isPurchase) && 
      !showPastApproved && 
      ["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending"].includes(item.status);

    if (!isEditable) return; // Prevent changes if not editable

  const originalVendorDetails = {
    vendorName: item.vendor || "",
    vendor_link: item.vendor_link || "",
    approxPrice: item.approx_price || "",
    expected_deliverydate: item.expected_deliverydate || "",
    certificate_desired: item.certificate_desired || false,
  };
  const newVendorDetails = { ...item.vendorDetails, [field]: value };
  const hasChanges = JSON.stringify(originalVendorDetails) !== JSON.stringify({ ...originalVendorDetails, ...newVendorDetails });

  setRequestDetails((prev) =>
    prev.map((item) =>
      item.key === key
        ? {
            ...item,
            vendorDetails: newVendorDetails,
            [field === "vendorName" ? "vendor" : field]: value,
            avgBasicAmount: field === "approxPrice" && (isSpecialUser || isCeo || isPurchase) 
              ? (parseFloat(value || 0) * item.updatedRequestedQty).toFixed(2) 
              : item.avgBasicAmount
          }
        : item
    )
  );

  setEditedVendorDetails(prev => ({
    ...prev,
    [key]: hasChanges ? { ...prev[key], [field]: value } : prev[key]
  }));
};

  const handleSaveVendorDetails = async (key) => {
    const item = requestDetails.find(r => r.key === key);
    if (!item || showPastApproved || isCeo || !editedVendorDetails[key]) return;

    try {
      await updateVendorDetails(item.mrf_id, item.component_id, {
        vendor: item.vendorDetails.vendorName,
        vendor_link: item.vendorDetails.vendor_link,
        approx_price: item.vendorDetails.approxPrice,
        expected_deliverydate: item.vendorDetails.expected_deliverydate,
        certificate_desired: item.vendorDetails.certificate_desired,
      });
      alert("Vendor details updated successfully!");
      setEditedVendorDetails(prev => ({ ...prev, [key]: null }));
    } catch (error) {
      console.error("Error saving vendor details:", error);
      alert("Failed to save vendor details: " + error.message);
    }
  };

  const toggleRemarkInput = (key) => {
    setShowRemarkInput((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

const handleApprove = async () => {
  if (!selectedRequest || !isHead) {
    alert("No request selected or insufficient permissions.");
    return;
  }

  if (selectedComponentKeys.length === 0) {
    alert("Please select at least one component to approve.");
    return;
  }

  const selectedItems = requestDetails.filter(item => selectedComponentKeys.includes(item.key));
  const pendingItems = selectedItems.filter(item =>
    ["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending", "CEO Approval Pending"].includes(item.status)
  );

  if (pendingItems.length === 0) {
    alert("No components with a pending status selected for approval.");
    return;
  }

  // Validate vendorName for Purchase role
  if (isPurchase) {
    const missingVendorItems = pendingItems.filter(item => !item.vendorDetails.vendorName);
    if (missingVendorItems.length > 0) {
      alert("Vendor Name is mandatory for Purchase approval. Please fill in the Vendor Name for all selected items.");
      return;
    }
  }

  // Validate remarks for quantity changes
  const missingRemarkItems = pendingItems.filter(
    item => !currentUserRemarks[item.key]?.trim() && item.updatedRequestedQty !== item.currentQty
  );
  if (missingRemarkItems.length > 0) {
    const item = missingRemarkItems[0];
    const identifier = item.mpn !== "N/A" ? item.mpn : item.description;
    alert(`Remark is mandatory for "${identifier}". Please provide a reason for the quantity change.`);

    const updatedItems = requestDetails.map(item =>
      missingRemarkItems.some(missingItem => missingItem.key === item.key)
        ? { ...item, highlightRemark: true }
        : item
    );
    setRequestDetails(updatedItems);
    return;
  }

  try {
    // Prepare updatedItems with component-specific notes
    const updatedItems = pendingItems
      .filter(item => item.mrf_id && item.component_id)
      .map(item => ({
        mrf_id: item.mrf_id,
        component_id: item.component_id,
        updated_requested_quantity: item.updatedRequestedQty,
        remark: currentUserRemarks[item.key]?.trim() || null,
        vendor: item.vendorDetails.vendorName || null,
        vendor_link: item.vendorDetails.vendor_link || null,
        approx_price: item.vendorDetails.approxPrice || null,
        expected_deliverydate: item.vendorDetails.expected_deliverydate || null,
        certificate_desired: item.vendorDetails.certificate_desired || false,
        amount: item.avgBasicAmount || 0,
        rate_per_unit: item.avgApproxPrice || 0,
        notes: currentUserNotes[item.key]?.filter(note => note.content?.trim()) || [],
      }));

   console.log("Sending currentUserNotes:", currentUserNotes); // Debug log

    // Ensure rejection notes are included for non-selected components
    const allComponentIds = requestDetails.map(item => item.component_id);
    const nonSelectedComponentIds = allComponentIds.filter(id => !selectedComponentKeys.includes(id));
    const rejectionNotes = {};
    nonSelectedComponentIds.forEach(id => {
      const noteKey = requestDetails.find(item => item.component_id === id)?.key;
      if (currentUserNotes[noteKey]?.length) {
        rejectionNotes[id] = currentUserNotes[noteKey].filter(note => note.content?.trim());
      } else {
        rejectionNotes[id] = [{
          timestamp: new Date().toISOString(),
          user_name: userName,
          role: userRole,
          content: `Rejected by ${userName} during approval`,
        }];
      }
    });

    // Send approval request to the backend
    const response = await approveMrfRequest(selectedRequest.mrf_no, {
      updatedItems,
      note: [], // No global notes, handled per component
      priority,
      prioritySetBy,
      currentUserNotes: { ...currentUserNotes, ...rejectionNotes }, // Merge approved and rejection notes
    });

    console.log("Approval API response:", response); // Debug log

    // Use updatedComponents from response as primary data
    let updatedDetails = response.updatedComponents || [];
    updatedDetails = updatedDetails.map((item, index) => {
      const existingItem = requestDetails.find(r => r.component_id === item.component_id) || {};
      return {
        ...existingItem,
        ...item,
        key: index + 1,
        description: item.item_description || existingItem.description || "N/A",
        mpn: item.mpn || existingItem.mpn || "N/A",
        part_no: item.part_no || existingItem.part_no || "N/A",
        make: item.make || existingItem.make || "N/A",
        uom: item.uom || existingItem.uom || "N/A",
        onHandQty: item.on_hand_quantity || existingItem.onHandQty || 0,
        initialRequestedQty: item.initial_requested_quantity || existingItem.initialRequestedQty || 0,
        updatedRequestedQty: item.updated_requested_quantity !== null
          ? item.updated_requested_quantity
          : item.initial_requested_quantity || 0,
        currentQty: item.updated_requested_quantity !== null
          ? item.updated_requested_quantity
          : item.initial_requested_quantity || 0,
        remark: item.remark || existingItem.remark || "",
        highlightRemark: false,
        status: item.status || existingItem.status || "Unknown",
        quantity_change_history: Array.isArray(item.quantity_change_history)
          ? item.quantity_change_history.map(change => ({
              ...change,
              user_name: change.user_name || change.userName || change.username || "Unknown",
            }))
          : existingItem.quantity_change_history || [],
        vendorDetails: {
          vendorName: item.vendor || existingItem.vendorDetails?.vendorName || "",
          vendor_link: item.vendor_link || existingItem.vendorDetails?.vendor_link || "",
          approxPrice: item.approx_price || existingItem.vendorDetails?.approxPrice || "",
          expected_deliverydate: item.expected_deliverydate || existingItem.vendorDetails?.expected_deliverydate || "",
          certificate_desired: item.certificate_desired || existingItem.vendorDetails?.certificate_desired || false,
        },
        note: Array.isArray(item.note)
          ? item.note.map(n => ({
              timestamp: n.timestamp || new Date().toISOString(),
              user_name: n.user_name || "Unknown",
              content: n.content || "",
            }))
          : existingItem.note || [],
      };
    });

    // Update state with refreshed details
    setRequestDetails(prev => {
      const nonUpdatedComponents = prev.filter(item => !updatedDetails.some(u => u.component_id === item.component_id));
      return [...updatedDetails, ...nonUpdatedComponents].map((item, index) => ({ ...item, key: index + 1 }));
    });
    setSelectedComponentKeys([]);
    setSelectAll(false);
    setCurrentUserNotes({});
    setCurrentUserRemarks({});
    setHighlightNote({});
    setPreviewItems([]);

    alert(`MRF request components processed successfully: ${response.message}`);
  } catch (error) {
    console.error("Approval error:", error.response?.data || error);
    alert(error.response?.data?.message || "Failed to approve selected components. Please try again.");
  }
};

const handleReject = async () => {
  if (!selectedRequest || !isHead) {
    alert("No request selected or insufficient permissions.");
    return;
  }

  if (selectedComponentKeys.length === 0) {
    alert("Please select at least one component to reject.");
    return;
  }

  const selectedItems = requestDetails.filter(item => selectedComponentKeys.includes(item.key));
  const pendingItems = selectedItems.filter(item =>
    item.status === "Head Approval Pending" ||
    item.status === "Inventory Approval Pending" ||
    item.status === "Purchase Approval Pending" ||
    item.status === "CEO Approval Pending"
  );

  if (pendingItems.length === 0) {
    alert("No components with a pending status selected for rejection.");
    return;
  }

  const missingNotes = pendingItems.filter(item => !currentUserNotes[item.key]?.[0]?.content?.trim());
  if (missingNotes.length > 0) {
    const updatedHighlight = {};
    missingNotes.forEach(item => {
      updatedHighlight[item.key] = true;
    });
    setHighlightNote(updatedHighlight);
    alert("A note is required for each selected component to reject. Please add notes.");
    return;
  }

  try {
    const updatedItems = pendingItems
      .filter(item => item.mrf_id && item.component_id)
      .map(item => ({
        mrf_id: item.mrf_id,
        component_id: item.component_id,
        remark: currentUserRemarks[item.key]?.trim() || null,
        notes: [...(item.notes || []), ...(currentUserNotes[item.key] || [])],
      }));

    await rejectMrfRequest(selectedRequest.mrf_no, {
      updatedItems,
      note: currentUserNotes,
    });

    alert("Selected components rejected successfully!");

    // Refresh request details after rejection
    const updatedDetails = await fetchMrfRequestDetails(selectedRequest.mrf_no, showPastApproved);
    const mappedDetails = await Promise.all(updatedDetails.map(async (item, index) => {
      let avgApproxPrice = 0;
      if (isSpecialUser || isCeo || isPurchase) {
        try {
          const pastPurchases = await fetchPreviousPurchases({ componentId: item.component_id, limit: 5, sort: "created_at DESC" });
          const validPurchases = pastPurchases.filter(p => !isNaN(parseFloat(p.rate_per_unit)) && parseFloat(p.rate_per_unit) > 0);
          if (validPurchases.length > 0) {
            avgApproxPrice = validPurchases.reduce((sum, p) => sum + parseFloat(p.rate_per_unit), 0) / validPurchases.length;
          }
        } catch (error) {
          console.error(`Error fetching past purchases for component ${item.component_id}:`, error);
        }
      }
      const quantityChangeHistory = Array.isArray(item.quantity_change_history)
        ? item.quantity_change_history.map((change) => ({
            ...change,
            user_name: change.user_name || change.userName || change.username || "Unknown",
          }))
        : [];
      let noteData = item.note;
      let parsedNotes = [];
      if (typeof noteData === "string" && noteData) {
        try {
          const parsed = JSON.parse(noteData);
          parsedNotes = Array.isArray(parsed) ? parsed : [{
            timestamp: new Date().toISOString(),
            user_name: "Unknown",
            content: parsed,
          }];
        } catch (e) {
          parsedNotes = [{
            timestamp: new Date().toISOString(),
            user_name: "Unknown",
            content: noteData,
          }];
        }
      } else if (Array.isArray(noteData)) {
        parsedNotes = noteData.map(n => ({
          timestamp: n.timestamp || new Date().toISOString(),
          user_name: n.user_name || "Unknown",
          content: n.content || "",
        }));
      }
      return {
        ...item,
        key: index + 1,
        description: item.item_description || "N/A",
        mpn: item.mpn || "N/A",
        part_no: item.part_no || "N/A",
        make: item.make || "N/A",
        uom: item.uom || "N/A",
        onHandQty: item.on_hand_quantity || 0,
        initialRequestedQty: item.initial_requested_quantity || 0,
        updatedRequestedQty: item.updated_requested_quantity !== null
          ? item.updated_requested_quantity
          : item.initial_requested_quantity || 0,
        currentQty: item.updated_requested_quantity !== null
          ? item.updated_requested_quantity
          : item.initial_requested_quantity || 0,
        remark: item.remark || "",
        highlightRemark: false,
        status: item.status || "Unknown",
        quantity_change_history: quantityChangeHistory,
        vendorDetails: {
          vendorName: item.vendor || "",
          vendor_link: item.vendor_link || "",
          approxPrice: isSpecialUser || isCeo || isPurchase ? avgApproxPrice.toFixed(2) : item.approx_price || "",
          expected_deliverydate: item.expected_deliverydate || "",
          certificate_desired: item.certificate_desired || false,
        },
        avgApproxPrice: isSpecialUser || isCeo || isPurchase ? avgApproxPrice.toFixed(2) : null,
        avgBasicAmount: isSpecialUser || isCeo || isPurchase ? (avgApproxPrice * (item.updated_requested_quantity || item.initial_requested_quantity || 0)).toFixed(2) : null,
        note: parsedNotes,
      };
    }));
    setRequestDetails(mappedDetails);
    setSelectedComponentKeys([]);
    setSelectAll(false);
    setCurrentUserNotes({});
    setCurrentUserRemarks({});
    setHighlightNote({});
  } catch (error) {
    console.error("Reject error:", error.response?.data || error);
    //alert(error.response?.data?.message || "Failed to reject selected components.");
  }
};

  // const handleReject = async () => {
  //   if (!selectedRequest || !isHead) return;

  //   if (selectedComponentKeys.length === 0) {
  //     alert("Please select at least one component to reject.");
  //     return;
  //   }

  //   const selectedItems = requestDetails.filter(item => selectedComponentKeys.includes(item.key));
  //   const missingNotes = selectedItems.filter(item => !currentUserNotes[item.key]?.[0]?.content?.trim());
  //   if (missingNotes.length > 0) {
  //     const updatedHighlight = {};
  //     missingNotes.forEach(item => {
  //       updatedHighlight[item.key] = true;
  //     });
  //     setHighlightNote(updatedHighlight);
  //     alert("A note is required for each selected component to reject. Please add notes.");
  //     return;
  //   }

  //   try {
  //     const updatedItems = selectedItems
  //       .filter(item => item.mrf_id && item.component_id)
  //       .map(item => ({
  //         mrf_id: item.mrf_id,
  //         component_id: item.component_id,
  //         remark: currentUserRemarks[item.key]?.trim() || null,
  //         notes: [...(item.notes || []), ...(currentUserNotes[item.key] || [])]
  //       }));

  //     await rejectMrfRequest(selectedRequest.mrf_no, {
  //       updatedItems,
  //     });

  //     alert("Selected components rejected successfully!");
  //     setSelectedRequest(null);
  //     setRequestDetails([]);
  //     setFetchedNotes({});
  //     setCurrentUserNotes({});
  //     setHighlightNote({});
  //     setPriority(false);
  //     setPrioritySetBy(null);
  //     setPreviewItems([]);
  //     setCurrentUserRemarks({});
  //     setShowRemarkInput({});
  //     setShowTimeline(false);
  //     setIsVendorModalOpen(false);
  //     setSelectedComponent(null);
  //     setSelectedComponentKeys([]);
  //     setSelectAll(false);
  //     const data = await fetchMrfApprovalRequests();
  //     let filteredRequests = data;
  //     if (searchTerm) {
  //       filteredRequests = filteredRequests.filter(
  //         req =>
  //           req.mrf_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //           (req.user_name &&
  //             req.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
  //           (req.date &&
  //             req.date.toLowerCase().includes(searchTerm.toLowerCase())) ||
  //           req.status.toLowerCase().includes(searchTerm.toLowerCase())
  //       );
  //     }
  //     const uniqueRequests = Array.from(
  //       new Map(filteredRequests.map(req => [req.mrf_no])).values()
  //     );
  //     const sortedRequests = [...uniqueRequests].sort(
  //       (a, b) => new Date(b.date) - new Date(a.date)
  //     );
  //     setRequests(
  //       sortedRequests.map((req, index) => ({
  //         ...req,
  //         key: index + 1,
  //         reference: req.mrf_no,
  //         project_name: req.project_name || "N/A",
  //         requestedBy: req.name,
  //         date: DateTime.fromISO(req.date).toFormat("dd-MM-yy HH:mm:ss"),
  //         priority: req.priority || false,
  //         prioritySetBy: req.prioritySetBy || null,
  //       }))
  //     );
  //   } catch (error) {
  //     console.error("Reject error:", error.response?.data || error);
  //     alert("Failed to reject selected components: " + (error.response?.data?.message || error.message));
  //   }
  // };

  const confirmApprove = () => {
    setIsApproveModalOpen(true);
  };

  const confirmReject = () => {
    setIsRejectModalOpen(true);
  };

  const handleCloseDetails = () => {
    setSelectedRequest(null);
    setRequestDetails([]);
    setFetchedNotes({});
    setCurrentUserNotes({});
    setError(null);
    setPriority(false);
    setPrioritySetBy(null);
    setPreviewItems([]);
    setCurrentUserRemarks({});
    setShowRemarkInput({});
    setShowTimeline(false);
    setIsVendorModalOpen(false);
    setSelectedComponent(null);
    navigate("/mrf-approval");
  };

  const handleOpenVendorModal = async (component) => {
    setSelectedComponent(component);
    setIsVendorModalOpen(true);
    if (isHeadId3) {
      setIsPreviousVendorsModalOpen(true);
    }
  };

  const handleCloseVendorModal = () => {
    setIsVendorModalOpen(false);
    setSelectedComponent(null);
  };

  const handleShowPastPurchases = async (component_id) => {
    setPastPurchasesLoading(true);
    try {
      const filters = { componentId: component_id, limit: 5, sort: "created_at DESC" };
      const data = await fetchPreviousPurchases(filters);
      const enhancedData = data.slice(0, 5).map(item => ({
        po_number: item.po_number || 'N/A',
        created_at: item.created_at ? DateTime.fromISO(item.created_at).toFormat("dd-MM-yy") : 'N/A',
        vendor_name: item.vendor_name || 'N/A',
        updated_requested_quantity: item.updated_requested_quantity || 'N/A',
        rate_per_unit: isNaN(parseFloat(item.rate_per_unit)) ? '0.00' : parseFloat(item.rate_per_unit).toFixed(2),
        amount: isNaN(parseFloat(item.amount)) ? '0.00' : parseFloat(item.amount).toFixed(2),
        key: item.po_number || Math.random().toString(),
      }));
      setPastPurchasesData(enhancedData);
      setPastPurchasesModalVisible(true);
    } catch (error) {
      console.error('Error fetching previous purchases:', error.message);
      alert('Failed to fetch previous purchase details.');
      setPastPurchasesData([]);
    } finally {
      setPastPurchasesLoading(false);
    }
  };


  const toggleSearchBar = () => {
    setSearchVisible(!searchVisible);
    if (searchVisible) setSearchTerm("");
  };

  const handleSearch = (e) => {
    if (e.key === "Enter" || e.type === "click") {
      setSearchTerm(e.target.value);
    }
  };

  const togglePriority = (request) => {
    if (showPastApproved) return;

    if (priority && prioritySetBy !== userName) {
      alert("Priority can only be changed by the user who set it to high.");
      return;
    }

    const newPriority = !priority;
    setRequests((prev) =>
      prev.map((req) =>
        req.key === request.key
          ? {
              ...req,
              priority: newPriority,
              prioritySetBy: newPriority ? userName : null,
            }
          : req
      )
    );
    setPriority(newPriority);
    setPrioritySetBy(newPriority ? userName : null);
  };

  const handleColumnVisibilityChange = (key) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const columnMenu = (
    <Menu>
      {Object.keys(visibleColumns).map((key) => (
        <Menu.Item key={key}>
          <Checkbox
            checked={visibleColumns[key]}
            onChange={() => handleColumnVisibilityChange(key)}
            disabled={key === "key" || (key === "past_purchases" && !isSpecialUser && !isCeo) || (key === "additional_details" && !isSpecialUser && !isCeo)}
          >
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </Checkbox>
        </Menu.Item>
      ))}
    </Menu>
  );

  const columns = [
    { title: "MRF No.", dataIndex: "reference", key: "reference" },
    { title: "Requested By", dataIndex: "requestedBy", key: "requestedBy" },
    { title: "Date", dataIndex: "date", key: "date" },
    { title: "Project Name", dataIndex: "project_name", key: "project_name" },
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
    {
      title: (
        <Checkbox
          checked={selectAll}
          onChange={handleSelectAll}
          disabled={showPastApproved}
        >
          Select All
        </Checkbox>
      ),
      key: "selection",
      show: true,
      render: (_, record) => (
        <Checkbox
          checked={selectedComponentKeys.includes(record.key)}
          onChange={() => handleSelectComponent(record.key)}
          disabled={showPastApproved || !(!showPastApproved && (isCeo ? record.status === "CEO Approval Pending" : ["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending", "CEO Approval Pending"].includes(record.status)))}
        />
      ),
    },
    {
      title: "S.No",
      dataIndex: "key",
      key: "key",
      show: visibleColumns.key,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      show: visibleColumns.description,
    },
    {
      title: "MPN",
      dataIndex: "mpn",
      key: "mpn",
      show: visibleColumns.mpn,
    },
    {
      title: "Part No",
      dataIndex: "part_no",
      key: "part_no",
      render: (text) => text || "-",
      show: visibleColumns.part_no,
    },
    {
      title: "Make",
      dataIndex: "make",
      key: "make",
      render: (text) => text || "-",
      show: visibleColumns.make,
    },
    {
      title: "UoM",
      dataIndex: "uom",
      key: "uom",
      show: visibleColumns.uom,
    },
    {
      title: "On Hand Qty",
      dataIndex: "onHandQty",
      key: "onHandQty",
      show: visibleColumns.onHandQty,
    },
    {
      title: "Initial Requested Qty",
      dataIndex: "initialRequestedQty",
      key: "initialRequestedQty",
      render: (text) => text || "0",
      show: visibleColumns.initialRequestedQty,
    },
    {
      title: "Updated Requested Qty",
      dataIndex: "updatedRequestedQty",
      key: "updatedRequestedQty",
      show: visibleColumns.updatedRequestedQty,
      render: (_, record) =>
        ((isHead || isCeo) && !showPastApproved && ["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending", "CEO Approval Pending"].includes(record.status)) ? (
          <InputNumber
            value={record.updatedRequestedQty}
            onChange={(value) => handleRequestedQtyChange(value, record.key)}
            min={0}
            className="w-full h-12 text-lg"
            controls
            disabled={!["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending", "CEO Approval Pending"].includes(record.status)}
          />
        ) : (
          <span className="leading-[48px] text-md" style={{ cursor: "default" }}>
            {record.updatedRequestedQty}
          </span>
        ),
    },
    {
      title: "Vendor Details",
  key: "vendor_details",
  show: visibleColumns.vendorDetails,
  render: (_, record) => {
    const isEditable = 
      isHead && 
      !showPastApproved && 
      ["Head Approval Pending", "Inventory Approval Pending", "Purchase Approval Pending"].includes(record.status);

    return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-40 text-sm font-medium">Vendor Name:</span>
              <Select
            showSearch
            value={record.vendorDetails.vendorName || undefined}
            onChange={(value) => handleVendorDetailsChange(record.key, "vendorName", value)}
            placeholder="Select or type Vendor"
            className="w-60 h-10 text-sm"
            disabled={!isEditable}
            loading={vendorLoading}
            required={parseInt(userId, 10) === 1}
          >
                {vendors.map((vendor) => (
              <Option key={vendor.id} value={vendor.name}>
                {vendor.name}
              </Option>
            ))}
              </Select>
          {parseInt(userId, 10) === 1 && !record.vendorDetails.vendorName && (
            <span className="text-red-500 text-xs">Required*</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-40 text-sm font-medium">Vendor Link:</span>
          <Input
            value={record.vendorDetails.vendor_link || ""}
            onChange={(e) => handleVendorDetailsChange(record.key, "vendor_link", e.target.value)}
            className="w-60 h-10 text-sm"
            disabled={!isEditable}
            placeholder="Enter Vendor Link"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-40 text-sm font-medium">Expected Delivery Date:</span>
          <DatePicker
            value={record.vendorDetails.expected_deliverydate ? moment(record.vendorDetails.expected_deliverydate) : null}
            onChange={(date, dateString) => handleVendorDetailsChange(record.key, "expected_deliverydate", dateString)}
            className="w-60 h-10 text-sm"
            disabled={!isEditable}
            disabledDate={(current) => current && current < moment().startOf("day")}
            format="YYYY-MM-DD"
            placeholder="Select Delivery Date"
          />
            </div>
            <div className="flex items-center space-x-2">
          <span className="w-40 text-sm font-medium">CoC Required:</span>
          <Select
            value={record.vendorDetails.certificate_desired ? "Yes" : "No"}
            onChange={(value) => handleVendorDetailsChange(record.key, "certificate_desired", value === "Yes")}
            className="w-60 h-10 text-sm"
            disabled={!isEditable}
          >
            <Option value="Yes">Yes</Option>
            <Option value="No">No</Option>
          </Select>
        </div>
            {(isSpecialUser || isCeo) && (
          <>
            <div className="flex items-center space-x-2">
              <span className="w-40 text-sm font-medium">Approx Price:</span>
              <InputNumber
                value={record.vendorDetails.approxPrice || 0}
                onChange={(value) => handleVendorDetailsChange(record.key, "approxPrice", value)}
                className="!w-60 h-10 text-sm"
                disabled={!isEditable}
                min={0}
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-40 text-sm font-medium">Basic Total:</span>
              <InputNumber
                value={record.avgBasicAmount || 0}
                className="!w-60 h-10 text-sm"
                disabled={true}
                placeholder="Calculated Total"
              />
            </div>
            <p className="text-red-600 text-xs">* GST will be charged extra</p>
          </>
        )}
        {isEditable && editedVendorDetails[record.key] && (
          <Button
            onClick={() => handleSaveVendorDetails(record.key)}
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-300 text-sm"
          >
            Save
          </Button>
        )}
      </div>
    );
  },

    },
    ...(isSpecialUser || isCeo ? [
    {
      title: "Additional Details",
      key: "additional_details",
      show: visibleColumns.additional_details,
      render: (_, record) => (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="w-40 text-sm font-medium">Vendor Name:</span>
            <Select
              showSearch
              value={record.vendorDetails.vendorName || undefined}
              onChange={(value) => handleVendorDetailsChange(record.key, "vendorName", value)}
              placeholder="Select or type Vendor"
              className="w-60 h-10 text-sm"
              //disabled={!isEditable}
              loading={vendorLoading}
            >
              {vendors.map((vendor) => (
                <Option key={vendor.id} value={vendor.name}>
                  {vendor.name}
                </Option>
              ))}
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-40 text-sm font-medium">Expected Delivery Date:</span>
            <DatePicker
              value={record.vendorDetails.expected_deliverydate ? moment(record.vendorDetails.expected_deliverydate) : null}
              onChange={(date, dateString) => handleVendorDetailsChange(record.key, "expected_deliverydate", dateString)}
              className="w-60 h-10 text-sm"
             // disabled={!isEditable}
              disabledDate={(current) => current && current < moment().startOf("day")}
              format="YYYY-MM-DD"
              placeholder="Select Delivery Date"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-40 text-sm font-medium">Approx Price:</span>
            <InputNumber
              value={record.vendorDetails.approxPrice || 0}
              onChange={(value) => handleVendorDetailsChange(record.key, "approxPrice", value)}
              className="!w-60 h-10 text-sm"
             // disabled={!isEditing}
              min={0}
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-40 text-sm font-medium">Basic Total:</span>
            <InputNumber
              value={record.avgBasicAmount || 0}
              className="!w-60 h-10 text-sm"
              disabled={true}
              placeholder="Calculated Total"
            />
          </div>
          <p className="text-red-600 text-xs">* GST will be charged extra</p>
        </div>
      ),
    },
    {
      title: "Past Purchases",
      key: "past_purchases",
      show: visibleColumns.past_purchases,
      render: (_, record) => (
        <Button
          onClick={() => handleShowPastPurchases(record.component_id)}
          className="!bg-blue-600 !text-white font-medium px-4 py-2 rounded hover:!bg-blue-700"
        >
          View Past Purchases
        </Button>
      ),
    }] : []),
  ];
  const quantityChangeHistoryColumn = {
    title: "Quantity Change History",
    dataIndex: "quantity_change_history",
    key: "quantity_change_history",
    show: visibleColumns.quantity_change_history,
    render: (history) => {
      if (!history || history.length === 0) return "No changes.";
      return (
        <div className="leading-tight">
          {history.map((change, index) => {
            const displayUserName = change.user_name || change.userName || change.username || "Unknown";
            return (
              <div key={index}>
                {DateTime.fromISO(change.timestamp).toFormat("dd-MM-yy HH:mm")}, {displayUserName} : {change.old_quantity} to {change.new_quantity}
              </div>
            );
          })}
        </div>
      );
    },
  };

  const notesColumn = {
    title: "Note",
    key: "notes",
    show: visibleColumns.notes,
    render: (_, record) => (
      <div className="space-y-4 p-2 bg-gray-50 rounded-lg w-96">
        {(fetchedNotes[record.key] || []).map((note, index) => (
          <div key={index} className="text-sm leading-relaxed break-words">
            {DateTime.fromISO(note.timestamp).toFormat("dd-MM-yy HH:mm")} - {note.user_name}: {note.content}
          </div>
        ))}
        {(currentUserNotes[record.key] || []).map((note, index) => (
          <div key={index} className="text-sm leading-relaxed break-words">
            {DateTime.fromISO(note.timestamp).toFormat("dd-MM-yy HH:mm")} - {note.user_name}: {note.content}
          </div>
        ))}
        {isHead && !showPastApproved &&  (
          <Input
            placeholder="Add note..."
            value={currentUserNotes[record.key]?.[0]?.content || ""}
            onChange={(e) => handleNoteChange(e.target.value, record.key)}
            className={`w-full mt-2 ${highlightNote[record.key] ? "border-red-500" : ""}`}
          />
        )}
      </div>
    ),
  };

  const remarkColumn = {
    title: "Remark",
    dataIndex: "remark",
    key: "remark",
    show: visibleColumns.remark,
    render: (_, record) => {
      const hasItemQuantityChange = record.quantity_change_history && record.quantity_change_history.length > 0;
      if ((isHead || isCeo) && !showPastApproved && !isCeo) {
        const hasQuantityDifference = record.updatedRequestedQty !== record.currentQty;
        if (hasQuantityDifference) {
          return (
            <div className="space-y-2">
              {record.remark && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-700 leading-tight" style={{ whiteSpace: "pre-line" }}>
                    {record.remark}
                  </span>
                </div>
              )}
              <div className="relative">
                <Input
                  placeholder="Add your remark..."
                  value={currentUserRemarks[record.key] || ""}
                  onChange={(e) => handleRemarkChange(e.target.value, record.key)}
                  className="w-full h-12 text-lg"
                  style={record.highlightRemark ? {
                    borderColor: "#f5222d",
                    boxShadow: "none",
                  } : {}}
                  disabled={false}
                />
                {!currentUserRemarks[record.key]?.trim() && (
                  <span className="text-red-500 text-xs mt-1 block">Required*</span>
                )}
              </div>
            </div>
          );
        }
        return <span className="leading-[48px] text-md" style={{ whiteSpace: "pre-line" }}>{record.remark || "-"}</span>;
      }
      if (isCeo && !showPastApproved) {
        const hasQuantityDifference = record.updatedRequestedQty !== record.currentQty;
        if (hasQuantityDifference) {
          return (
            <div className="space-y-2">
              {record.remark && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-700 leading-tight" style={{ whiteSpace: "pre-line" }}>
                    {record.remark}
                  </span>
                </div>
              )}
              <div className="relative">
                <Input
                  placeholder="Add your remark..."
                  value={currentUserRemarks[record.key] || ""}
                  onChange={(e) => handleRemarkChange(e.target.value, record.key)}
                  className="w-full h-12 text-lg"
                  style={record.highlightRemark ? {
                    borderColor: "#f5222d",
                    boxShadow: "none",
                  } : {}}
                  disabled={false}
                />
                {!currentUserRemarks[record.key]?.trim() && (
                  <span className="text-red-500 text-xs mt-1 block">Required*</span>
                )}
              </div>
            </div>
          );
        }
        return <span className="leading-[48px] text-md" style={{ whiteSpace: "pre-line" }}>{record.remark || "-"}</span>;
      }
      return <span className="leading-[48px] text-md" style={{ whiteSpace: "pre-line" }}>{record.remark || "-"}</span>;
    },
  };

  const hasQuantityChangeHistory = requestDetails.some(
    (item) => item.quantity_change_history && item.quantity_change_history.length > 0
  );

  const hasRemark = requestDetails.some((item) => item.remark && item.remark.trim());

  const hasQuantityChange = requestDetails.some(
    (item) => item.updatedRequestedQty !== item.currentQty
  );

  const statusColumn = {
    title: "Status",
    dataIndex: "status",
    key: "status",
    show: visibleColumns.status,
    render: (text) => text || "Unknown",
  };

  const detailColumns = [
    ...baseDetailColumns.filter(col => col.show),
        ...(visibleColumns.status ? [statusColumn] : []),
    ...(hasQuantityChangeHistory && visibleColumns.quantity_change_history ? [quantityChangeHistoryColumn] : []),
    ...(visibleColumns.notes ? [notesColumn] : []),
    ...((isHead && !showPastApproved && hasQuantityChange || hasRemark) && visibleColumns.remark ? [remarkColumn] : []),
  ];

  const pastPurchasesColumns = [
    {
      title: "PO Number",
      dataIndex: "po_number",
      key: "po_number",
      width: 150,
    },
    {
      title: "Purchase Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
    },
    {
      title: "Vendor Name",
      dataIndex: "vendor_name",
      key: "vendor_name",
      width: 150,
    },
    {
      title: "Ordered Quantity",
      dataIndex: "updated_requested_quantity",
      key: "updated_requested_quantity",
      render: text => text || 'N/A',
      width: 120,
    },
    {
      title: "Rate/Unit",
      dataIndex: "rate_per_unit",
      key: "rate_per_unit",
      render: value => {
        const num = Number(value);
        return isNaN(num) ? '0.00' : num.toFixed(2);
      },
      width: 100,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: value => {
        const num = Number(value);
        return isNaN(num) ? '0.00' : num.toFixed(2);
      },
      width: 100,
    },
  ];

  const previewColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "Updated Requested Qty", dataIndex: "updatedRequestedQty", key: "updatedRequestedQty" },
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
                  {DateTime.fromISO(change.timestamp).toFormat("dd-MM-yy HH:mm")}, {displayUserName} : {change.old_quantity} to {change.new_quantity}
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
        <span className="leading-tight" style={{ whiteSpace: "pre-line" }}>{text || "-"}</span>
      ),
    },
    {
      title: "Notes",
      key: "notes",
      render: (_, record) => (
        <div className="leading-tight">
          {(currentUserNotes[record.key] || []).map((note, index) => (
            <div key={index}>
              {DateTime.fromISO(note.timestamp).toFormat("dd-MM-yy HH:mm")} - {note.user_name}: {note.content}
            </div>
          ))}
        </div>
      ),
    },
  ];

  const previousVendorsColumns = [
    {
      title: "Previous Vendors",
      dataIndex: "vendor_name",
      key: "vendor_name",
      render: (text) => (
        <Input
          value={text}
          onChange={(e) => e.preventDefault()} // Prevent editing
          readOnly
          addonAfter={
            <Button
              onClick={() => navigator.clipboard.writeText(text)}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Copy
            </Button>
          }
        />
      ),
    },
  ];

  if (!isHead) return <div>Unauthorized Access</div>;

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen mt-8">
      <div className={`transition-all duration-300 h-[calc(100vh-4rem)] overflow-auto ${isApproveModalOpen || isRejectModalOpen ? 'backdrop-blur-sm' : ''}`}>
        {!selectedRequest || !mrf_no ? (
          <div
            className="bg-white rounded-xl shadow-lg p-6 overflow-y-auto w-full transform transition-all duration-300 ease-in-out"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-black border-b-2 border-blue-200 pb-2 px-4 w-full whitespace-nowrap">
                  {showPastApproved
                    ? "Past Approved Requests"
                    : "Material Requests Approval"}
                </h2>
              </div>
              <div className="flex items-center gap-4 relative">
                <button
                  onClick={toggleSearchBar}
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <MagnifyingGlassIcon className="h-6 w-6" />
                </button>
                {searchVisible && (
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onPressEnter={handleSearch}
                    onBlur={handleSearch}
                    autoFocus
                    className="w-64"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <Button
                  type="primary"
                  onClick={handleViewToggle}
                  className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {showPastApproved
                    ? "Back to Pending Requests"
                    : "View Past Approved"}
                </Button>
              </div>
            </div>

            {loading && <p className="text-gray-600">Loading...</p>}
            {error && <p className="text-red-500">{error}</p>}
            <Table
              dataSource={requests}
              columns={columns}
              rowKey="key"
              onRow={(record) => ({
                onClick: () => navigate(`/mrf-approval/${record.mrf_no}`),
              })}
              className="w-full table-fixed whitespace-nowrap"
              rowClassName="cursor-pointer hover:bg-blue-100 transition-colors"
              pagination={{ pageSize: 10 }}
            />
          </div>
        ) : (
          <div className="w-full h-[calc(100vh-4rem)] bg-white rounded-xl shadow-lg p-6 overflow-y-auto transition-all duration-300 ease-in-out relative">
            <button
              onClick={() => {
                navigate(mrf_no ? "/mrf-approval" : "/");
                handleCloseDetails();
              }}
              className="absolute top-4 right-4 text-gray-600 hover:text-red-600 transition-colors"
            >
              <XCircleIcon className="h-8 w-8" />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-black border-b-2 border-blue-200 pb-2">
                Material Request Form
              </h2>
              <Dropdown overlay={columnMenu} trigger={['click']}>
                <Button type="default" className="border-blue-600 !bg-amber-600 !text-emerald-50 hover:bg-blue-50 transition-colors mx-7 my-0.5">
                  Customize Columns
                </Button>
              </Dropdown>
            </div>
            {error && (
              <div className="text-red-500 p-4 bg-red-100 rounded-lg mt-4">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <p className="text-md text-gray-800">
                <strong>MRF No.:</strong> {selectedRequest.reference}
              </p>
              <p className="text-md text-gray-800 whitespace-nowrap">
                <strong>Project Name:</strong>{" "}
                {requestDetails.length > 0
                  ? requestDetails[0].project_name || "N/A"
                  : "N/A"}
              </p>
              <p className="text-md text-gray-800">
                <strong>Department:</strong>{" "}
                {requestDetails.length > 0
                  ? requestDetails[0].user_department || "N/A"
                  : "N/A"}
              </p>
              <p className="text-md text-gray-800 whitespace-nowrap">
                <strong>Requested By:</strong> {selectedRequest.requestedBy}
              </p>
            </div>
            <Table
              dataSource={requestDetails}
              columns={detailColumns}
              rowKey="key"
              className="w-full table-fixed"
              rowClassName="hover:bg-blue-100 transition-colors"
              pagination={false}
            />
            {previewItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 p-4 bg-blue-50 rounded-lg"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2">MRF Preview Changes</h3>
                <Table
                  dataSource={previewItems}
                  columns={previewColumns}
                  rowKey="key"
                  className="w-full table-fixed rounded-lg overflow-auto"
                  pagination={false}
                />
              </motion.div>
            )}
            <div className="flex justify-end gap-4 mt-6">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="primary"
                onClick={() => togglePriority(selectedRequest)}
                className={`p-2 rounded-full ${priority ? "bg-red-500" : "bg-green-500"}`}
                disabled={showPastApproved || isCeo}
                style={{ cursor: (showPastApproved || isCeo) ? "default" : "pointer" }}
              >
                <FlagIcon className="h-4 w-4 text-white" />
              </motion.button>
              <button
                onClick={confirmApprove}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={!isHead || showPastApproved || selectedComponentKeys.length === 0}
              >
                Approve Selected
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={!isHead || showPastApproved || selectedComponentKeys.length === 0}
              >
                Reject Selected
              </button>
            </div>
            <ConfirmationModal
              isOpen={isApproveModalOpen}
              onClose={() => setIsApproveModalOpen(false)}
              onConfirm={() => {
                handleApprove();
                setIsApproveModalOpen(false);
              }}
              title="Confirm Approval"
              content="Are you sure you want to approve this request?"
              okText="Yes"
              cancelText="No"
            />
            <ConfirmationModal
              isOpen={isRejectModalOpen}
              onClose={() => {
                setIsRejectModalOpen(false);
                setHighlightNote({});
              }}
              onConfirm={() => {
                handleReject();
                setIsRejectModalOpen(false);
              }}
              title="Confirm Rejection"
              content="Are you sure you want to reject this request?"
              okText="Yes"
              cancelText="No"
            />
            <VendorDetailsModal
              open={isVendorModalOpen}
              onClose={handleCloseVendorModal}
              onSave={handleSaveVendorDetails}
              component={selectedComponent}
              readOnly={!isHeadId3 && (showPastApproved || ["Purchase Approval Pending", "CEO Approval Pending"].includes(selectedComponent?.status || ""))}
            />
            <Modal
              title="Past Purchases"
              open={pastPurchasesModalVisible}
              onCancel={() => setPastPurchasesModalVisible(false)}
              footer={null}
              width={1400}
            >
              {pastPurchasesLoading ? (
                <p>Loading past purchases...</p>
              ) : pastPurchasesData.length > 0 ? (
                <Table
                  dataSource={pastPurchasesData}
                  columns={pastPurchasesColumns}
                  rowKey="key"
                  pagination={false}
                  className="w-full"
                />
              ) : (
                <p>No past purchases found.</p>
              )}
            </Modal>
            <Modal
              title="Previous Vendors"
              open={isPreviousVendorsModalOpen}
              onCancel={() => setIsPreviousVendorsModalOpen(false)}
              footer={null}
            >
              <Table
                dataSource={previousVendors.map((vendor, index) => ({ key: index, vendor_name: vendor }))}
                columns={previousVendorsColumns}
                rowKey="key"
                pagination={false}
              />
            </Modal>
          </div>
        )}
      </div>
    </div>
  );
};

export default MrfApproval;