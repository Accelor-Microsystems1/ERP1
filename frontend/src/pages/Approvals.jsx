import React, { useState, useEffect } from "react";
import { Button, Table, Input, Select } from "antd";
import {
  fetchApprovalRequests,
  fetchPastApprovedRequests,
  fetchRequestDetails,
  approveRequest,
} from "../utils/api.js";

const { Option } = Select;

const Approvals = () => {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [pastApprovedRequests, setPastApprovedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetails, setRequestDetails] = useState([]);
  // const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPastApproved, setShowPastApproved] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [isPastApproved, setIsPastApproved] = useState(false);
  const userRole = localStorage.getItem("role") || "employee";
  const userId = localStorage.getItem("user_id");
  const isHead = userRole.endsWith("_head") || userRole === "admin";
  console.log("User Role:", userRole, "Is Head:", isHead);
  const department = userRole.match(/^(\w+)_(head|employee)$/)?.[1] || "N/A";

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchApprovalRequests();
        const mappedRequests = data.map((req, index) => ({
          key: index + 1,
          reference: `${req.umi}`,
          userName: req.user_name,
          date: req.created_at || req.date,
          status: req.status,
          umi: req.umi,
          userId: req.user_id,
        }));
        setRequests(mappedRequests);
        setFilteredRequests(mappedRequests);
      } catch (error) {
        console.error("Fetch Approval Requests Error:", error);
        setError("Failed to fetch approval requests.");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  useEffect(() => {
    if (filterType === "all") {
      setFilteredRequests(requests);
    } else if (filterType === "own") {
      setFilteredRequests(requests.filter((req) => req.userId === userId));
    } else if (filterType === "employee") {
      setFilteredRequests(requests.filter((req) => req.userId !== userId));
    }
  }, [filterType, requests, userId]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleFetchPastApproved = async () => {
    setLoading(true);
    setError(null);
    setShowPastApproved(true);
    try {
      const data = await fetchPastApprovedRequests();
      setPastApprovedRequests(
        data.map((req, index) => ({
          key: index + 1,
          reference: `${req.umi}`,
          userName: req.user_name,
          date: formatDate(req.created_at),
          status: req.status,
          umi: req.umi,
        }))
      );
    } catch (error) {
      setError("Failed to fetch past approved requests.");
      setPastApprovedRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRequest = async (request) => {
    setSelectedRequest(request);
    setIsPastApproved(request.status ===  new Date(request.date) < new Date());
    try {
      const details = await fetchRequestDetails(request.umi);
      if (details.length === 0) {
        setError("No details available for this request.");
        setRequestDetails([]);
        return;
      }
      setRequestDetails(
        details.map((item, index) => ({
          key: index + 1,
          basket_id: item.basket_id,
          referenceNo: item.component_id,
          description: item.item_description,
          mpn: item.mpn,
          onHandQty: item.on_hand_quantity,
          requestedQty: item.updated_requestedqty ,
          
        }))
      );
      // setNote(details[0]?.note || "");
    } catch (error) {
      console.error("Fetch Request Details Error:", error);
      setError(error.response?.data?.message || "Failed to fetch request details.");
      setRequestDetails([]);
    }
  };

  const handleRequestedQtyChange = (value, key) => {
    if (isPastApproved) return;
    setRequestDetails((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, requestedQty: Number(value) || 0 } : item
      )
    );
  };

  const handleApprove = async () => {
    if (!selectedRequest || isPastApproved) return;

    try {
      const updatedItems = requestDetails.map((item) => ({
        basket_id: item.basket_id,
        updated_requestedqty: item.requestedQty,
        // note: item.note,
      }));
      await approveRequest(selectedRequest.umi, {  updatedItems });
      alert("Request approved successfully!");
      setRequests((prev) =>
        prev.filter((req) => req.umi !== selectedRequest.umi)
      );
      setFilteredRequests((prev) =>
        prev.filter((req) => req.umi !== selectedRequest.umi)
      );
      setSelectedRequest(null);
      setRequestDetails([]);
      // setNote("");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to approve request.");
    }
  };

  const columns = [
    { title: "UMI No.", dataIndex: "reference", key: "reference" },
    { title: "User Name", dataIndex: "userName", key: "userName" },
    { title: "Date", dataIndex: "date", key: "date" },
    { title: "Status", dataIndex: "status", key: "status" },
  ];

  const detailColumns = [
    { title: "S.No", dataIndex: "key", key: "key" },
    { title: "Component Id", dataIndex: "componentId", key: "componentId" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    { title: "On Hand Qty", dataIndex: "onHandQty", key: "onHandQty" },
    {
      title: "Requested Qty",
      dataIndex: "requestedQty",
      key: "requestedQty",
      render: (_, record) =>
        isHead && !isPastApproved ? (
          <Input
            type="number"
            value={record.requestedQty}
            onChange={(e) => handleRequestedQtyChange(e.target.value, record.key)}
            min="0"
            max={record.onHandQty}
            disabled={isPastApproved}
            className="h-12" // Fixed height for input to match row height
          />
        ) : (
          <span className="leading-[48px]">{record.requestedQty}</span> // Ensure text aligns vertically
        ),
    },
  ];

  return (
    <div className="p-6 bg-gray-100 min-h-screen mt-8">
      <div className="flex gap-6 h-[calc(100vh-4rem)]">
        <div className="w-1/2 bg-white rounded-lg shadow-md p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">
              {showPastApproved ? "Past Approved Requests" : "Approval Requests"}
            </h2>
            <div className="flex gap-2">
              {isHead && !showPastApproved && (
                <Select
                  defaultValue="all"
                  style={{ width: 200 }}
                  onChange={(value) => setFilterType(value)}
                >
                  <Option value="all">All Requests</Option>
                  <Option value="own">My Requests</Option>
                  <Option value="employee">Employee Requests</Option>
                </Select>
              )}
              {isHead && !showPastApproved && (
                <Button
                  type="primary"
                  onClick={handleFetchPastApproved}
                  className="bg-blue-500 text-white"
                >
                  View Past Approved
                </Button>
              )}
              {isHead && showPastApproved && (
                <Button
                  type="default"
                  onClick={() => setShowPastApproved(false)}
                  className="bg-gray-500 text-white"
                >
                  Back to Pending Requests
                </Button>
              )}
            </div>
          </div>
          {loading && <p className="text-gray-500">Loading...</p>}
          {error && <p className="text-red-500">{error}</p>}
          <Table
            dataSource={showPastApproved ? pastApprovedRequests : filteredRequests}
            columns={columns}
            rowKey="key"
            onRow={(record) => ({
              onClick: () => handleSelectRequest(record),
              className: "px-2 py-1 text-sm text-center h-6 leading-[24px] overflow-hidden text-ellipsis whitespace-nowrap",
            })}
            className="w-full table-fixed whitespace-nowrap"
            components={{
              table: (props) => (
                <table {...props} className="w-full table-fixed whitespace-nowrap" />
              ),
              header: {
                cell: (props) => (
                  <th {...props} className="h-6 leading-[24px] px-4 text-center" />
                ),
              },
              body: {
                cell: (props) => (
                  <td {...props} className="h-6 leading-[24px] px-4 overflow-hidden text-ellipsis whitespace-nowrap" />
                ),
              },
            }}
          />
        </div>

        {selectedRequest && (
          <div className="w-1/2 bg-white rounded-lg shadow-md p-4 overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Material Issue Form</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <p>
                <strong>UMI No.:</strong> {selectedRequest.reference}
              </p>
              <p>
                <strong>Department:</strong>{" "}
                {department.charAt(0).toUpperCase() + department.slice(1)}
              </p>
              <p>
                <strong>Issued By:</strong> {selectedRequest.userName}
              </p>
            </div>
            <Table
              dataSource={requestDetails}
              columns={detailColumns}
              rowKey="key"
              onRow={() => ({
                className: "h-12 leading-[48px] overflow-hidden text-ellipsis whitespace-nowrap", // Fixed row height with Tailwind
              })}
              className="w-full table-fixed"
              components={{
                table: (props) => (
                  <table {...props} className="w-full table-fixed" />
                ),
                header: {
                  cell: (props) => (
                    <th {...props} className="h-6 leading-[24px] px-4 whitespace-nowrap text-center" />
                  ),
                },
                body: {
                  cell: (props) => (
                    <td {...props} className="h-6 leading-[24px] px-4 overflow-hidden text-ellipsis whitespace-nowrap" />
                  ),
                },
              }}
            />
            {isHead && (
              <div className="flex justify-end gap-4 mt-4">
                <Button
                  type="default"
                  onClick={handleApprove}
                  disabled={isPastApproved}
                  className={`text-white rounded ${
                    isPastApproved
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  Approve
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Approvals;