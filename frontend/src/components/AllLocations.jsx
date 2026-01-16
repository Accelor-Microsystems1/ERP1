import React, { useState, useEffect } from "react";
import { Table, Button, message } from "antd";
import { useNavigate } from "react-router-dom";
import { fetchAllLocations } from "../utils/api"; // Import the new function

const AllLocations = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLocationsData();
  }, []);

  const fetchLocationsData = async () => {
    setLoading(true);
    try {
      const data = await fetchAllLocations();
      setLocations(data);
    } catch (error) {
      console.error("Error in fetchLocationsData:", error);
      if (error.response?.status === 404) {
        message.error("The requested endpoint was not found on the server. Please check the server configuration.");
      } else if (error.response?.status === 401) {
        message.error("Unauthorized: Please log in to view locations.");
      } else {
        message.error("Failed to fetch locations: " + (error.response?.data?.error || error.message));
      }
      setLocations([]); // Reset locations to avoid rendering issues
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
        title: "S.No.",
        key: "serialNumber",
        render: (text, record, index) => index + 1, // Serial number starts from 1
      },
    
    {
      title: "Path",
      dataIndex: "path",
      key: "path",
      render: (text) => text || "N/A",
    },
    {
      title: "Created At",
      dataIndex: "created_at",
      key: "created_at",
      render: (created_at) => (created_at ? new Date(created_at).toLocaleString() : "N/A"),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-100 to-purple-100 p-8 mt-8">
      <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              icon={<span>←</span>}
              onClick={() => navigate("/locations")}
              className="mr-4 text-gray-600 hover:text-blue-600 transition-colors duration-300"
            />
            <h2 className="text-4xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-500 bg-clip-text text-transparent animate-pulse">
              All Locations
            </h2>
          </div>
          <Button
            type="primary"
            onClick={() => navigate("/create-location")}
            className="bg-purple-600 hover:bg-purple-700 text-white transition-all duration-300 transform hover:scale-105"
          >
            Create New Location
          </Button>
        </div>
        <div className="bg-white shadow-2xl rounded-xl p-6 transform transition-all duration-500 hover:scale-102">
          <Table
            columns={columns}
            dataSource={locations}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: true }}
            locale={{
              emptyText: "No locations found.",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AllLocations;