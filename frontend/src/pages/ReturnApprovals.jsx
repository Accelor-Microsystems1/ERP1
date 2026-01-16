import React, { useState, useEffect } from "react";
import { Table, Input, Button, Switch } from "antd";
import { XCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { fetchReturnRequests, approveReturnRequest, rejectReturnRequest } from "../utils/api";

const ReturnApprovals = ({ role }) => {
  const [requests, setRequests] = useState([]);
  const [searchVisible, setSearchVisible] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetails, setRequestDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [showPastApprovals, setShowPastApprovals] = useState(false);
  const userRole = role || localStorage.getItem("role") || "employee";
  console.log("User role in ReturnApprovals:", userRole);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchReturnRequests(showPastApprovals ? "past" : "pending");
        console.log("Fetched return requests in ReturnApprovals:", data);
        let mappedRequests = data.map((req, index) => {
          console.log("Mapping request:", req);
          return {
            key: index + 1,
            urf_id: req.urf_id || "N/A",
            umi: req.umi || "N/A",
            date: req.created_at || "N/A",
            status: req.status || "Unknown",
            user_name: req.name || req.user_name || "N/A",
            details: {
              component_id: req.component_id || "N/A",
              part_no: req.part_no || "N/A",
              make: req.make || "N/A",
              description: req.item_description || req.description || "N/A",
              mpn: req.mpn || "N/A",
              returnQty: req.return_quantity || 0,
              remark: req.remark || "N/A",
            },
          };
        });
        console.log("Mapped requests:", mappedRequests);
        if (searchTerm) {
          mappedRequests = mappedRequests.filter(
            (req) =>
              req.umi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.urf_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.date?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        setRequests(mappedRequests.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (error) {
        console.error("Fetch Return Requests Error:", error);
        setError(`Failed to fetch return requests: ${error.message}`);
        toast.error(`Failed to fetch return requests: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showPastApprovals, searchTerm]);

  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    setNote("");
    try {
      const updatedDetails = [{
        key: 1,
        component_id: request.details.component_id || "N/A",
        part_no: request.details.part_no || "N/A",
        make: request.details.make || "N/A",
        description: request.details.description || "N/A",
        mpn: request.details.mpn || "N/A",
        returnQty: request.details.returnQty || 0,
        remark: request.details.remark || "N/A",
      }];
      setRequestDetails(updatedDetails);
    } catch (error) {
      console.error("Error setting request details:", error);
      setError(`Failed to load request details: ${error.message}`);
      toast.error(`Failed to load request details: ${error.message}`);
      setRequestDetails([]);
    }
  };

  const handleCloseDetails = () => {
    setSelectedRequest(null);
    setRequestDetails([]);
    setNote("");
    setError(null);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const response = await approveReturnRequest(selectedRequest.urf_id, { note });
      setRequests(prev => prev.map(r => r.urf_id === selectedRequest.urf_id ? { ...r, status: response.status } : r));
      handleCloseDetails();
      toast.success(`Return request ${selectedRequest.urf_id} approved!`);
    } catch (error) {
      console.error("Error approving return request:", error);
      setError(`Failed to approve return request: ${error.message}`);
      toast.error(`Failed to approve return request: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const response = await rejectReturnRequest(selectedRequest.urf_id, { note });
      setRequests(prev => prev.map(r => r.urf_id === selectedRequest.urf_id ? { ...r, status: response.status } : r));
      handleCloseDetails();
      toast.info(`Return request ${selectedRequest.urf_id} rejected.`);
    } catch (error) {
      console.error("Error rejecting return request:", error);
      setError(`Failed to reject return request: ${error.message}`);
      toast.error(`Failed to reject return request: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

// Handle search input change
const handleSearch = (e) => {
  setSearchTerm(e.target.value);
};

const toggleSearchBar = () => {
  setSearchVisible(!searchVisible);
  if (searchVisible) setSearchTerm("");
};

  const formatDate = (dateString) => {
    if (!dateString || dateString === "N/A") return "N/A";
    // Replace space with 'T' to convert to ISO format if needed
    const isoFormattedString = dateString.replace(" ", "T");
    const date = DateTime.fromISO(isoFormattedString, { zone: "UTC" });
    if (!date.isValid) {
      console.error("Invalid date string:", dateString);
      return "Invalid Date";
    }
    // Convert to IST (Indian Standard Time) since the user is in IST
    return date.setZone("Asia/Kolkata").toFormat("dd/MM/yyyy HH:mm:ss");
  };

  const columns = [
    { title: "URF No.", dataIndex: "urf_id", key: "urf_id" },
    { title: "UMI No.", dataIndex: "umi", key: "umi" },
    { title: "Date", dataIndex: "date", key: "date", render: (text) => formatDate(text) },
    { title: "Requested By", dataIndex: "user_name", key: "user_name" },
    { title: "Status", dataIndex: "status", key: "status" },
  ];

  const detailColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    { title: "Part No.", dataIndex: "part_no", key: "part_no" },
    { title: "Make", dataIndex: "make", key: "make" },
    { title: "Return Quantity", dataIndex: "returnQty", key: "returnQty" },
    { title: "Remark", dataIndex: "remark", key: "remark" },
  ];

  return (
    <div className="p-12 bg-gray-100 min-h-screen mt-8">
      
      <div className="flex transition-all duration-500 h-[calc(100vh-4rem)]">
        {!selectedRequest && (
          <div className="bg-white rounded-2xl shadow-xl p-4 overflow-y-auto w-full transform transition-all duration-500 animate-fade-in">

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800  border-b-2 border-blue-300 pb-2">
          {showPastApprovals ? "Past Return Approvals" : "Pending Return Approvals"}
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
                    
        <Switch
          checked={showPastApprovals}
          onChange={() => setShowPastApprovals(!showPastApprovals)}
          checkedChildren="Past Approvals"
          unCheckedChildren="Pending Approvals"
          className="bg-gray-800"
        />

      </div>
            {loading && <p className="text-gray-600 animate-pulse">Loading...</p>}
            {error && <p className="text-red-600 animate-bounce">{error}</p>}
            {!loading && !error && requests.length === 0 && (
              <p className="text-gray-600 text-center">No {showPastApprovals ? "past" : "pending"} return requests found.</p>
            )}
            {requests.length > 0 && (
              <Table
                dataSource={requests}
                columns={columns}
                rowKey="key"
                onRow={(record) => ({
                  onClick: () => handleSelectRequest(record),
                })}
                className="w-full custom-table"
                rowClassName="cursor-pointer hover:bg-gray-50 transition-all duration-300"
              />
            )}
          </div>
        )}
        {selectedRequest && (
          <div className="bg-white rounded-xl shadow-md p-6 overflow-y-auto w-full transform transition-all duration-500 animate-fade-in relative">
            <button
              onClick={handleCloseDetails}
              className="absolute top-4 right-4 text-gray-600 hover:text-red-600 transition-all duration-300 hover:scale-110"
            >
              <XCircleIcon className="h-8 w-8" />
            </button>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Return Request Form
            </h2>
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center mb-4 p-3 rounded-lg bg-gray-50 shadow-sm">
                <div className="flex space-x-4">
                  <p className="text-lg text-gray-700"><strong>URF No.:</strong> {selectedRequest.urf_id}</p>
                  <p className="text-lg text-gray-700"><strong>UMI No.:</strong> {selectedRequest.umi}</p>
                  <p className="text-lg text-gray-700"><strong>Status:</strong> {selectedRequest.status}</p>
                </div>
              </div>
              {requestDetails.length === 0 ? (
                <p className="text-gray-600 text-center">No details available for this request.</p>
              ) : (
                <Table
                  dataSource={requestDetails}
                  columns={detailColumns}
                  rowKey="key"
                  className="w-full custom-table"
                  rowClassName="hover:bg-gray-50 transition-all duration-300"
                  pagination={false}
                />
              )}
              {!showPastApprovals && (
                <div className="mt-4">
                  <Input.TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note for approval/rejection..."
                    rows={4}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
              {!showPastApprovals && (
                <div className="flex justify-end space-x-3 mt-4">
                  <Button
                    onClick={handleApprove}
                    type="primary"
                    className="custom-approve rounded-lg"
                    loading={actionLoading}
                    disabled={actionLoading 
                      // || selectedRequest?.status !== "Return Initiated"
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={handleReject}
                    type="danger"
                    className="custom-reject rounded-lg"
                    loading={actionLoading}
                    disabled={actionLoading 
                      // || selectedRequest?.status !== "Return Initiated"
                    }
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-table :global(.ant-table-thead > tr > th) {
          background-color: #f7fafc;
          color: #2d3748;
          font-weight: 600;
          border-bottom: 2px solid #e2e8f0;
          padding: 12px 16px;
          text-align: left;
        }
        .custom-table :global(.ant-table-tbody > tr > td) {
          padding: 12px 16px;
          color: #4a5568;
          border-bottom: 1px solid #edf2f7;
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ReturnApprovals;