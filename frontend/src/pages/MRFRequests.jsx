import React, { useState, useEffect } from "react";
import { Table, Input, Button } from "antd";
import { XCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchMyMrfRequests, fetchMyMrfRequestDetails } from "../utils/api";
import VendorDetailsModal from "../components/VendorDetailsModal.jsx";

const MRFRequests = ({ role, permissions }) => {
  const [requests, setRequests] = useState([]);
  const [requestDetails, setRequestDetails] = useState([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const userId = localStorage.getItem("user_id");
  const userRole = role || localStorage.getItem("role") || "employee";
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);

  useEffect(() => {
    const fetchMyMrfRequestsData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMyMrfRequests();
        let mappedRequests = data.map((req, index) => ({
          key: req.mrf_no,
          mrf_no: `${req.mrf_no}`,
          date: req.created_at,
          status: req.status,
          project_name: req.project_name || "N/A",
          note: req.note_head || "N/A",
        }));

        if (searchTerm) {
          mappedRequests = mappedRequests.filter(
            (req) =>
              req.umi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.mrf_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.date?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        setRequests(mappedRequests.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (error) {
        console.error("Fetch My MRF Requests Error:", error);
        setError("Failed to fetch my MRF requests. Please check server connection or database setup.");
        toast.error("Failed to fetch requests. Check console for details.");
      } finally {
        setLoading(false);
      }
    };

    fetchMyMrfRequestsData();
  }, [userId, searchTerm]);

  const handleSelectRequest = async (request) => {
    setSelectedRequest(request);
    try {
      const details = await fetchMyMrfRequestDetails(request.mrf_no);
      if (details.length === 0) {
        setError("No details available for this request.");
        setRequestDetails([]);
        return;
      }
      const updatedDetails = details.map((item, index) => {
        const quantityChangeHistory = Array.isArray(item.quantity_change_history)
          ? item.quantity_change_history.map((change) => ({
              ...change,
              user_name: change.user_name || change.userName || change.username || "Unknown",
            }))
          : [];
        return {
          key: index + 1,
          mrf_id: item.mrf_id,
          component_id: item.component_id,
          part_no: item.part_no || "N/A",
          make: item.make || "N/A",
          description: item.item_description || "N/A",
          mpn: item.mpn || "N/A",
          uom: item.uom || "N/A",
          onHandQty: item.on_hand_quantity || 0,
          requestedQty: item.initial_requested_quantity || 0,
          remark: item.remark || "",
          quantity_change_history: quantityChangeHistory,
          note: item.note || [],
          vendorDetails: {
            vendorName: item.vendor || "",
            vendor_link: item.vendor_link || "",
            approxPrice: item.approx_price || "",
            expected_deliverydate: item.expected_deliverydate || "",
            certificate_desired: item.certificate_desired || false,
          },
        };
      });
      setRequestDetails(updatedDetails);
    } catch (error) {
      console.error("Fetch MRF Request Details Error:", error);
      setError(error.response?.data?.message || "Failed to fetch request details.");
      toast.error("Failed to fetch request details. Check console for details.");
      setRequestDetails([]);
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

  // Handle search input change
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const toggleSearchBar = () => {
    setSearchVisible(!searchVisible);
    if (searchVisible) setSearchTerm("");
  };

  const handleCloseDetails = () => {
    setSelectedRequest(null);
    setRequestDetails([]);
    setIsVendorModalOpen(false);
    setSelectedComponent(null);
    setError(null);
  };

  const formatDate = (dateString) => {
    return DateTime.fromISO(dateString).toFormat("dd/MM/yyyy HH:mm:ss");
  };

  const columns = [
    { title: "MRF No.", dataIndex: "mrf_no", key: "mrf_no" },
    { title: "Date", dataIndex: "date", key: "date", render: (text) => formatDate(text) },
    { title: "Project Name", dataIndex: "project_name", key: "project_name" },
    { title: "Status", dataIndex: "status", key: "status" },
  ];

  const baseDetailColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    { title: "Part No.", dataIndex: "part_no", key: "part_no" },
    { title: "Make", dataIndex: "make", key: "make" },
    { title: "UoM", dataIndex: "uom", key: "uom" },
    { title: "On Hand Qty", dataIndex: "onHandQty", key: "onHandQty" },
    { title: "Requested Qty", dataIndex: "requestedQty", key: "requestedQty" },
  ];

  const vendorDetailsColumn = {
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
  };

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

  const hasQuantityChangeHistory = requestDetails.some(
    (item) => item.quantity_change_history && item.quantity_change_history.length > 0
  );

  const hasRemark = requestDetails.some((item) => item.remark && item.remark.trim());

  const detailColumns = [
    ...baseDetailColumns,
    vendorDetailsColumn,
    ...(hasQuantityChangeHistory ? [quantityChangeHistoryColumn] : []),
    ...(hasRemark ? [remarkColumn] : []),
    
  ];

  return (
    <div className="p-12 bg-gray-100 min-h-screen">
      <div className="flex h-[calc(100vh-4rem)]">
        {!selectedRequest ? (
          <div
            className={`bg-white rounded-xl shadow-lg p-6 overflow-y-auto w-full transform transition-all duration-300 ease-in-out relative`}
          >
            <div className="flex justify-between items-center mb-6 border-b-2 border-blue-200 pb-2 mt-6">
              <h2 className="text-2xl font-bold text-gray-900">
                My MRF Requests
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
           
            {loading && <p className="text-gray-600">Loading...</p>}
            {error && <p className="text-red-600">{error}</p>}
            <Table
              dataSource={requests}
              columns={columns}
              rowKey="key"
              onRow={(record) => ({
                onClick: () => handleSelectRequest(record),
              })}
              className="w-full table-fixed whitespace-nowrap"
              rowClassName="cursor-pointer hover:bg-blue-50 transition-colors"
              pagination={{ pageSize: 20 }}
            />
          </div>
        ) : (
          <div className="w-full bg-white rounded-xl shadow-lg p-6 overflow-y-auto transition-all duration-300 ease-in-out relative">
            <button
              onClick={handleCloseDetails}
              className="absolute top-4 right-4 text-gray-600 hover:text-red-600 transition-colors"
            >
              <XCircleIcon className="h-8 w-8" />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b-2 border-blue-200 pb-2">
              Request Details
            </h2>

            <div className="flex justify-between items-center mb-6">
              <div className="flex space-x-4">
                <p className="text-lg text-gray-800"><strong>MRF No.:</strong> {selectedRequest.mrf_no}</p>
                <p className="text-lg text-gray-800"><strong>Status:</strong> {selectedRequest.status}</p>
              </div>
              <p className="text-lg text-gray-800"><strong>Project Name:</strong> {selectedRequest.project_name}</p>
            </div>
            <Table
              dataSource={requestDetails}
              columns={detailColumns}
              rowKey="key"
              className="w-full table-fixed font"
              rowClassName="hover:bg-blue-50 transition-colors"
              pagination={false}
            />
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Notes</h3>
              {requestDetails.length > 0 && requestDetails[0].note.length === 0 ? (
                <p className="text-gray-500 italic">No notes added yet.</p>
              ) : (
                <div className="space-y-4">
                  {requestDetails.length > 0 && requestDetails[0].note.map((note, index) => {
                    const displayUserName = note.user_name || note.userName || note.username || "Unknown";
                    return (
                      <div
                        key={index}
                        className="p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200"
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium text-gray-800">{displayUserName}</span>
                          <span className="text-sm text-gray-500">
                            {DateTime.fromISO(note.timestamp).toFormat("dd-MM-yy HH:mm:ss")}
                          </span>
                        </div>
                        <p className="text-gray-700">{note.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <VendorDetailsModal
              open={isVendorModalOpen}
              onClose={handleCloseVendorModal}
              onSave={() => {}} // No-op since modal is read-only
              component={selectedComponent}
              readOnly={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MRFRequests;