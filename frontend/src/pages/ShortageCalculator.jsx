import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Button, Input, InputNumber, Upload, message, Modal, Select, Tooltip } from "antd";
import { UploadOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { FaArrowLeft, FaFilePdf } from "react-icons/fa";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import moment from "moment";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Loader from "../components/loading.jsx";
import { fetchPendingNonCOCIssueRequests } from "../utils/api.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

const API_BASE_URL = "https://erp1-iwt1.onrender.com/api/non_coc_components";

const ShortageCalculator = () => {
  const [bomItems, setBomItems] = useState([]);
  const [productionQuantity, setProductionQuantity] = useState(1);
  const [shortageData, setShortageData] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    description: "",
    mpn: "",
    part_no: "",
    make: "",
    quantity_required: 1,
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const navigate = useNavigate();

  // Fetch component data for a given component
  const fetchComponentData = async (component) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/search`, {
        params: {
          query: component.mpn || component.description,
          type: component.mpn ? "mpn" : "description",
        },
      });
      const data = response.data[0] || {};
      const totalRequired = component.quantity_required * productionQuantity;
      const shortage = Math.max(totalRequired - (data.on_hand_quantity || 0), 0);
      return {
        ...component,
        component_id: data.component_id || null,
        on_hand_quantity: data.on_hand_quantity || 0,
        shortage,
        total_required: totalRequired,
      };
    } catch (err) {
      console.error("Error fetching component data:", err.message);
      setError(`Failed to fetch data for ${component.description || component.mpn}. Please check if the server is running.`);
      return {
        ...component,
        component_id: null,
        on_hand_quantity: 0,
        shortage: component.quantity_required * productionQuantity,
        total_required: component.quantity_required * productionQuantity,
      };
    }
  };

  // Fetch pending material issue requests
  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const data = await fetchPendingNonCOCIssueRequests();
      const mappedRequests = data
        .filter((req) => req.status === "Inventory Approval Pending")
        .map((req, index) => ({
          key: index + 1,
          umi: req.umi,
          component_id: req.component_id,
          mpn: req.mpn || "N/A",
          description: req.item_description || "N/A",
          requested_quantity: req.updated_requestedqty || 0,
          requested_by: req.user_name || "N/A",
          date: req.date,
        }));
      console.log("Pending Requests:", mappedRequests);
      setPendingRequests(mappedRequests);
    } catch (err) {
      setError("Failed to fetch pending material issue requests. Please check if the server is running.");
      console.error("Error fetching pending requests:", err);
    } finally {
      setLoading(false);
    }
  };

  // Process uploaded Excel file
// Process uploaded Excel file
const handleFileUpload = (file) => {
  setLoading(true);
  setError(null);
  try {
    if (!(file instanceof File) && !(file instanceof Blob)) {
      throw new Error("Invalid file type. Please upload a valid Excel file (.xlsx or .xls).");
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Parse all values as strings
        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          raw: false,
          defval: "",
          header: 1,
          blankrows: false,
          rawNumbers: false, // Ensure numbers are treated as strings
        });

        // Extract headers and sanitize
        const headers = jsonData[0].map((header) =>
          header
            .toString()
            .replace(/[^\x20-\x7E]/g, "") // Remove non-printable characters
            .trim()
        );
        console.log("Excel Headers:", headers);

        // Convert rows to objects using the sanitized headers (skip the header row)
        const rows = jsonData.slice(1).map((row) => {
          const rowData = {};
          headers.forEach((header, index) => {
            // Convert all values to strings explicitly
            rowData[header] = row[index] !== undefined ? String(row[index]) : "";
          });
          return rowData;
        });
        console.log("Parsed Excel Rows:", rows);

        // Map rows to component objects
        const processedItems = await Promise.all(
          rows.map(async (item, index) => {
            const component = {
              key: index + 1,
              description: String(item["ITEM DESCRIPTION"] || ""),
              mpn: String(item["MPN"] || ""),
              part_no: String(item["PART NO"] || ""),
              make: String(item["MAKE"] || ""),
              quantity_required: Number(item["QTY"] || 1),
            };

            // Debug: Log the component object to verify part_no
            console.log(`Component ${index + 1}:`, component);

            const fetchedComponent = await fetchComponentData(component);
            console.log(`Fetched Component ${index + 1}:`, fetchedComponent);

            return fetchedComponent;
          })
        );

        console.log("Processed BOM Items:", processedItems);
        setBomItems(processedItems);
        calculateShortage(processedItems);
        await fetchPendingRequests();
      } catch (err) {
        setError("Failed to process Excel file content.");
        message.error("Failed to process Excel file content.");
        console.error("Error processing Excel file content:", err);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read the Excel file.");
      message.error("Failed to read the Excel file.");
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
    return false;
  } catch (err) {
    setError("Invalid file type. Please upload a valid Excel file (.xlsx or .xls).");
    message.error("Invalid file type. Please upload a valid Excel file (.xlsx or .xls).");
    console.error("Error in handleFileUpload:", err);
    setLoading(false);
    return false;
  }
};

  // Calculate shortage for all items
  const calculateShortage = (items) => {
    const updatedShortage = items.map((item) => ({
      ...item,
      shortage: Math.max(
        item.quantity_required * productionQuantity - (item.on_hand_quantity || 0),
        0
      ),
      total_required: item.quantity_required * productionQuantity,
    }));
    setShortageData(updatedShortage);
  };

  // Handle manual entry form submission
  const handleManualEntrySubmit = async () => {
    if (!manualEntry.description && !manualEntry.mpn) {
      message.error("Please provide at least a description or MPN.");
      return;
    }
    setLoading(true);
    try {
      const newItem = await fetchComponentData({
        ...manualEntry,
        key: bomItems.length + 1,
      });
      const updatedItems = [...bomItems, newItem];
      setBomItems(updatedItems);
      calculateShortage(updatedItems);
      setManualEntry({
        description: "",
        mpn: "",
        part_no: "",
        make: "",
        quantity_required: 1,
      });
      setShowManualEntry(false);
      await fetchPendingRequests();
    } catch (err) {
      setError("Failed to add manual entry.");
      message.error("Failed to add manual entry.");
      console.error("Error adding manual entry:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle edit form submission
  const handleEditSubmit = async () => {
    if (!editItem.description && !editItem.mpn) {
      message.error("Please provide at least a description or MPN.");
      return;
    }
    setLoading(true);
    try {
      const updatedItem = await fetchComponentData({
        ...editItem,
        quantity_required: Number(editItem.quantity_required),
      });
      const updatedItems = bomItems.map((item) =>
        item.key === updatedItem.key ? updatedItem : item
      );
      setBomItems(updatedItems);
      calculateShortage(updatedItems);
      setIsEditing(false);
      setEditItem(null);
      await fetchPendingRequests();
      message.success("Item updated successfully!");
    } catch (err) {
      setError("Failed to update item.");
      message.error("Failed to update item.");
      console.error("Error updating item:", err);
    } finally {
      setLoading(false);
    }
  };

  // Delete a BOM item
  const handleDeleteItem = (key) => {
    const updatedItems = bomItems.filter((item) => item.key !== key);
    setBomItems(updatedItems);
    calculateShortage(updatedItems);
  };

  // Start editing a BOM item
  const handleEditItem = (record) => {
    setEditItem({ ...record });
    setIsEditing(true);
  };

  // Update production quantity and recalculate shortage
  const handleProductionQuantityChange = (value) => {
    if (value >= 1) {
      setProductionQuantity(value);
      calculateShortage(bomItems);
    }
  };

  // Filter and search BOM items
  const filteredShortageData = shortageData
    .filter((item) => {
      if (filterStatus === "all") return true;
      if (filterStatus === "shortage") return item.shortage > 0;
      if (filterStatus === "no-shortage") return item.shortage === 0;
      return true;
    })
    .filter((item) =>
      searchQuery
        ? item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.mpn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.part_no && item.part_no.toLowerCase().includes(searchQuery.toLowerCase()))
        : true
    );

  // Chart data for Bar Chart
  const barChartData = {
    labels: filteredShortageData.map((item) => item.description || item.mpn || `Item ${item.key}`),
    datasets: [
      {
        label: "Shortage Quantity",
        data: filteredShortageData.map((item) => item.shortage),
        backgroundColor: "rgba(255, 99, 132, 0.6)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
      {
        label: "On Hand Quantity",
        data: filteredShortageData.map((item) => item.on_hand_quantity || 0),
        backgroundColor: "rgba(54, 162, 235, 0.6)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
    ],
  };

  // Chart options for Bar Chart
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { size: 10 } } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.raw}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Quantity", font: { size: 10 } },
        ticks: { font: { size: 8 } },
      },
      x: {
        title: { display: true, text: "Components", font: { size: 10 } },
        ticks: { font: { size: 8 }, maxRotation: 45, minRotation: 45 },
      },
    },
  };

  // Generate and download PDF using jsPDF
  const downloadPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("BOM Shortage Report", 14, 20);
      doc.setFontSize(10);
      doc.text(`Date: ${moment().format("YYYY-MM-DD")}`, 14, 30);

      const tableData = filteredShortageData.map((item, index) => [
        index + 1,
        item.description || "-",
        item.mpn || "-",
        item.part_no || "-",
        item.make || "-",
        item.quantity_required || 0,
        item.total_required || 0,
        item.on_hand_quantity || 0,
        item.shortage || 0,
      ]);

      autoTable(doc, {
        head: [["S.No", "Description", "MPN", "Part No", "Make", "Qty Required", "Total Required", "On Hand", "Shortage"]],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { top: 40 },
      });

      doc.save(`Shortage_Report_${moment().format("YYYYMMDD_HHmmss")}.pdf`);
      message.success("PDF report downloaded successfully!");
    } catch (err) {
      console.error("Error generating PDF:", err);
      message.error("Failed to generate PDF report. Please try again.");
    }
  };

  // Table columns for BOM items with pending request details
  const bomColumns = [
    { title: "S.No", dataIndex: "key", key: "key", className: "font-medium text-gray-800 text-sm" },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      className: "font-medium text-gray-800 text-sm",
    },
    { title: "MPN", dataIndex: "mpn", key: "mpn", className: "font-medium text-gray-800 text-sm" },
    {
      title: "Part No",
      dataIndex: "part_no",
      key: "part_no",
      className: "font-medium text-gray-800 text-sm",
      render: (text) => {
        console.log("Rendering Part No:", text); // Debug: Log the part_no value during rendering
        return text || "-";
      },
    },
    {
      title: "Make",
      dataIndex: "make",
      key: "make",
      className: "font-medium text-gray-800 text-sm",
      render: (text) => text || "-",
    },
    {
      title: "Qty Required (Per Set)",
      dataIndex: "quantity_required",
      key: "quantity_required",
      className: "font-medium text-gray-800 text-sm",
    },
    {
      title: "Total Required",
      dataIndex: "total_required",
      key: "total_required",
      className: "font-medium text-gray-800 text-sm",
    },
    {
      title: "On Hand Qty",
      dataIndex: "on_hand_quantity",
      key: "on_hand_quantity",
      className: "font-medium text-gray-800 text-sm",
      render: (text) => text || 0,
    },
    {
      title: "Shortage",
      dataIndex: "shortage",
      key: "shortage",
      className: "font-medium text-sm",
      render: (text) => (
        <span className={text > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
          {text}
        </span>
      ),
    },
    // {
    //   title: "Pending Requests",
    //   key: "pending_requests",
    //   className: "font-medium text-gray-800 text-sm",
    //   render: (_, record) => {
    //     const relatedRequests = pendingRequests.filter((req) => {
    //       const bomDescription = record.description ? record.description.toLowerCase().trim() : "";
    //       const reqDescription = req.description ? req.description.toLowerCase().trim() : "";
    //       return bomDescription && reqDescription && bomDescription === reqDescription;
    //     });
    //     return relatedRequests.length > 0 ? (
    //       <ul className="list-disc pl-4">
    //         {relatedRequests.map((req) => (
    //           <li key={req.key}>
    //             UMI: {req.umi}, Qty: {req.requested_quantity}, By: {req.requested_by}, Date: {moment(req.date).format("YYYY-MM-DD HH:mm:ss")}
    //             <br />
    //             <Button
    //               type="link"
    //               className="text-blue-600 hover:text-blue-800 text-xs p-0"
    //               onClick={() => navigate(`/review-request/${req.umi}`)}
    //             >
    //               Review
    //             </Button>
    //           </li>
    //         ))}
    //       </ul>
    //     ) : (
    //       <span className="text-gray-500">-</span>
    //     );
    //   },
    // },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <div className="flex gap-2">
          <Tooltip title="Edit Item">
            <Button
              icon={<EditOutlined />}
              className="bg-blue-500 text-white hover:bg-blue-400 text-xs"
              size="small"
              onClick={() => handleEditItem(record)}
            />
          </Tooltip>
          <Tooltip title="Delete Item">
            <Button
              icon={<DeleteOutlined />}
              className="bg-red-500 text-white hover:bg-red-400 text-xs"
              size="small"
              onClick={() => handleDeleteItem(record.key)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  // Effect to recalculate shortage and fetch requests
  useEffect(() => {
    if (bomItems.length > 0) {
      calculateShortage(bomItems);
      fetchPendingRequests();
    }
  }, [productionQuantity, bomItems.length]);

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-6 md:p-8 lg:p-8"
      >
        {/* Header */}
        <div className="flex items-center mb-1">
          <Tooltip title="Back">
            <button
              className="text-gray-600 rounded-full p-14 hover:bg-gray-200 transition duration-300 transform hover:scale-105 mr-4"
              onClick={() => navigate(-1)}
            >
              <FaArrowLeft size={18} />
            </button>
          </Tooltip>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Bill of Materials Shortage Analysis</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6 shadow-sm">
            {error}
          </div>
        )}

        {/* Controls Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Upload
                accept=".xlsx,.xls"
                beforeUpload={handleFileUpload}
                showUploadList={false}
              >
                <Button
                  icon={<UploadOutlined />}
                  className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-500 transition duration-300 text-sm font-medium"
                >
                  Upload BOM (Excel)
                </Button>
              </Upload>
              <Button
                className="bg-green-600 text-white px-5 py-2 rounded-md hover:bg-green-500 transition duration-300 text-sm font-medium"
                onClick={() => setShowManualEntry(true)}
              >
                Add Manual Entry
              </Button>
              <Button
                icon={<FaFilePdf />}
                className="bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-500 transition duration-300 text-sm font-medium"
                disabled={shortageData.length === 0}
                onClick={downloadPDF}
              >
                Export PDF Report
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
              <Input
                placeholder="Search by Description, MPN, or Part No"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                className="w-full sm:w-40 text-sm"
                options={[
                  { value: "all", label: "All Items" },
                  { value: "shortage", label: "With Shortage" },
                  { value: "no-shortage", label: "No Shortage" },
                ]}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Production Qty:</span>
                <InputNumber
                  min={1}
                  value={productionQuantity}
                  onChange={handleProductionQuantityChange}
                  className="w-20 rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && <Loader className="flex justify-center items-center h-64" />}

        {/* Manual Entry Modal */}
        <Modal
          title="Add Component"
          open={showManualEntry}
          onOk={handleManualEntrySubmit}
          onCancel={() => setShowManualEntry(false)}
          okText="Add"
          cancelText="Cancel"
          okButtonProps={{
            className: "bg-green-600 text-white hover:bg-green-500 text-sm",
          }}
          cancelButtonProps={{
            className: "bg-gray-200 text-gray-800 hover:bg-gray-300 text-sm",
          }}
        >
          <div className="space-y-4">
            <Input
              placeholder="Description"
              value={manualEntry.description}
              onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
              className="rounded-md text-sm"
            />
            <Input
              placeholder="MPN"
              value={manualEntry.mpn}
              onChange={(e) => setManualEntry({ ...manualEntry, mpn: e.target.value })}
              className="rounded-md text-sm"
            />
            <Input
              placeholder="Part No"
              value={manualEntry.part_no}
              onChange={(e) => setManualEntry({ ...manualEntry, part_no: e.target.value })}
              className="rounded-md text-sm"
            />
            <Input
              placeholder="Make"
              value={manualEntry.make}
              onChange={(e) => setManualEntry({ ...manualEntry, make: e.target.value })}
              className="rounded-md text-sm"
            />
            <InputNumber
              min={1}
              placeholder="Quantity Required (Per Set)"
              value={manualEntry.quantity_required}
              onChange={(value) => setManualEntry({ ...manualEntry, quantity_required: value })}
              className="w-full rounded-md text-sm"
            />
          </div>
        </Modal>

        {/* Edit Item Modal */}
        <Modal
          title="Edit Component"
          open={isEditing}
          onOk={handleEditSubmit}
          onCancel={() => {
            setIsEditing(false);
            setEditItem(null);
          }}
          okText="Update"
          cancelText="Cancel"
          okButtonProps={{
            className: "bg-blue-600 text-white hover:bg-blue-500 text-sm",
          }}
          cancelButtonProps={{
            className: "bg-gray-200 text-gray-800 hover:bg-gray-300 text-sm",
          }}
        >
          {editItem && (
            <div className="space-y-4">
              <Input
                placeholder="Description"
                value={editItem.description}
                onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                className="rounded-md text-sm"
              />
              <Input
                placeholder="MPN"
                value={editItem.mpn}
                onChange={(e) => setEditItem({ ...editItem, mpn: e.target.value })}
                className="rounded-md text-sm"
              />
              <Input
                placeholder="Part No"
                value={editItem.part_no}
                onChange={(e) => setEditItem({ ...editItem, part_no: e.target.value })}
                className="rounded-md text-sm"
              />
              <Input
                placeholder="Make"
                value={editItem.make}
                onChange={(e) => setEditItem({ ...editItem, make: e.target.value })}
                className="rounded-md text-sm"
              />
              <InputNumber
                min={1}
                placeholder="Quantity Required (Per Set)"
                value={editItem.quantity_required}
                onChange={(value) => setEditItem({ ...editItem, quantity_required: value })}
                className="w-full rounded-md text-sm"
              />
            </div>
          )}
        </Modal>

        {/* BOM Items Table */}
        {bomItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Bill of Materials</h2>
            <div className="overflow-x-auto">
              <Table
                columns={bomColumns}
                dataSource={filteredShortageData}
                pagination={{ pageSize: 10, size: "small" }}
                bordered
                className="min-w-full text-sm"
                rowClassName="hover:bg-gray-50 transition duration-200"
              />
            </div>
          </div>
        )}

        {/* Shortage Visualization - Compact Bar Chart */}
        {filteredShortageData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Shortage vs On-Hand Quantity</h2>
            <div className="w-full max-w-4xl mx-auto" style={{ height: "400px" }}>
              <Bar data={barChartData} options={barChartOptions} />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ShortageCalculator;