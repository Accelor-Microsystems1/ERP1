import React, { useState, useEffect } from "react";
import { Button, Table, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { DateTime } from "luxon";
import { fetchRejectedMrfRequests } from "../utils/api";

const MrfRejected = ({ role }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const navigate = useNavigate();
  const userRole = role || localStorage.getItem("role") || "employee";
  console.log("MrfRejected - Role being used:", userRole);
  const isHead = userRole.endsWith("_head") || userRole === "admin" || userRole === "ceo";
  console.log("MrfRejected - isHead:", isHead);

  useEffect(() => {
    if (!isHead) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRejectedMrfRequests(
          filterDate ? { date: filterDate } : {}
        );

        let filteredRequests = data;
        if (searchTerm) {
          filteredRequests = filteredRequests.filter(
            (req) =>
              req.mrf_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (req.name &&
                req.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (req.date &&
                req.date.toLowerCase().includes(searchTerm.toLowerCase())) ||
              req.status?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        const uniqueRequests = Array.from(
          new Map(filteredRequests.map((req) => [req.mrf_no, req])).values()
        );
        const sortedRequests = [...uniqueRequests].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        setRequests(
          sortedRequests.map((req, index) => ({
            ...req,
            key: index + 1,
            reference: req.mrf_no,
            project_name: req.project_name || "N/A",
            requestedBy: req.name || "Unknown",
            date: req.date
              ? DateTime.fromISO(req.date).toFormat("dd-MM-yy HH:mm:ss")
              : "N/A",
            status: req.status || "Rejected",
          }))
        );
      } catch (error) {
        console.error("Fetch Error Details:", {
          message: error.message,
          response: error.response?.data,
        });
        setError(error.message || "Failed to fetch rejected requests.");
        message.error(error.message || "Failed to fetch rejected requests.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isHead, searchTerm, filterDate]);

  const toggleSearchBar = () => {
    setSearchVisible(!searchVisible);
    if (searchVisible) setSearchTerm("");
  };

  const handleSearch = (e) => {
    if (e.key === "Enter" || e.type === "click") {
      setSearchTerm(e.target.value);
    }
  };

  const columns = [
    { title: "MRF No.", dataIndex: "reference", key: "reference" },
    { title: "Requested By", dataIndex: "requestedBy", key: "requestedBy" },
    { title: "Date", dataIndex: "date", key: "date" },
    { title: "Project Name", dataIndex: "project_name", key: "project_name" },
    { title: "Status", dataIndex: "status", key: "status" },
  ];

  if (!isHead) {
    return <div className="text-red-500 p-4">Unauthorized Access</div>;
  }

  return (
    <div className="p-18 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 border-b-2 border-red-300 pb-2">
            Rejected MRF Requests
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSearchBar}
              className="text-gray-600 hover:text-red-600 transition-colors"
              aria-label="Toggle search"
            >
              <MagnifyingGlassIcon className="h-6 w-6" />
            </button>
            {searchVisible && (
              <Input
                placeholder="Search by MRF No., Requested By, Date, or Status"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onPressEnter={handleSearch}
                onBlur={handleSearch}
                autoFocus
                className="w-80 rounded-lg border-gray-300"
              />
            )}
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-48 rounded-lg border-gray-300"
              placeholder="Filter by Date"
            />
            <Button
              type="default"
              onClick={() => navigate("/mrf-approval")}
              className="border-red-500 text-red-500 hover:bg-red-50 transition-colors"
            >
              Back to MRF Approval
            </Button>
          </div>
        </div>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && (
          <p className="text-red-500 bg-red-100 p-2 rounded mb-4">{error}</p>
        )}
        <Table
          dataSource={requests}
          columns={columns}
          rowKey="key"
          onRow={(record) => ({
            onClick: () => navigate(`/mrf-approval/${record.mrf_no}`),
          })}
          className="w-full table-fixed rounded-lg overflow-hidden"
          rowClassName="cursor-pointer hover:bg-red-50 transition-colors"
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: "No rejected MRF requests found.",
          }}
        />
      </div>
    </div>
  );
};

export default MrfRejected;