import React, { useState, useEffect } from "react";
import { Table, Button, Input, Modal } from "antd";
import { XCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchMyRequests, fetchMyRequestDetails, fetchMyMrfRequestDetails, submitReturnForm } from "../utils/api";
import io from "socket.io-client";
import VendorDetailsModal from "../components/VendorDetailsModal.jsx";

const MIFRequests = ({ role }) => {
  const [requests, setRequests] = useState([]);
  const [requestDetails, setRequestDetails] = useState([]);
  const [mrfDetails, setMrfDetails] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMrf, setSelectedMrf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quantityErrors, setQuantityErrors] = useState({});
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const userId = localStorage.getItem("user_id");
  const userRole = role || localStorage.getItem("role") || "employee";
  const navigate = useNavigate();
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);

  useEffect(() => {
    const socket = io("https://erp1-iwt1.onrender.com", {
      query: { userId: userId },
    });

    socket.on("connect", () => {
      console.log("Connected to Socket.IO server");
    });

    socket.on("notification", (notification) => {
      console.log("Received notification:", notification);
      toast.info(notification.message, {
        position: "top-right",
        autoClose: 5000,
      });
    });

    socket.on("connect_error", (err) => {
      console.error("Socket.IO connection error:", err);
    });

    return () => {
      socket.disconnect();
      console.log("Disconnected from Socket.IO server");
    };
  }, [userId]);

  useEffect(() => {
    const fetchMyRequestsData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMyRequests();
        let mappedRequests = data.map((req, index) => ({
          key: index + 1,
          reference: req.umi,
          issue_date: req.issue_date,
          date: req.date,
          status: req.status || "Unknown",
          umi: req.umi,
          project_name: req.project_name || "N/A",
          mrf_no: req.mrf_no || "No MRF",
        }));

        if (searchTerm) {
          mappedRequests = mappedRequests.filter(
            (req) =>
              req.umi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.mrf_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.date?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (req.issue_date ? formatDate(req.issue_date, true)?.toLowerCase().includes(searchTerm.toLowerCase()) : false)
          );
        }

        setRequests(mappedRequests.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (error) {
        console.error("Fetch My Requests Error:", error);
        setError("Failed to fetch requests.");
        toast.error("Failed to fetch requests.");
      } finally {
        setLoading(false);
      }
    };
    fetchMyRequestsData();
  }, [userId, searchTerm]);

  const handleSelectRequest = async (request) => {
    setSelectedRequest(request);
    setSelectedMrf(null);
    setRequestDetails([]);
    setQuantityErrors({});
    setError(null);
    try {
      if (!request.umi) {
        throw new Error("Invalid UMI: UMI is undefined or empty");
      }
      const details = await fetchMyRequestDetails(request.umi);
      if (!Array.isArray(details)) {
        throw new Error("Expected an array of request details, but received: " + JSON.stringify(details));
      }
      const updatedDetails = details.map((item, index) => {
        const isReturnInitiated = item.return_status === "Return Initiated";
        const receivedQty = item.received_quantity || item.issued_quantity || 0;
        const returnStatus = item.return_status || "Not Initiated";
        console.log(`Item ${index} for UMI ${request.umi}:`, {
          receivedQty,
          returnStatus,
          requestStatus: request.status,
          issuedQty: item.issued_quantity,
          receivedQuantityRaw: item.received_quantity
        });
        return {
          key: index + 1,
          basket_id: item.basket_id || null,
          part_no: item.part_no || "N/A",
          make: item.make || "N/A",
          description: item.item_description || "N/A",
          mpn: item.mpn || "N/A",
          uom: item.uom || "N/A",
          onHandQty: item.on_hand_quantity || 0,
          initialRequestedQty: item.initial_requestedqty || 0,
          headrequestedQty: item.updated_requestedqty || 0,
          issuedQty: item.issued_quantity || 0,
          receivedQty: receivedQty,
          head_remark: item.head_remark || "N/A",
          inventory_remark: item.inventory_remark || "N/A",
          return_remark: item.return_remark || "N/A",
          mrf_no: item.mrf_no || "N/A",
          mrr_no: item.mrr_no || null,
          component_id: item.component_id,
          returnQty: item.return_quantity || 0,
          reasonForReturn: item.return_remark && item.return_remark !== "N/A" ? item.return_remark : "",
          isReturnInitiated: isReturnInitiated,
          returnStatus: returnStatus,
          head_note: item.head_note?.length > 0 ? item.head_note[0].content : "N/A",
          inventory_note: item.inventory_note?.length > 0 ? item.inventory_note[0].content : "N/A",
        };
      });
      setRequestDetails(updatedDetails);
    } catch (error) {
      console.error("Fetch Request Details Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setError(error.response?.data?.error || "Failed to fetch request details.");
      toast.error(error.response?.data?.error || "Failed to fetch request details.");
    }
  };

  const handleSelectMrf = async (mrfNo) => {
    setSelectedMrf({ mrf_no: mrfNo });
    setMrfDetails([]);
    setError(null);
    try {
      const details = await fetchMyMrfRequestDetails(mrfNo);
      const updatedDetails = details.map((item, index) => ({
        key: index + 1,
        mrf_id: item.mrf_id,
        part_no: item.part_no || "N/A",
        make: item.make || "N/A",
        description: item.item_description || "N/A",
        mpn: item.mpn || "N/A",
        issue_date: item.issue_date,
        onHandQty: item.on_hand_quantity || 0,
        initial_requestedQty: item.initial_requested_quantity || 0,
        updated_requestedQty: item.updated_requested_quantity || null,
        quantity_change_history: item.quantity_change_history || [],
        status: item.status || "N/A",
        project_name: item.project_name || "N/A",
        notemrf_head: item.note?.length > 0 ? item.note[0].content : "N/A",
        remark: item.remark || "N/A",
        vendorDetails: {
          vendorName: item.vendor || "",
          vendor_link: item.vendor_link || "",
          approxPrice: item.approx_price || "",
          expected_deliverydate: item.expected_deliverydate || "",
          certificate_desired: item.certificate_desired || false,
        },
      }));
      setMrfDetails(updatedDetails);
    } catch (error) {
      console.error("Fetch MRF Request Details Error:", error);
      setError("Failed to fetch MRF details.");
      toast.error("Failed to fetch MRF details.");
    }
  };

  const handleOpenVendorModal = (component) => {
    setSelectedComponent(component);
    setIsVendorModalOpen(true);
  };

  const handleCloseVendorModal = () => {
    setIsVendorModalOpen(false);
    setSelectedComponent(null);
  };

  const handleCloseDetails = () => {
    setSelectedRequest(null);
    setRequestDetails([]);
    setSelectedMrf(null);
    setMrfDetails([]);
    setIsVendorModalOpen(false);
    setSelectedComponent(null);
    setQuantityErrors({});
    setError(null);
    setIsCancelModalOpen(false);
    setCancelReason("");
  };

  const handleCancelRequest = () => {
    setIsCancelModalOpen(true);
  };

  const handleCancelModalOk = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation.");
      return;
    }

    try {
      await fetch(`https://erp1-iwt1.onrender.com/api/nc-requests/cancel/${selectedRequest.umi}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: cancelReason, status: "Request Cancelled" }),
      });

      setRequests(prev =>
        prev.map(r =>
          r.umi === selectedRequest.umi ? { ...r, status: "Request Cancelled" } : r
        )
      );
      toast.success(`Request ${selectedRequest.umi} has been cancelled successfully!`);
      handleCloseDetails();
    } catch (error) {
      console.error("Error cancelling request:", error);
      setError("Failed to cancel request.");
      toast.error("Failed to cancel request.");
    }
  };

  const handleCancelModalCancel = () => {
    setIsCancelModalOpen(false);
    setCancelReason("");
  };

  const handleAccept = async () => {
    if (!selectedRequest) return;

    const invalidItems = requestDetails.filter(item => item.receivedQty !== item.issuedQty);
    if (invalidItems.length > 0) {
      toast.error("All received quantities must match the issued quantities before approving.");
      return;
    }

    try {
      const updatedItems = requestDetails.map(item => ({
        umi: selectedRequest.umi,
        component_id: item.component_id,
        received_quantity: parseInt(item.receivedQty) || 0,
      }));
      await fetch(`https://erp1-iwt1.onrender.com/api/nc-requests/confirm-receipt/${selectedRequest.umi}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: updatedItems }),
      });
      const data = await fetchMyRequests();
      const mappedRequests = data.map((req, index) => ({
        key: index + 1,
        reference: req.umi,
        date: req.date,
        issue_date: req.issue_date,
        status: req.status || "Unknown",
        umi: req.umi,
        project_name: req.project_name || "N/A",
        mrf_no: req.mrf_no || "No MRF",
      }));
      setRequests(mappedRequests.sort((a, b) => new Date(b.date) - new Date(a.date)));
      handleCloseDetails();
      toast.success(`Request ${selectedRequest.umi} accepted!`);
    } catch (error) {
      console.error("Error accepting request:", error);
      setError("Failed to accept request.");
      toast.error("Failed to accept request.");
    }
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    setRequests(prev =>
      prev.map(r =>
        r.umi === selectedRequest.umi ? { ...r, status: "Re-Approval Pending" } : r
      )
    );
    handleCloseDetails();
    toast.info(`Request ${selectedRequest.umi} rejected.`);
  };

  const handleUpdateDetail = (index, field, value) => {
    if (selectedRequest?.status !== "Receiving Pending") return;
    setRequestDetails(prev => {
      const newDetails = prev.map((item, i) => {
        if (i !== index) return item;
        if (field !== "receivedQty") {
          return { ...item, [field]: value };
        }

        const issuedQty = item.issuedQty;
        const newValue = parseInt(value) || 0;
        let errorMessage = null;

        if (newValue > issuedQty) {
          errorMessage = "Receiving Quantity can't be exceeded";
        } else if (newValue < issuedQty) {
          errorMessage = "Receiving Quantity can't be decreased";
        }

        setQuantityErrors(prevErrors => ({
          ...prevErrors,
          [index]: errorMessage,
        }));

        if (errorMessage) {
          return item;
        }

        return { ...item, receivedQty: newValue };
      });
      return newDetails;
    });
  };

  const handleInitiateReturn = (componentId) => {
    console.log(`Initiating return for component_id: ${componentId}`);
    setRequestDetails(prev => {
      const newDetails = prev.map(item => {
        if (item.component_id === componentId) {
          return {
            ...item,
            isReturnInitiated: true,
            returnStatus: "Return Initiated",
            returnQty: 0,
            reasonForReturn: item.return_remark && item.return_remark !== "N/A" ? item.return_remark : "",
          };
        }
        return item;
      });
      console.log("Updated requestDetails after initiating return:", newDetails);
      return newDetails;
    });
  };

  const handleUpdateReturn = (componentId, field, value) => {
    console.log(`Updating ${field} for component_id: ${componentId} with value: ${value}`);
    setRequestDetails(prev => {
      const newDetails = prev.map(item => {
        if (item.component_id === componentId) {
          const updatedValue = field === "returnQty" ? Math.min(parseInt(value) || 0, item.receivedQty) : (value || "");
          return {
            ...item,
            [field]: updatedValue,
          };
        }
        return item;
      });
      console.log("Updated requestDetails after updating return:", newDetails);
      return newDetails;
    });
  };

  const handleDeleteItem = (componentId) => {
    console.log(`Deleting return for component_id: ${componentId}`);
    setRequestDetails(prev => {
      const newDetails = prev.map(item => {
        if (item.component_id === componentId) {
          return {
            ...item,
            isReturnInitiated: false,
            returnQty: 0,
            reasonForReturn: "",
            returnStatus: "Not Initiated",
          };
        }
        return item;
      });
      console.log("Updated requestDetails after deleting return:", newDetails);
      return newDetails;
    });
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const toggleSearchBar = () => {
    setSearchVisible(!searchVisible);
    if (searchVisible) setSearchTerm("");
  };

  const handleSubmitReturn = async () => {
    console.log("Submitting return form...");
    const returnItems = requestDetails.filter(
      item => item.isReturnInitiated && item.returnQty > 0
    );
    console.log("Return items to submit:", returnItems);
    if (!returnItems.length) {
      console.log("Validation failed: No items with return quantity > 0");
      toast.error("Please specify a return quantity for at least one item.");
      return;
    }
    const invalidItems = returnItems.filter(item => !item.reasonForReturn || item.reasonForReturn.trim() === "");
    if (invalidItems.length > 0) {
      console.log("Validation failed: Missing reason for return in items:", invalidItems);
      toast.error("Reason for Return is mandatory for all items with a return quantity.");
      return;
    }
    try {
      const urfNo = `URF-${DateTime.now().toFormat("yyyyMMddHHmmss")}`;
      const itemsToSubmit = returnItems.map(item => ({
        urf_id: urfNo,
        umi: selectedRequest.umi,
        component_id: item.component_id,
        return_quantity: item.returnQty,
        remark: item.reasonForReturn,
        status: "Return Initiated",
      }));
      console.log("Submitting return with items:", itemsToSubmit);
      await submitReturnForm(itemsToSubmit, urfNo);
      setRequestDetails(prev =>
        prev.map(item =>
          returnItems.find(returnItem => returnItem.component_id === item.component_id)
            ? { ...item, isReturnInitiated: false, returnStatus: "Return Initiated" }
            : item
        )
      );
      toast.success("Return request submitted successfully!");
      handleCloseDetails();
    } catch (error) {
      console.error("Error submitting return form:", error);
      toast.error("Failed to submit return request.");
    }
  };

  const formatDate = (dateString, dateOnly = false) => {
    if (!dateString || dateString === "N/A") return "N/A";
    const format = dateOnly ? "dd/MM/yyyy" : "dd/MM/yyyy HH:mm:ss";
    return DateTime.fromISO(dateString).toFormat(format);
  };

  const formatQuantityChangeHistory = (history) => {
    if (!Array.isArray(history) || history.length === 0) {
      return "No changes recorded";
    }
    return (
      <div>
        {history.map((entry, index) => (
          <div key={index}>
            {`Changed from ${entry.old_quantity} to ${entry.new_quantity} by ${entry.user_name} on ${DateTime.fromISO(entry.timestamp).toFormat("dd/MM/yyyy HH:mm:ss")}`}
          </div>
        ))}
      </div>
    );
  };

  const renderCell = (value) => {
    if (value === null || value === undefined || value === "" || value === "N/A") {
      return "-";
    }
    return value;
  };

  const shouldDisplayColumn = (data, dataIndex) => {
    return data.some(item => {
      const value = item[dataIndex];
      return value !== null && value !== undefined && value !== "" && value !== "N/A";
    });
  };

  const columns = [
    { title: "UMI No.", dataIndex: "reference", key: "reference", render: renderCell },
    { title: "MRF No.", dataIndex: "mrf_no", key: "mrf_no", render: renderCell },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (text) => renderCell(formatDate(text)),
    },
    { title: "Project Name", dataIndex: "project_name", key: "project_name", render: renderCell },
    { title: "Status", dataIndex: "status", key: "status", render: renderCell },
    {
      title: "Issue Date",
      dataIndex: "issue_date",
      key: "issue_date",
      render: (text) => renderCell(formatDate(text, true)),
    },
  ];

  const detailColumnsBase = [
    { title: "S.No", dataIndex: "key", key: "key", render: renderCell },
    { title: "Description", dataIndex: "description", key: "description", render: renderCell },
    { title: "MPN", dataIndex: "mpn", key: "mpn", render: renderCell },
    { title: "Part No.", dataIndex: "part_no", key: "part_no", render: renderCell },
    { title: "Make", dataIndex: "make", key: "make", render: renderCell },
    { title: "UoM", dataIndex: "uom", key: "uom", render: renderCell },
    { title: "On Hand Qty", dataIndex: "onHandQty", key: "onHandQty", render: renderCell },
    {
      title: "Initial Requested Qty",
      dataIndex: "initialRequestedQty",
      key: "initialRequestedQty",
      render: renderCell,
    },
  ].filter(column => column.dataIndex === "key" || shouldDisplayColumn(requestDetails, column.dataIndex));

  const detailColumnsHead = [
    ...detailColumnsBase,
    {
      title: "Head Requested Qty",
      dataIndex: "headrequestedQty",
      key: "headrequestedQty",
      render: renderCell,
    },
    {
      title: "Head's Remark",
      dataIndex: "head_remark",
      key: "head_remark",
      render: (text) => (text && text !== "N/A" ? renderCell(text) : null),
    },
  ].filter(column => column.dataIndex === "key" || column.dataIndex !== "head_remark" || shouldDisplayColumn(requestDetails, column.dataIndex));

  const receivingPendingColumns = [
    ...detailColumnsBase,
    {
      title: "Head Requested Qty",
      dataIndex: "headrequestedQty",
      key: "headrequestedQty",
      render: renderCell,
    },
    {
      title: "Head's Remark",
      dataIndex: "head_remark",
      key: "head_remark",
      render: (text) => (text && text !== "N/A" ? renderCell(text) : null),
    },
    { title: "Issued Qty", dataIndex: "issuedQty", key: "issuedQty", render: renderCell },
    {
      title: "Received Qty",
      dataIndex: "receivedQty",
      key: "receivedQty",
      render: (text, record, index) =>
        selectedRequest?.status === "Receiving Pending" ? (
          <div>
            <Input
              type="number"
              value={text}
              onChange={(e) => handleUpdateDetail(index, "receivedQty", e.target.value)}
              min={0}
              max={record.issuedQty}
              style={{ width: 80 }}
              placeholder="0"
            />
            {quantityErrors[index] && (
              <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
                {quantityErrors[index]}
              </div>
            )}
          </div>
        ) : (
          renderCell(text || 0)
        ),
    },
    {
      title: "Inventory Remark",
      dataIndex: "inventory_remark",
      key: "inventory_remark",
      render: (text) => (text && text !== "N/A" ? renderCell(text) : null),
    },
  ].filter(column => column.dataIndex === "key" || (column.dataIndex !== "head_remark" && column.dataIndex !== "inventory_remark") || shouldDisplayColumn(requestDetails, column.dataIndex));

  const issuedColumns = [
    ...detailColumnsBase,
    {
      title: "Head Requested Qty",
      dataIndex: "headrequestedQty",
      key: "headrequestedQty",
      render: renderCell,
    },
    {
      title: "Head's Remark",
      dataIndex: "head_remark",
      key: "head_remark",
      render: (text) => (text && text !== "N/A" ? renderCell(text) : null),
    },
    { title: "Issued Qty", dataIndex: "issuedQty", key: "issuedQty", render: renderCell },
    {
      title: "Received Qty",
      dataIndex: "receivedQty",
      key: "receivedQty",
      render: (text) => renderCell(text || 0),
    },
    {
      title: "Inventory Remark",
      dataIndex: "inventory_remark",
      key: "inventory_remark",
      render: (text) => (text && text !== "N/A" ? renderCell(text) : null),
    },
    {
      title: "Return Status",
      dataIndex: "returnStatus",
      key: "returnStatus",
      render: renderCell,
    },
    {
      title: "Return Remark",
      dataIndex: "return_remark",
      key: "return_remark",
      render: (text) => (text && text !== "N/A" ? renderCell(text) : null),
    },
    {
      title: "Action",
      key: "initiateReturn",
      render: (_, record) => {
        const canInitiate = record.receivedQty > 0 && selectedRequest?.status === "Issued" && record.returnStatus === "Not Initiated";
        console.log(`Checking if "Initiate Return" button should render for component_id ${record.component_id}:`, {
          receivedQty: record.receivedQty,
          requestStatus: selectedRequest?.status,
          returnStatus: record.returnStatus,
          canInitiate,
        });
        return canInitiate ? (
          <Button
            type="primary"
            danger
            onClick={() => handleInitiateReturn(record.component_id)}
          >
            Initiate Return
          </Button>
        ) : null;
      },
    },
    {
      title: "Return Quantity",
      dataIndex: "returnQty",
      key: "returnQty",
      render: (text, record) =>
        record.isReturnInitiated ? (
          <Input
            type="number"
            value={text}
            onChange={(e) => handleUpdateReturn(record.component_id, "returnQty", e.target.value)}
            min={0}
            max={record.receivedQty}
            style={{ width: 80 }}
            placeholder="0"
          />
        ) : (
          renderCell(text || 0)
        ),
    },
    {
      title: "Reason for Return",
      dataIndex: "reasonForReturn",
      key: "reasonForReturn",
      render: (text, record) =>
        record.isReturnInitiated ? (
          <Input
            value={text || ""}
            onChange={(e) => handleUpdateReturn(record.component_id, "reasonForReturn", e.target.value)}
            style={{ width: 160 }}
            placeholder="Enter reason (mandatory)"
            required
          />
        ) : (
          (text && text !== "N/A" ? renderCell(text) : null)
        ),
    },
    {
      title: "Delete",
      key: "delete",
      render: (_, record) =>
        record.isReturnInitiated ? (
          <Button
            type="primary"
            danger
            onClick={() => handleDeleteItem(record.component_id)}
          >
            Delete
          </Button>
        ) : null,
    },
  ].filter(column => column.dataIndex === "key" || !column.dataIndex || (column.dataIndex !== "head_remark" && column.dataIndex !== "inventory_remark") || shouldDisplayColumn(requestDetails, column.dataIndex));

  const mrfDetailColumns = [
    { title: "S.No", dataIndex: "key", key: "key", render: renderCell },
    { title: "Description", dataIndex: "description", key: "description", render: renderCell },
    { title: "MPN", dataIndex: "mpn", key: "mpn", render: renderCell },
    { title: "Part No.", dataIndex: "part_no", key: "part_no", render: renderCell },
    { title: "Make", dataIndex: "make", key: "make", render: renderCell },
    { title: "On Hand Qty", dataIndex: "onHandQty", key: "onHandQty", render: renderCell },
    {
      title: "Initial Requested Qty",
      dataIndex: "initial_requestedQty",
      key: "initial_requestedQty",
      render: renderCell,
    },
    {
      title: "Vendor Details",
      key: "vendorDetails",
      render: (_, record) =>
        record.vendorDetails?.vendorName ? (
          <Button
            type="primary"
            onClick={() => handleOpenVendorModal(record)}
          >
            View Vendor Details
          </Button>
        ) : null,
    },
    {
      title: "Updated Quantity",
      dataIndex: "updated_requestedQty",
      key: "updated_requestedQty",
      render: (text) => (text !== null ? renderCell(text) : null),
    },
    {
      title: "Quantity Change History",
      dataIndex: "quantity_change_history",
      key: "quantity_change_history",
      render: (text, record) => (record.updated_requestedQty !== null ? formatQuantityChangeHistory(text) : null),
    },
  ].filter(column => column.dataIndex === "key" || !column.dataIndex || shouldDisplayColumn(mrfDetails, column.dataIndex));

  const dynamicDetailColumns = (() => {
    const hasMrrNo = requestDetails.some(item => item.mrr_no && item.mrr_no !== "N/A");
    const mrrNoColumn = hasMrrNo ? [{
      title: "MRR No.",
      dataIndex: "mrr_no",
      key: "mrr_no",
      render: (text) => (text && text !== "N/A" ? renderCell(text) : null),
    }].filter(column => shouldDisplayColumn(requestDetails, column.dataIndex)) : [];

    switch (selectedRequest?.status) {
      case 'Head Approval Pending':
        return [...detailColumnsBase, ...mrrNoColumn];
      case 'Inventory Approval Pending':
        return [...detailColumnsHead, ...mrrNoColumn];
      case 'Receiving Pending':
        return [...receivingPendingColumns, ...mrrNoColumn];
      case 'Issued':
        return [...issuedColumns, ...mrrNoColumn];
      default:
        return [...detailColumnsBase, ...mrrNoColumn];
    }
  })();

  return (
    <div className="p-12 bg-gray-100 min-h-screen">
      <div className="flex h-[calc(100vh-4rem)]">
        {!selectedRequest && !selectedMrf && (
          <div className="bg-white rounded-xl shadow-md p-6 overflow-y-auto w-full">
            <div className="flex justify-between items-center mb-6 border-b-2 border-blue-200 pb-2 mt-6">
              <h2 className="text-2xl font-bold text-gray-900">
                My MIF Requests
              </h2>
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
                        placeholder="Search via UMI, MRF, Status, or Project Name"
                        value={searchTerm}
                        onChange={handleSearch}
                        autoFocus
                        className="w-64 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {loading && <p>Loading...</p>}
            {error && <p className="text-red-600">{error}</p>}
            <Table
              dataSource={requests}
              columns={columns}
              rowKey="key"
              onRow={(record) => ({
                onClick: () => handleSelectRequest(record),
              })}
              className="w-full"
              rowClassName="cursor-pointer hover:bg-gray-50"
            />
          </div>
        )}
        {selectedRequest && (
          <div className="flex w-full space-x-4">
            <div
              className={`bg-white rounded-xl shadow-md p-6 overflow-y-auto ${
                selectedMrf ? "w-1/2" : "w-full"
              } relative`}
            >
              <button
                onClick={handleCloseDetails}
                className="absolute top-4 right-4 text-gray-600 hover:text-red-600 transition-all duration-300 hover:scale-110"
              >
                <XCircleIcon className="h-8 w-8" />
              </button>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                Material Issue Form
              </h2>
              <div className="flex flex-col space-y-4">
                <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex space-x-4">
                    <p>
                      <strong>UMI No.:</strong> {selectedRequest.reference}
                    </p>
                    <p>
                      <strong>Status:</strong> {selectedRequest.status}
                    </p>
                  </div>
                  <p>
                    <strong>Project Name:</strong> {selectedRequest.project_name}
                  </p>
                </div>
                <Table
                  dataSource={requestDetails
                    .filter(item => item.initialRequestedQty > 0)
                    .map((item, index) => ({
                      ...item,
                      key: index + 1,
                    }))
                  }
                  columns={dynamicDetailColumns}
                  rowKey="component_id"
                  className="w-full"
                  pagination={false}
                />
                <div className="flex justify-between items-center mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex flex-col space-y-2">
                    {requestDetails.some(item => item.head_note && item.head_note !== "N/A") && (
                      <p>
                        <strong>Head's Note:</strong> {requestDetails.find(item => item.head_note && item.head_note !== "N/A")?.head_note}
                      </p>
                    )}
                    {requestDetails.some(item => item.inventory_note && item.inventory_note !== "N/A") && (
                      <p>
                        <strong>Inventory Note:</strong> {requestDetails.find(item => item.inventory_note && item.inventory_note !== "N/A")?.inventory_note}
                      </p>
                    )}
                  </div>
                  <div className="space-x-3">
                    {selectedRequest.status === "Head Approval Pending" && (
                      <Button
                        type="primary"
                        danger
                        onClick={handleCancelRequest}
                      >
                        Cancel Request
                      </Button>
                    )}
                    {selectedRequest.status === "Receiving Pending" && (
                      <>
                        <Button
                          type="primary"
                          onClick={handleAccept}
                        >
                          Approve
                        </Button>
                        <Button
                          type="primary"
                          danger
                          onClick={handleReject}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {selectedRequest.status === "Issued" && (
                      <>
                        <Button
                          type="primary"
                          onClick={handleSubmitReturn}
                        >
                          Submit Return
                        </Button>
                        <Button
                          onClick={handleCloseDetails}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {requestDetails.some((item) => item.mrf_no !== "N/A") && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <p>
                      MRF generated for this MIF:{" "}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const firstMrf = requestDetails.find((item) => item.mrf_no !== "N/A");
                          handleSelectMrf(firstMrf.mrf_no);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        View MRF Details
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
            {selectedMrf && (
              <div className="bg-white rounded-xl shadow-md p-6 overflow-y-auto w-1/2 relative">
                <button
                  onClick={handleCloseDetails}
                  className="absolute top-4 right-4 text-gray-600 hover:text-red-600 transition-all duration-300 hover:scale-110"
                >
                  <XCircleIcon className="h-8 w-8" />
                </button>
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                  Material Request Form
                </h2>
                <div className="flex flex-col space-y-4">
                  <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex space-x-4">
                      <p>
                        <strong>MRF No.:</strong> {selectedMrf.mrf_no}
                      </p>
                      <p>
                        <strong>Status:</strong> {mrfDetails[0]?.status || "N/A"}
                      </p>
                    </div>
                    <p>
                      <strong>Project Name:</strong> {mrfDetails[0]?.project_name || "N/A"}
                    </p>
                  </div>
                  <Table
                    dataSource={mrfDetails}
                    columns={mrfDetailColumns}
                    rowKey="key"
                    className="w-full"
                    pagination={false}
                  />
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    {mrfDetails[0]?.notemrf_head && mrfDetails[0]?.notemrf_head !== "N/A" && (
                      <p>
                        <strong>Note:</strong> {mrfDetails[0]?.notemrf_head}
                      </p>
                    )}
                    {mrfDetails[0]?.remark && mrfDetails[0]?.remark !== "N/A" && (
                      <p>
                        <strong>Remark:</strong> {mrfDetails[0]?.remark}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <VendorDetailsModal
          open={isVendorModalOpen}
          onClose={handleCloseVendorModal}
          onSave={() => {}}
          component={selectedComponent}
          readOnly={true}
        />
        <Modal
          title="Cancel Request"
          open={isCancelModalOpen}
          onOk={handleCancelModalOk}
          onCancel={handleCancelModalCancel}
          okText="Confirm Cancellation"
          cancelText="Close"
        >
          <p>Please provide a reason for cancelling the request:</p>
          <Input.TextArea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason for cancellation (mandatory)"
            rows={4}
            required
          />
        </Modal>
      </div>
    </div>
  );
};

export default MIFRequests;