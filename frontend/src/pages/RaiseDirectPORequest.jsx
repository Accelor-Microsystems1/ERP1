import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaSearch, FaFilter, FaFileExcel } from "react-icons/fa";
import { Table, Dropdown, Menu, Button, message } from "antd";
import * as XLSX from "xlsx";
import Loader from "../components/loading.jsx";

// API base URL for direct axios calls
const API_BASE_URL = "http://localhost:5000/api/non_coc_components";

const RaiseDirectPORequest = () => {
  // State declarations
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("description");
  const [searchResults, setSearchResults] = useState([]);
  const [allComponents, setAllComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [isImported, setIsImported] = useState(false); // Track if data is from import
  const [hasOnHandQuantity, setHasOnHandQuantity] = useState(true); // Track if on_hand_quantity is in import
  const navigate = useNavigate();

  // Fetch all components to display in the table
  const fetchAllComponents = async () => {
    setLoading(true);
    setError(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedComponents([]);
    setShowTable(true);
    setIsImported(false);
    setHasOnHandQuantity(true);

    try {
      const response = await axios.get(`${API_BASE_URL}/all`);
      const components = response.data || [];
      setAllComponents(components);
      setSearchResults([]);
    } catch (error) {
      console.error("Error fetching all components:", error.message);
      setError("Failed to load components. Please try again.");
      setAllComponents([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search functionality based on query and type
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchAllComponents();
      return;
    }

    setLoading(true);
    setError(null);
    setShowTable(true);
    setSelectedComponents([]);
    setIsImported(false);
    setHasOnHandQuantity(true);

    try {
      const query = searchQuery.trim().toLowerCase();
      const response = await axios.get(`${API_BASE_URL}/search`, {
        params: { query, type: searchType },
      });

      const results = response.data || [];
      if (results.length === 0) {
        setError(`No components found for "${searchQuery}" in ${searchType}.`);
      } else {
        setError(null);
      }

      setSearchResults(results);
      setAllComponents(results);
    } catch (error) {
      console.error("Error fetching search results:", error.response?.data || error.message);
      setError("Failed to fetch search results. Please try again.");
      setSearchResults([]);
      setAllComponents([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on_hand_quantity from database for a single component by mpn or part_no
  const fetchOnHandQuantity = async (component) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/search`, {
        params: { query: component.mpn || component.part_no, type: component.mpn ? "mpn" : "part_no" },
      });
      const match = response.data.find(
        (item) => item.mpn === component.mpn || item.part_no === component.part_no
      );
      return match ? match.on_hand_quantity || 0 : 0;
    } catch (error) {
      console.error(`Error fetching on_hand_quantity for ${component.mpn || component.part_no}:`, error.message);
      return 0;
    }
  };

  // Handle XLSX file import with flexible column order
  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      message.error("No file selected.");
      return;
    }

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type)) {
      message.error("Please upload a valid XLSX or XLS file.");
      return;
    }

    setLoading(true);
    setError(null);
    setIsImported(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Get headers and normalize to lowercase for case-insensitive matching
        const headers = jsonData[0].map((header) => header.toString().toLowerCase());
        const requiredHeaders = ["item_description", "mpn", "part_no", "make"];
        const hasRequiredHeaders = requiredHeaders.every((header) =>
          headers.includes(header.toLowerCase())
        );
        const hasOnHand = headers.includes("on_hand_quantity");

        if (!hasRequiredHeaders) {
          setError(
            "Invalid file format. Ensure the file contains columns: item_description, mpn, part_no, make."
          );
          setLoading(false);
          return;
        }

        setHasOnHandQuantity(hasOnHand);

        // Map headers to their indices
        const headerMap = {};
        headers.forEach((header, index) => {
          headerMap[header.toLowerCase()] = index;
        });

        // Convert rows to component objects, limit to 100 records
        const components = jsonData.slice(1).slice(0, 100).map(async (row, index) => {
          const rowData = {
            item_description: row[headerMap["item_description"]] || "",
            mpn: row[headerMap["mpn"]] || "",
            part_no: row[headerMap["part_no"]] || "",
            make: row[headerMap["make"]] || "",
          };

          // Fetch on_hand_quantity from database if not provided
          const on_hand_quantity = hasOnHand
            ? parseInt(row[headerMap["on_hand_quantity"]]) || 0
            : await fetchOnHandQuantity(rowData);

          return {
            component_id: `imported_${index}_${Date.now()}`,
            ...rowData,
            on_hand_quantity,
          };
        });

        // Resolve all promises for components
        const resolvedComponents = await Promise.all(components);

        if (resolvedComponents.length === 0) {
          setError("No valid data found in the file.");
          setLoading(false);
          return;
        }

        // Update state with imported components
        setSelectedComponents(resolvedComponents);
        setAllComponents(resolvedComponents);
        setSearchResults([]);
        setShowTable(true);
        message.success(`Successfully imported ${resolvedComponents.length} components.`);
      } catch (err) {
        console.error("Error processing file:", err.message);
        setError("Failed to process the file. Please ensure it's a valid XLSX file.");
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Error reading the file. Please try again.");
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle toggle button selection
  const handleToggleChange = (component) => {
    setSelectedComponents((prev) => {
      if (prev.some((item) => item.component_id === component.component_id)) {
        return prev.filter((item) => item.component_id !== component.component_id);
      } else {
        return [...prev, component];
      }
    });
  };

  // Handle review button click
  const handleReview = () => {
    if (selectedComponents.length === 0) {
      message.error("Please select at least one component or import a file.");
      return;
    }
    navigate("/review-po-request", {
      state: { selectedComponents, isImported, hasOnHandQuantity },
    });
  };

  // Handle review button click
  const handleNavigate = () => {
    navigate("/direct-po-requests-history");
  };

  // Dropdown menu for search type filter
  const filterMenu = (
    <Menu
      onClick={({ key }) => setSearchType(key)}
      selectedKeys={[searchType]}
      items={[
        { key: "description", label: "Description" },
        { key: "mpn", label: "MPN" },
        { key: "make", label: "Make" },
        { key: "part_no", label: "Part No." },
      ]}
    />
  );

  // Columns for the components table, conditionally include on_hand_quantity
  const columns = [
    { title: "Description", dataIndex: "item_description", key: "item_description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    {
      title: "Part No.",
      dataIndex: "part_no",
      key: "part_no",
      render: (text) => <span className="leading-tight">{text || "-"}</span>,
    },
    {
      title: "Make",
      dataIndex: "make",
      key: "make",
      render: (text) => <span className="leading-tight">{text || "-"}</span>,
    },
    ...(hasOnHandQuantity
      ? [
          {
            title: "On Hand Qty",
            dataIndex: "on_hand_quantity",
            key: "on_hand_quantity",
          },
        ]
      : []),
    {
      title: "Select",
      key: "select",
      render: (_, record) => (
        <button
          onClick={() => handleToggleChange(record)}
          className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 ease-in-out ${
            selectedComponents.some((item) => item.component_id === record.component_id)
              ? "bg-green-500"
              : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
              selectedComponents.some((item) => item.component_id === record.component_id)
                ? "translate-x-5"
                : "translate-x-0"
            }`}
          />
        </button>
      ),
    },
  ];

  return (
    <div className="h-screen overflow-y-auto overflow-x-auto">
      <div className="p-18">
        {/* Search Bar and Import Section */}
        <div className="flex items-center mb-6">
          {/* Import Button */}
          <div className="mr-4">
            <label className="flex items-center bg-green-500 text-white px-6 py-2 rounded-full whitespace-nowrap hover:bg-green-400 transition duration-300 transform hover:scale-105 shadow-md hover:shadow-lg cursor-pointer">
              <FaFileExcel className="mr-2" size={20} />
              Import XLSX
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
          {/* Search Bar */}
          <div className="flex-1 flex justify-center">
            <div className="relative max-w-2xl w-full">
              <input
                type="text"
                placeholder={`Search by ${searchType.charAt(0).toUpperCase() + searchType.slice(1)}...`}
                className="w-full px-6 py-2 bg-white rounded-full shadow-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300 pr-20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-3">
                <Dropdown overlay={filterMenu} trigger={["click"]}>
                  <FaFilter
                    className="text-gray-500 cursor-pointer hover:text-blue-500 transition duration-300"
                    size={20}
                  />
                </Dropdown>
                <FaSearch
                  className="text-gray-500 cursor-pointer hover:text-blue-500 transition duration-300"
                  size={20}
                  onClick={handleSearch}
                />
              </div>
            </div>
            <div className="ml-4 flex gap-4">
              <button
                className="bg-blue-500 text-white px-6 py-2 rounded-full whitespace-nowrap hover:bg-blue-400 transition duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                onClick={fetchAllComponents}
              >
                View All
              </button>
              <button
                className="bg-yellow-500 text-white px-6 py-2 rounded-full whitespace-nowrap hover:bg-yellow-700 transition duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                onClick={handleNavigate}
              >
                View Past Direct Raised PO's
              </button>
              {selectedComponents.length > 0 && (
                <Button
                  type="primary"
                  danger
                  size="large"
                  onClick={handleReview}
                >
                  Review Request
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Loading & Error Messages */}
        {loading && <Loader className="flex justify-center items-center" />}
        {error && !loading && <p className="text-red-500 text-center mb-4">{error}</p>}

        {/* Component Table */}
        {showTable && !loading && (
          <div className="w-full bg-white rounded-xl shadow-xl p-6 h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {searchResults.length > 0 ? "Search Results" : allComponents.length > 0 ? "Components" : "All Components"}
              </h2>
            </div>
            <div className="overflow-y-auto h-full">
              <Table
                columns={columns}
                dataSource={allComponents}
                pagination={false}
                bordered
                className="min-w-full"
                rowClassName="hover:bg-gray-100 transition duration-200"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RaiseDirectPORequest;