import React, { useState, useEffect } from "react";
import { Button, Table, Input, message, Modal, Spin, AutoComplete } from "antd";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { updateNonCOCLocation, fetchLocations as fetchLocationsAPI, fetchParentLocations as fetchParentLocationsAPI, fetchAllLocations } from "../utils/api";
import {
  LoadingOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import ConfirmationModal from "../components/ConfirmationModal";

const Locations = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [newLocationPath, setNewLocationPath] = useState("");
  const [locations, setLocations] = useState([]);
  const [parentLocations, setParentLocations] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [filteredLocationOptions, setFilteredLocationOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  useEffect(() => {
    fetchLocations();
    fetchParentLocations();
    fetchAllLocationsForDropdown();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await fetchLocationsAPI();
      console.log("Fetched locations response:", response);
      const formattedLocations = response
        .filter(item => item.component_id != null)
        .map(item => ({
          key: item.component_id.toString(),
          componentId: item.component_id,
          location: item.location || "N/A",
          description: item.description || "N/A",
          mpn: item.mpn || "N/A",
          make: item.make || "N/A",
          partNo: item.part_no || "N/A",
          onHandQuantity: item.on_hand_quantity || 0,
        }));
      setLocations(formattedLocations);
    } catch (error) {
      console.error("Error fetching locations:", error.message);
      message.error("Failed to fetch locations: " + error.message);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchParentLocations = async () => {
    try {
      const response = await fetchParentLocationsAPI();
      console.log("Fetched parent locations response:", response);
      setParentLocations(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching parent locations:", error.message);
      message.error("Failed to fetch parent locations: " + error.message);
      setParentLocations([]);
    }
  };

  const fetchAllLocationsForDropdown = async () => {
    try {
      const response = await fetchAllLocations();
      console.log("Fetched all locations for dropdown:", response);
      const locationOptions = response.map(loc => ({
        value: loc.path,
      }));
      setAllLocations(locationOptions);
      setFilteredLocationOptions(locationOptions);
    } catch (error) {
      console.error("Error fetching all locations for dropdown:", error.message);
      message.error("Failed to fetch all locations: " + error.message);
      setAllLocations([]);
      setFilteredLocationOptions([]);
    }
  };

  const handleSearch = () => {
    const filtered = locations.filter(loc =>
      loc.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.mpn.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setLocations(filtered);
  };

  const showEditModal = (record) => {
    console.log("Opening edit modal for:", record, "key:", record.key);
    if (!record?.key) {
      console.error("Missing key in record:", record);
      return message.error("Invalid record selected");
    }
    setSelectedLocation(record);
    setNewLocationPath(""); // Keep the input field empty
    // Include the current location at the top of the dropdown
    const currentLocationOption = record.location && record.location !== "N/A"
      ? [{ value: record.location }]
      : [];
    setFilteredLocationOptions([...currentLocationOption, ...allLocations]);
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    if (!newLocationPath || !selectedLocation?.key) {
      console.error("Validation failed:", { newLocationPath, componentId: selectedLocation?.key });
      return message.error("Missing required info: newLocationPath or componentId");
    }
    const componentId = Number(selectedLocation.key);
    if (isNaN(componentId)) {
      return message.error("Invalid component ID");
    }
    try {
      console.log("Submitting update:", { componentId, newLocationPath });
      await updateNonCOCLocation(componentId, newLocationPath);
      message.success("Location Edited Successfully");
      fetchLocations();
      setEditModalVisible(false);
      setNewLocationPath("");
    } catch (error) {
      console.error("Edit save error:", error);
      message.error("Failed to edit location: " + error.message);
    }
  };

  const handleLocationSearch = (value) => {
    const upperValue = value.toUpperCase();
    setNewLocationPath(upperValue);
    if (upperValue) {
      const filtered = allLocations.filter(option =>
        option.value.toUpperCase().includes(upperValue)
      );
      setFilteredLocationOptions(filtered);
    } else {
      setFilteredLocationOptions(allLocations);
    }
  };

  const handleLocationChange = (value) => {
    setNewLocationPath(value.toUpperCase());
  };

  const handleSaveClick = () => {
    setIsSaveModalOpen(true);
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const confirmSave = () => {
    setIsSaveModalOpen(false);
    handleEditSave();
  };

  const confirmCancel = () => {
    setIsCancelModalOpen(false);
    setEditModalVisible(false);
  };

  const columns = [
    { title: "Location", dataIndex: "location", key: "location" },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    { title: "Make", dataIndex: "make", key: "make" },
    { title: "Part No", dataIndex: "partNo", key: "partNo" },
    { title: "On Hand Quantity", dataIndex: "onHandQuantity", key: "onHandQuantity" },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="link" onClick={() => showEditModal(record)}>Edit</Button>
      ),
    },
  ];

  const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-100 to-purple-100 mt-12 p-6 ">
      <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn ">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-500 bg-clip-text text-transparent">
            Internal Locations
          </h2>
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4 mt-4 md:mt-0">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={fetchLocations}
              className="bg-gray-300 hover:bg-gray-400 text-white"
            />
            <div className="flex items-center space-x-4">
              <Input
                placeholder="Search by location, description, or MPN"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                className="w-full md:w-64 border-gray-300 rounded-md focus:border-purple-500"
              />
              <Button
                type="primary"
                className="bg-purple-600 hover:bg-purple-700 text-white transform hover:scale-105"
                onClick={() => navigate("/create-location")}
              >
                Create Location
              </Button>
            </div>
          </div>
        </div>
        <div className="bg-white shadow-2xl rounded-xl p-6 h-[calc(100vh-200px)] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spin indicator={antIcon} />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No data available
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={locations}
              pagination={{ pageSize: 20 }}
              bordered
              rowClassName="hover:bg-pink-100 hover:scale-101 transition-transform duration-200 cursor-pointer"
            />
          )}
        </div>

        <Modal
          title={<span className="text-2xl font-semibold text-purple-700">Edit Location</span>}
          open={editModalVisible}
          onOk={handleEditSave}
          onCancel={() => setEditModalVisible(false)}
          okButtonProps={{ disabled: !newLocationPath, className: "bg-purple-600 hover:bg-purple-700 text-white" }}
          cancelButtonProps={{ className: "bg-red-500 hover:bg-red-600 text-white" }}
          className="rounded-xl shadow-2xl transform transition-all duration-500 ease-out animate-fadeInUp"
          style={{ top: 20 }}
        >
          <div className="space-y-6 p-6">
            <p className="text-lg font-semibold">Previous Location: {selectedLocation?.location}</p>
            <AutoComplete
              options={filteredLocationOptions}
              value={newLocationPath}
              onChange={handleLocationChange}
              onSearch={handleLocationSearch}
              placeholder="Enter new location path"
              className="w-full"
              size="large"
              filterOption={false}
              style={{ textTransform: "uppercase" }}
            />
            {!newLocationPath && (
              <p className="text-red-500 text-sm mt-1">Please enter a valid location path</p>
            )}
          </div>
          <ConfirmationModal
            isOpen={isSaveModalOpen}
            onClose={() => setIsSaveModalOpen(false)}
            onConfirm={confirmSave}
            title="Confirm Save"
            content="Are you sure you want to update this location ?"
          />
          <ConfirmationModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            onConfirm={confirmCancel}
            title="Confirm Cancel"
            content="Are you sure you want to cancel? Any unsaved changes will be lost."
          />
        </Modal>
      </div>
    </div>
  );
};

export default Locations;