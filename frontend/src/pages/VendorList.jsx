import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Input, Button, Modal, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import { fetchAllVendors, updateVendor } from "../utils/api";

const VendorList = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingVendor, setEditingVendor] = useState(null);
  const [editForm, setEditForm] = useState({
    contact_person_name: "",
    contact_no: "",
    email_id: "",
  });
  const [errors, setErrors] = useState({});
  const [isBackModalVisible, setIsBackModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch vendors on component mount
  useEffect(() => {
    const loadVendors = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAllVendors();
        const formattedVendors = data.map((vendor, index) => ({
          ...vendor,
          key: vendor.id || index + 1, // Ensure each vendor has a unique key for the Table
          contact_person_name: vendor.contact_person_name || "",
          contact_no: vendor.contact_no || "",
          email_id: vendor.email_id || "",
        }));
        setVendors(formattedVendors);
        setFilteredVendors(formattedVendors);
      } catch (err) {
        setError("Failed to fetch vendors. Please try again later.");
        console.error("Fetch vendors error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadVendors();
  }, []);

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchTerm(value);
    const filtered = vendors.filter((vendor) =>
      ["gstin", "name", "pan"].some((field) =>
        vendor[field]?.toLowerCase().includes(value)
      )
    );
    setFilteredVendors(filtered);
    setCurrentPage(1);
  };

  // Handle edit button click
  const handleEdit = (vendor) => {
    setEditingVendor(vendor.id);
    setEditForm({
      contact_person_name: vendor.contact_person_name || "",
      contact_no: vendor.contact_no || "",
      email_id: vendor.email_id || "",
    });
    setErrors({});
  };

  // Handle input change for edit form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });

    // Clear specific error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Validate edit form before submission
  const validateEditForm = () => {
    const newErrors = {};
    if (editForm.contact_no && !/^\d{10}$/.test(editForm.contact_no)) {
      newErrors.contact_no = "Contact number must be a 10-digit number";
    }
    if (
      editForm.email_id &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email_id)
    ) {
      newErrors.email_id = "Invalid email format";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle update submission
  const handleUpdate = async (id) => {
    if (!validateEditForm()) {
      return;
    }

    // Check if at least one field has been provided or changed
    const vendor = vendors.find((v) => v.id === id);
    if (
      (editForm.contact_person_name === vendor.contact_person_name &&
        editForm.contact_no === vendor.contact_no &&
        editForm.email_id === vendor.email_id) ||
      (!editForm.contact_person_name &&
        !editForm.contact_no &&
        !editForm.email_id)
    ) {
      setErrors({
        ...errors,
        form: "Please update at least one field (Contact Person Name, Contact No., Email ID)",
      });
      return;
    }

    try {
      const updatedData = {
        contact_person_name: editForm.contact_person_name || null,
        contact_no: editForm.contact_no || null,
        email_id: editForm.email_id || null,
      };
      const updatedVendor = await updateVendor(id, updatedData);

      // Update local state with the response from the backend
      setVendors(
        vendors.map((vendor) =>
          vendor.id === id ? { ...vendor, ...updatedVendor } : vendor
        )
      );
      setFilteredVendors(
        filteredVendors.map((vendor) =>
          vendor.id === id ? { ...vendor, ...updatedVendor } : vendor
        )
      );
      setEditingVendor(null);
      setEditForm({ contact_person_name: "", contact_no: "", email_id: "" });
      setErrors({});
      alert("Vendor updated successfully!");
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      if (error.response?.status === 404) {
        setError("Vendor not found. Please refresh the list and try again.");
      } else if (
        error.response?.data?.error ===
        "At least one field (Contact Person Name, Contact No., Email ID) must be provided"
      ) {
        setErrors({
          ...errors,
          form: "Please update at least one field (Contact Person Name, Contact No., Email ID)",
        });
      } else {
        setError("Failed to update vendor: " + errorMessage);
      }
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingVendor(null);
    setEditForm({ contact_person_name: "", contact_no: "", email_id: "" });
    setErrors({});
  };

  // Handle XLSX file import
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Validate and map the imported data
      const newVendors = jsonData
        .map((row, index) => {
          if (!row.gstin || !row.name || !row.address || !row.pan) {
            alert(
              `Invalid data in row ${
                index + 1
              }: Missing required fields (gstin, name, address, pan)`
            );
            return null;
          }
          return {
            id: vendors.length + index + 1,
            gstin: row.gstin.toString(),
            name: row.name.toString(),
            address: row.address.toString(),
            pan: row.pan.toString(),
            contact_person_name: row.contact_person_name?.toString() || "",
            contact_no: row.contact_no?.toString() || "",
            email_id: row.email_id?.toString() || "",
          };
        })
        .filter((vendor) => vendor !== null);

      if (newVendors.length === 0) {
        alert("No valid vendors found in the file.");
        return;
      }

      setVendors([...vendors, ...newVendors]);
      setFilteredVendors([...vendors, ...newVendors]);
      alert("Vendors imported successfully!");
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle back navigation with confirmation
  const handleBack = () => {
    setIsBackModalVisible(true);
  };

  const confirmBack = () => {
    setIsBackModalVisible(false);
    navigate("/vendor");
  };

  // Handle table pagination change
  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
  };

  // Table columns
  const columns = [
    {
      title: "GSTIN",
      dataIndex: "gstin",
      key: "gstin",
      width: 160,
      align: "center",
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 200,
      align: "center",
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
      width: 300,
      align: "center",
      render: (text) => (
        <span className="whitespace-normal break-words">{text}</span>
      ),
    },
    {
      title: "PAN",
      dataIndex: "pan",
      key: "pan",
      width: 150,
      align: "center",
    },
    {
      title: "Contact Person",
      dataIndex: "contact_person_name",
      key: "contact_person_name",
      width: 150,
      align: "center",
      render: (text, record) =>
        editingVendor === record.id ? (
          <Input
            name="contact_person_name"
            value={editForm.contact_person_name}
            onChange={handleInputChange}
            className="w-full"
          />
        ) : (
          text || "-"
        ),
    },
    {
      title: "Contact No.",
      dataIndex: "contact_no",
      key: "contact_no",
      width: 150,
      align: "center",
      render: (text, record) =>
        editingVendor === record.id ? (
          <div>
            <Input
              name="contact_no"
              value={editForm.contact_no}
              onChange={handleInputChange}
              className="w-full"
            />
            {errors.contact_no && (
              <p className="mt-1 text-sm text-red-500">{errors.contact_no}</p>
            )}
          </div>
        ) : (
          text || "-"
        ),
    },
    {
      title: "Email ID",
      dataIndex: "email_id",
      key: "email_id",
      width: 200,
      align: "center",
      render: (text, record) =>
        editingVendor === record.id ? (
          <div>
            <Input
              name="email_id"
              value={editForm.email_id}
              onChange={handleInputChange}
              className="w-full"
            />
            {errors.email_id && (
              <p className="mt-1 text-sm text-red-500">{errors.email_id}</p>
            )}
          </div>
        ) : (
          text || "-"
        ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      align: "center",
      render: (_, record) =>
        editingVendor === record.id ? (
          <div>
            <Space>
              <Button
                onClick={() => handleUpdate(record.id)}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                Save
              </Button>
              <Button
                onClick={handleCancelEdit}
                className="bg-gray-500 text-white hover:bg-gray-600"
              >
                Cancel
              </Button>
            </Space>
            {errors.form && (
              <p className="mt-1 text-sm text-red-500">{errors.form}</p>
            )}
          </div>
        ) : (
          <Button
            onClick={() => handleEdit(record)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Edit
          </Button>
        ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 elegant-bg">
      <div className="pt-4 px-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-full mx-auto fade-in min-h-[calc(100vh-4rem)]">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-blue-800 border-l-4 border-green-600 pl-3">
              Vendors List
            </h1>
            <Space>
              <Input
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder="Search by GSTIN, Name, PAN..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-80 h-10 rounded-md border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all duration-300 hover:shadow-md"
              />
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-blue-600 transition-all transform hover:scale-110"
                title="Back to Vendors"
              >
                <ArrowLeftIcon className="h-2 w-2" />
              </button>
            </Space>
          </div>

          <div className="flex justify-end mb-4 px-3">
            <Space>
              <label className="px-5 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-800 transition duration-200 cursor-pointer">
                Import Vendors
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              <Button
                onClick={() => navigate("/vendor/create")}
                className="bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 h-10 px-6 rounded-md shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Add Vendor
              </Button>
            </Space>
          </div>

          {loading && (
            <div className="text-center text-gray-600 mb-4">
              Loading vendors...
            </div>
          )}
          {error && (
            <div className="text-center text-red-600 mb-4">{error}</div>
          )}
          {!loading && !error && filteredVendors.length === 0 && (
            <div className="text-center text-gray-600 mb-4">
              No vendors found.
            </div>
          )}
          <Table
            dataSource={filteredVendors}
            columns={columns}
            rowKey="id"
            className="w-full rounded-lg overflow-hidden"
            rowClassName="cursor-pointer hover:bg-blue-50 transition-colors duration-200 align-middle row-enter"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              pageSizeOptions: ["10"],
              showSizeChanger: false,
              total: filteredVendors.length,
              showTotal: false,
              position: ["bottomRight"],
            }}
            onChange={handleTableChange}
            scroll={{ x: 1500, y: 400 }}
            bordered
          />

          <Modal
            title="Confirm Navigation"
            visible={isBackModalVisible}
            onOk={confirmBack}
            onCancel={() => setIsBackModalVisible(false)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{
              className: "bg-blue-600 hover:bg-blue-700 text-white rounded-lg",
            }}
            cancelButtonProps={{
              className:
                "bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg",
            }}
          >
            <p>
              Are you sure you want to go back? Any unsaved changes will be
              lost.
            </p>
          </Modal>
        </div>
      </div>

      <style jsx global>{`
        .elegant-bg {
          background: linear-gradient(
            135deg,
            #e0f2fe 0%,
            #bae6fd 50%,
            #e0f2fe 100%
          );
          animation: subtleMove 20s ease-in-out infinite;
          position: relative;
          overflow: hidden;
        }
        @keyframes subtleMove {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .elegant-bg::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.2) 0%,
            rgba(255, 255, 255, 0) 70%
          );
          animation: gentleFade 5s ease-in-out infinite;
        }
        @keyframes gentleFade {
          0% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        .slide-in {
          animation: slideIn 0.5s ease-in-out;
        }
        .row-enter {
          animation: rowEnter 0.3s ease-in-out;
        }
        .pulse {
          animation: pulse 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes rowEnter {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }
        .ant-table-wrapper .ant-table {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        .ant-table-wrapper .ant-table-thead > tr > th {
          background: #f8fafc;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
          text-align: center;
          padding: 12px 16px;
          white-space: normal;
          height: 64px;
          line-height: 1.2;
          transition: background 0.3s ease;
        }
        .ant-table-wrapper .ant-table-thead > tr > th:hover {
          background: #e6f0ff;
        }
        .ant-table-wrapper .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
          text-align: center;
          padding: 12px 16px;
          line-height: 1.5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: background 0.3s ease;
        }
        .ant-table-wrapper .ant-table-tbody > tr {
          height: 48px;
        }
        .ant-table-wrapper .ant-table-container {
          overflow-x: auto;
        }
        .ant-table-wrapper::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .ant-table-wrapper::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .ant-table-wrapper::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        .ant-table-wrapper::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .ant-table-tbody > tr.ant-table-row:hover > td {
          background: #e6f0ff;
        }
        .ant-pagination {
          margin-top: 20px;
          display: flex;
          justify-content: center;
          padding: 10px 0;
        }
        .ant-pagination-item {
          border-radius: 6px;
          transition: all 0.3s ease;
        }
        .ant-pagination-item:hover {
          background: #e6f0ff;
          transform: scale(1.1);
        }
        .ant-pagination-item-active {
          background: #1890ff;
          border-color: #1890ff;
          color: white;
        }
        .ant-table-tbody > tr > td:first-child {
          padding-left: 16px !important;
        }
        .min-h-screen {
          max-height: 100vh;
          padding-top: 60px;
        }
        .bg-white {
          margin: 0 auto;
          width: 100%;
         
          transition: transform 0.3s ease;
        }
        .bg-white:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        @keyframes slide-in {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default VendorList;