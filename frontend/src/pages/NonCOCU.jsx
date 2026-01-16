import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { addToBasket, fetchStockCardData, fetchPurchaseOrderDetails, fetchMyRequests } from "../utils/api.js";
import axios from "axios";
import { FaSearch, FaShoppingCart, FaFilter, FaArrowLeft } from "react-icons/fa";
import { Table, DatePicker, Dropdown, Menu } from "antd";
import moment from "moment";
import Loader from "../components/loading.jsx";

// API base URL for direct axios calls
const API_BASE_URL = "https://erp1-iwt1.onrender.com/api/non_coc_components";

const NonCOCU = () => {
  // State declarations
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("description");
  const [searchResults, setSearchResults] = useState([]);
  const [allComponents, setAllComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [stockCardData, setStockCardData] = useState([]);
  const [purchaseOrderData, setPurchaseOrderData] = useState([]);
  const [periodFrom, setPeriodFrom] = useState(null);
  const [periodTo, setPeriodTo] = useState(null);
  const [isViewBasketDisabled, setIsViewBasketDisabled] = useState(false);

  // Refs for sticky header functionality
  const tableContainerRef = useRef(null);
  const tableHeaderRef = useRef(null);
  const tableWrapperRef = useRef(null);

  const navigate = useNavigate();

  // Debug useEffect to log purchaseOrderData changes
  useEffect(() => {
    console.log("Purchase Order Data updated:", purchaseOrderData);
    const filtered = purchaseOrderData.filter(
      (order) => order.status !== "Warehouse In" && order.status !== "Warehouse In (Backorder Complete)"
    );
    console.log("Filtered Purchase Order Data:", filtered);
  }, [purchaseOrderData]);

  // Sticky header effect adapted from PastPoInv
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const tableHeader = tableHeaderRef.current;
    const tableWrapper = tableWrapperRef.current;

    if (!tableContainer || !tableHeader || !tableWrapper) {
      console.log('Table elements not found:', { tableContainer, tableHeader, tableWrapper });
      return;
    }

    const table = tableContainer.querySelector('.ant-table-tbody');
    if (!table) {
      console.log('Table body not found inside tableContainer');
      return;
    }

    const applyStickyFallback = () => {
      console.log('Applying sticky fallback for table headers');

      const setColumnWidths = () => {
        const headerCells = tableHeader.querySelectorAll('th');
        const firstRow = table.querySelector('.ant-table-row');
        if (!firstRow) return;

        const bodyCells = firstRow.querySelectorAll('td');
        if (headerCells.length !== bodyCells.length) {
          console.warn('Header and body cell count mismatch:', headerCells.length, bodyCells.length);
          return;
        }

        headerCells.forEach((headerCell, index) => {
          const bodyCell = bodyCells[index];
          const bodyCellWidth = bodyCell.getBoundingClientRect().width;
          headerCell.style.width = `${bodyCellWidth}px`;
          headerCell.style.minWidth = `${bodyCellWidth}px`;
          headerCell.style.maxWidth = `${bodyCellWidth}px`;
          console.log(`Set width for column ${index}: ${bodyCellWidth}px`);
        });
      };

      const handleScroll = () => {
        const containerRect = tableContainer.getBoundingClientRect();
        const scrollTop = tableContainer.scrollTop;
        const scrollLeft = tableWrapper.scrollLeft;

        const tableWidth = tableContainer.querySelector('.ant-table').scrollWidth;

        console.log('Scroll event triggered:', {
          containerTop: containerRect.top,
          scrollTop: scrollTop,
          scrollLeft: scrollLeft,
          tableWidth: tableWidth,
        });

        if (scrollTop > 0) {
          tableHeader.style.position = 'fixed';
          tableHeader.style.top = `${containerRect.top}px`;
          tableHeader.style.left = `${containerRect.left - scrollLeft}px`;
          tableHeader.style.width = `${tableWidth}px`;
          tableHeader.style.zIndex = '10';
          tableHeader.style.background = '#fafafa';
          tableHeader.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
          tableHeader.style.borderBottom = '2px solid #d2d6dc';

          setColumnWidths();
        } else {
          tableHeader.style.position = 'relative';
          tableHeader.style.top = 'auto';
          tableHeader.style.left = 'auto';
          tableHeader.style.width = 'auto';
          tableHeader.style.boxShadow = 'none';

          const headerCells = tableHeader.querySelectorAll('th');
          headerCells.forEach((cell) => {
            cell.style.width = 'auto';
            cell.style.minWidth = 'auto';
            cell.style.maxWidth = 'auto';
          });
        }
      };

      tableContainer.addEventListener('scroll', handleScroll);
      tableWrapper.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);

      handleScroll();

      return () => {
        tableContainer.removeEventListener('scroll', handleScroll);
        tableWrapper.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    };

    applyStickyFallback();
  }, [showTable, allComponents, selectedComponent, stockCardData, purchaseOrderData]);

  // Fetch all components to display in the table
  const fetchAllComponents = async () => {
    setLoading(true);
    setError(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedComponent(null);
    setStockCardData([]);
    setPurchaseOrderData([]);
    setShowTable(true);

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
      fetchAllComponents(); // If query is empty, fetch all components
      return;
    }

    setLoading(true);
    setError(null);
    setShowTable(true);
    setSelectedComponent(null);
    setStockCardData([]);
    setPurchaseOrderData([]);

    try {
      // Make the search case-insensitive by converting query to lowercase
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
      setAllComponents(results); // Update the table with search results
    } catch (error) {
      console.error("Error fetching search results:", error.response?.data || error.message);
      setError("Failed to fetch search results. Please try again.");
      setSearchResults([]);
      setAllComponents([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stock card data with date filters
  const fetchStockCardDataWithFilter = async (componentId) => {
    setLoading(true);
    try {
      const data = await fetchStockCardData(componentId, periodFrom, periodTo);
      setStockCardData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching stock card data:", error.message);
      setError("Failed to fetch stock card data. Please try again.");
      setStockCardData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchase order details using the updated API function
  const fetchPurchaseOrderData = async (componentId) => {
    setLoading(true);
    try {
      const data = await fetchPurchaseOrderDetails(componentId);
      setPurchaseOrderData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching purchase order data:", error.message);
      setError("Failed to fetch purchase order data. Please try again.");
      setPurchaseOrderData([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle component row click to show details
  const handleComponentClick = async (component) => {
    setSelectedComponent(component);
    setShowTable(false);
    setError(null);

    // Fetch stock card and purchase order data in parallel
    await Promise.all([
      fetchStockCardDataWithFilter(component.component_id),
      fetchPurchaseOrderData(component.component_id),
    ]);
  };

  // Handle date filter changes
  const onPeriodFromChange = (date, dateString) => {
    setPeriodFrom(dateString || null);
    if (selectedComponent) {
      fetchStockCardDataWithFilter(selectedComponent.component_id);
    }
  };

  const onPeriodToChange = (date, dateString) => {
    setPeriodTo(dateString || null);
    if (selectedComponent) {
      fetchStockCardDataWithFilter(selectedComponent.component_id);
    }
  };

  // Add component to basket
  const handleAddToBasket = async (item) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("You need to login first");
      navigate("/login");
      return;
    }
    if (!item?.component_id) {
      alert("Invalid component details.");
      return;
    }

    setLoading(true);
    try {
      await addToBasket(item);
      alert("Item added to basket successfully! 🛒");
    } catch (error) {
      console.error("Error adding to basket:", error.message);
      alert(error.response?.data?.message || "Failed to add to basket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Check for receiving pending requests for the logged-in user
  useEffect(() => {
    const checkPendingRequests = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      setLoading(true);
      try {
        const response = await fetchMyRequests();
        const userRequests = response || [];
        const hasPending = userRequests.some(
          (req) => req.status?.toLowerCase()?.includes("receiving pending")
        );
        setIsViewBasketDisabled(hasPending);
      } catch (error) {+
        console.error("Error checking pending requests:", error.message);
        setIsViewBasketDisabled(false); // Default to enabled on error
      } finally {
        setLoading(false);
      }
    };

    checkPendingRequests();
  }, []);

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

  // Columns for the components table
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
    { title: "On Hand Qty", dataIndex: "on_hand_quantity", key: "on_hand_quantity" },
    {
      title: "UoM",
      dataIndex: "uom",
      key: "uom",
      render: (text) => <span className="leading-tight">{text || "-"}</span>,
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <div className="flex flex-row gap-2">
          <button
            className="bg-gradient-to-r from-green-500 to-green-700 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-400 transition duration-300 transform hover:scale-105 hover:shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              handleAddToBasket(record);
            }}
          >
            Add to Basket
          </button>
        </div>
      ),
    },
  ];

  // Columns for the stock card table with font color based on UMI
  const stockColumns = [
    {
      title: "S.No.",
      key: "sno",
      render: (text, record, index) => (
        <span className={!record.umi ? "text-green-700" : "text-red-700"}>{index + 1}</span>
      ),
    },
    {
      title: "Date",
      dataIndex: "transaction_date",
      key: "transaction_date",
      render: (text, record) => (
        <span className={!record.umi ? "text-green-700" : "text-red-700"}>
          {text && moment(text).isValid() ? moment(text).format("YYYY-MM-DD HH:mm:ss") : "-"}
        </span>
      ),
    },
    {
      title: "MI",
      dataIndex: "mi",
      key: "mi",
      render: (text, record) => (
        <span className={!record.umi ? "text-green-700" : "text-red-700"}>{text || "-"}</span>
      ),
    },
    {
      title: "UMI",
      dataIndex: "umi",
      key: "umi",
      render: (text, record) => (
        <span className={!record.umi ? "text-green-700" : "text-red-700"}>{text || "-"}</span>
      ),
    },
    {
      title: "Requested By",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <span className={!record.umi ? "text-green-700" : "text-red-700"}>{text || "-"}</span>
      ),
    },
    {
      title: "Requested Quantity",
      dataIndex: "requested_quantity",
      key: "requested_quantity",
      render: (text, record) => (
        <span className={!record.umi ? "text-green-700" : "text-red-700"}>{text}</span>
      ),
    },
    {
      title: "Issued Quantity",
      dataIndex: "issued_quantity",
      key: "issued_quantity",
      render: (text, record) => (
        <span className={!record.umi ? "text-green-700" : "text-red-700"}>{text || "0"}</span>
      ),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      render: (text, record) => (
        <span className={!record.umi ? "text-green-700" : "text-red-700"}>{text}</span>
      ),
    },
  ].map((column) => ({
    ...column,
    className: "font-medium",
  }));

  // Columns for the purchase order table
  const purchaseOrderColumns = [
    { title: "S.No.", key: "sno", render: (text, record, index) => index + 1 },
    { title: "PO No", dataIndex: "po_number", key: "po_number", render: (text) => text || "-" },
    { title: "MRF No", dataIndex: "mrf_no", key: "mrf_no", render: (text) => text || "-" },
    { title: "Ordered Qty", dataIndex: "ordered_quantity", key: "ordered_quantity", render: (text) => text || "0" },
    { title: "Requested By", dataIndex: "requested_by", key: "requested_by", render: (text) => text || "-" },
    { title: "Backorder Sequence", dataIndex: "backorder_sequence", key: "backorder_sequence", render: (text) => text || "-" },
    {
      title: "Expected Delivery Date",
      dataIndex: "expected_delivery_date",
      key: "expected_delivery_date",
      render: (date) => (date ? new Date(date).toLocaleDateString() : "-"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (text) => {
        let statusClass = "";
        let hoverClass = "";
        switch (text) {
          case "QC Cleared":
            statusClass = "bg-green-100 text-green-800";
            hoverClass = "hover:bg-green-200";
            break;
          case "Material Delivered & Quality Check Pending":
            statusClass = "bg-red-100 text-red-800";
            hoverClass = "hover:bg-red-200";
            break;
          case "QC Hold":
            statusClass = "bg-yellow-100 text-yellow-800";
            hoverClass = "hover:bg-yellow-200";
            break;
          case "Material Delivery Pending":
            statusClass = "bg-purple-100 text-purple-800";
            hoverClass = "hover:bg-purple-200";
            break;
          default:
            statusClass = "bg-blue-100 text-blue-800";
            hoverClass = "hover:bg-blue-200";
        }
        return (
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium transition duration-300 ${statusClass} ${hoverClass}`}
          >
            {text || "-"}
          </span>
        );
      },
    },
  ].map((column) => ({
    ...column,
    className: "font-medium text-gray-800",
  }));

  // Filter purchase order data to exclude "Warehouse In" status
  const filteredPurchaseOrderData = purchaseOrderData.filter(
    (order) => order.status !== "Warehouse In" && order.status !== "Warehouse In (Backorder Complete)"
  );

  return (
    <div className="h-screen overflow-y-auto overflow-x-auto">
      <div className="p-16">
        {/* Search Bar with Back Button */}
        <div className="flex items-center mb-4 mt-4">
          {selectedComponent && (
            <button
              className="text-gray-800 rounded-full p-2 hover:bg-gray-200 transition duration-300 transform hover:scale-105 mr-4"
              onClick={() => {
                setSelectedComponent(null);
                setShowTable(true);
                setStockCardData([]);
                setPurchaseOrderData([]);
                setError(null);
              }}
            >
              <FaArrowLeft />
            </button>
          )}
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
    className={`px-6 py-2 rounded-full whitespace-nowrap transition duration-300 transform shadow-md flex items-center gap-2 ${
      isViewBasketDisabled
        ? 'bg-gray-300 text-white cursor-not-allowed'
        : 'bg-red-500 text-white hover:bg-red-400 hover:scale-105 hover:shadow-lg'
    }`}
    onClick={() => navigate("/noncocbasket")}
    disabled={isViewBasketDisabled}
   
  >
    <FaShoppingCart className="inline" /> View Basket
  </button>

  {isViewBasketDisabled && (
  <div className="flex items-center bg-red-100 text-red-700 px-4 py-2 rounded-lg shadow-sm">
    <svg
      className="w-5 h-5 mr-2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="text-sm font-medium">
      Kindly close your receivings to generate a new request.
    </span>
  </div>
)}



            </div>
          </div>
        </div>

        {/* Loading & Error Messages */}
        {loading && <Loader className="flex justify-center items-center" />}
        {error && !loading && <p className="text-red-500 text-center mb-4">{error}</p>}

        {/* Component Table */}
        {showTable && !loading && (
          <div className="w-full bg-white rounded-xl shadow-xl h-[calc(100vh-150px)]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {searchResults.length > 0 ? "Search Results" : ""}
              </h2>
            </div>
            <div className="table-container h-[calc(100%-80px)] overflow-y-auto overflow-x-auto border-t-0" ref={tableContainerRef}>
              <div className="table-wrapper" ref={tableWrapperRef}>
                <Table
                  columns={columns}
                  dataSource={allComponents}
                  pagination={false}
                  bordered
                  tableLayout="fixed"
                  className="min-w-full"
                  rowClassName="cursor-pointer hover:bg-gray-100 transition duration-200"
                  onRow={(record) => ({
                    onClick: () => handleComponentClick(record),
                  })}
                  components={{
                    header: {
                      wrapper: (props) => <thead ref={tableHeaderRef} {...props} />,
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Selected Component Details */}
        {selectedComponent && !loading && (
          <div className="w-full">
            {/* Component Details Header */}
            <div className="bg-[#32328e] text-white p-6 rounded-xl shadow-2xl mb-6 overflow-x-auto">
              <div className="grid grid-cols-7 gap-4 min-w-[1200px]">
                <div className="p-4 bg-white/20 rounded-lg text-center hover:bg-white/30 transition duration-300">
                  <p className="text-lg font-bold">Description</p>
                  <p className="text-lg font-semibold break-words">{selectedComponent.item_description || "-"}</p>
                </div>
                <div className="p-4 bg-white/20 rounded-lg text-center hover:bg-white/30 transition duration-300">
                  <p className="text-lg font-bold">Part No.</p>
                  <p className="text-lg font-semibold">{selectedComponent.part_no || "-"}</p>
                </div>
                <div className="p-4 bg-white/20 rounded-lg text-center hover:bg-white/30 transition duration-300">
                  <p className="text-lg font-bold">MPN</p>
                  <p className="text-lg font-semibold">{selectedComponent.mpn || "-"}</p>
                </div>
                <div className="p-4 bg-white/20 rounded-lg text-center hover:bg-white/30 transition duration-300">
                  <p className="text-lg font-bold">Make</p>
                  <p className="text-lg font-semibold">{selectedComponent.make || "-"}</p>
                </div>
                <div className="p-4 bg-white/20 rounded-lg text-center hover:bg-white/30 transition duration-300">
                  <p className="text-lg font-bold">On Hand Qty</p>
                  <p className="text-lg font-semibold">{selectedComponent.on_hand_quantity || "0"}</p>
                </div>
                <div className="p-4 bg-white/20 rounded-lg text-center hover:bg-white/30 transition duration-300">
                  <p className="text-lg font-bold">UoM</p>
                  <p className="text-lg font-semibold">{selectedComponent.uom || "-"}</p>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <button
                    className="bg-gradient-to-r from-green-500 to-green-700 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-400 transition duration-300 transform hover:scale-105 hover:shadow-lg"
                    onClick={() => handleAddToBasket(selectedComponent)}
                  >
                    Add to Basket
                  </button>
                </div>
              </div>
            </div>

            {/* Purchase Order and Stock Card Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Purchase Order Details Section */}
              {filteredPurchaseOrderData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-2xl">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Purchase Order Details</h2>
                  <div className="overflow-x-auto">
                    <div className="max-h-[60vh] overflow-y-auto">
                      <Table
                        columns={purchaseOrderColumns}
                        dataSource={filteredPurchaseOrderData}
                        pagination={false}
                        bordered
                        className="min-w-full"
                        rowClassName={(record) =>
                          record.row_type === "Purchase Order" ? "bg-gray-50" : "bg-blue-50"
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Stock Card Section */}
              <div className="bg-white p-6 rounded-xl shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">Stock Card</h2>
                  <div className="flex gap-4 items-center">
                    <span className="text-lg font-medium text-gray-700">
                      Balance Stock: {selectedComponent.on_hand_quantity || "0"}
                    </span>
                    <DatePicker
                      onChange={onPeriodFromChange}
                      value={periodFrom ? moment(periodFrom) : null}
                      format="YYYY-MM-DD"
                      placeholder="Period From"
                      className="w-full md:w-auto border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <DatePicker
                      onChange={onPeriodToChange}
                      value={periodTo ? moment(periodTo) : null}
                      format="YYYY-MM-DD"
                      placeholder="Period To"
                      className="w-full md:w-auto border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="max-h-[60vh] overflow-y-auto">
                    <Table
                      columns={stockColumns}
                      dataSource={stockCardData}
                      pagination={false}
                      bordered
                      className="min-w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: auto;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        .h-screen {
          min-height: 100vh;
          background: #f7f9fc;
        }
        .table-container {
          position: relative;
          height: calc(100% - 2px);
          overflow-y: auto;
          overflow-x: auto;
          border-radius: 0 0 12px 12px;
          background: #ffffff;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          isolation: isolate;
        }
        .table-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .table-container::-webkit-scrollbar,
        .table-wrapper::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .table-container::-webkit-scrollbar-track,
        .table-wrapper::-webkit-scrollbar-track {
          background: #f1f3f5;
          border-radius: 3px;
        }
        .table-container::-webkit-scrollbar-thumb,
        .table-wrapper::-webkit-scrollbar-thumb {
          background: #b0b7c3;
          border-radius: 3px;
        }
        .ant-table {
          min-width: 100%;
          table-layout: auto;
        }
        .ant-table-thead > tr > th {
          font-weight: 600;
          color: #1f2937;
          text-align: center;
          white-space: nowrap;
          background: #f8fafc;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
        }
        .ant-table-tbody > tr > td {
          padding: 10px 16px;
          font-size: 14px;
          border-bottom: 1px solid #e5e7eb;
        }
        button, select {
          transition: all 0.2s ease-in-out;
        }
        select {
          background: #f9fafb;
        }
        select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        button:disabled {
          background-color: #d1d5db;
          cursor: not-allowed;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
};

export default NonCOCU;