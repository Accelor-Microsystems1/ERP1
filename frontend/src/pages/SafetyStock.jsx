import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllPurchaseOrders } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SafetyStock = () => {
  const [components, setComponents] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBelowSafetyStock, setShowBelowSafetyStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'item_description', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  // Empirical formula: Safety Stock = Maximum Request - Average Request
  const calculateSafetyStock = (componentData) => {
    if (!componentData || componentData.length === 0) return 0;

    // Extract all requested quantities
    const requests = componentData.map(item => parseInt(item.updated_requested_quantity) || 0);
    if (requests.length === 0) return 0;

    // Calculate average request
    const totalRequest = requests.reduce((sum, qty) => sum + qty, 0);
    const avgRequest = totalRequest / requests.length;

    // Find maximum request
    const maxRequest = Math.max(...requests);

    // Safety stock: max request - avg request
    const safetyStock = maxRequest - avgRequest;

    // Debug logging
    console.log('Component Data:', componentData);
    console.log('Requests:', requests);
    console.log('Average Request:', avgRequest);
    console.log('Maximum Request:', maxRequest);
    console.log('Calculated Safety Stock:', Math.round(safetyStock));

    return Math.round(safetyStock) || 0;
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAllPurchaseOrders();
      const validData = response.data.filter((item) => item.component_id && item.po_number);

      const componentMap = new Map();
      validData.forEach((item) => {
        const key = item.component_id;
        if (!componentMap.has(key)) {
          componentMap.set(key, {
            component_id: key,
            item_description: item.item_description || '-',
            mpn: item.mpn || '-',
            total_on_hand_quantity: parseInt(item.on_hand_quantity) || 0,
            related_pos: [item.po_number],
            data: [item],
          });
        } else {
          const existing = componentMap.get(key);
          existing.total_on_hand_quantity += parseInt(item.on_hand_quantity) || 0;
          existing.related_pos.push(item.po_number);
          existing.data.push(item);
        }
      });

      const componentList = Array.from(componentMap.values()).map(comp => ({
        ...comp,
        safety_stock_quantity: calculateSafetyStock(comp.data),
      }));
      setComponents(componentList);
      setFilteredComponents(componentList);
    } catch (err) {
      console.error('Error fetching data:', { message: err.message, stack: err.stack });
      setError('Failed to fetch component data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token) {
      setError('No authentication token found. Please log in.');
      return;
    }
    if (role !== 'purchase_head' && role !== 'inventory_head') {
      setError('Unauthorized: Only users with the "purchase_head" role can access this page.');
      return;
    }
    fetchData();
  }, []);

  const sortData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      const valA = a[key] || '';
      const valB = b[key] || '';
      if (typeof valA === 'string') {
        return direction === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return direction === 'asc' ? valA - valB : valB - valA;
    });
  };

  const handleSort = (key) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    setFilteredComponents(sortData(filteredComponents, key, direction));
  };

  const applyFilters = (term) => {
    let filtered = [...components];
    if (term) {
      const searchTermLower = term.toLowerCase();
      filtered = filtered.filter(
        (component) =>
          component.item_description.toLowerCase().includes(searchTermLower) ||
          component.mpn.toLowerCase().includes(searchTermLower)
      );
    }
    if (showBelowSafetyStock) {
      filtered = filtered.filter(
        (component) => component.total_on_hand_quantity < component.safety_stock_quantity
      );
    }
    setFilteredComponents(sortData(filtered, sortConfig.key, sortConfig.direction));
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    applyFilters(term);
  };

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredComponents.slice(startIndex, endIndex);
  }, [filteredComponents, currentPage]);

  const totalPages = Math.ceil(filteredComponents.length / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const DynamicTable = ({ data, columns }) => (
    <table className="w-full text-sm text-left text-gray-700 table-auto border-collapse">
      <thead className="text-xs uppercase bg-gray-100 text-gray-800 sticky top-0 z-10">
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className="px-4 py-3 border-b border-gray-200"
              onClick={col.sortable ? () => handleSort(col.key) : undefined}
            >
              <div className="flex items-center">
                {col.label}
                {col.sortable && (
                  <span className="ml-2 text-gray-400">
                    {sortConfig.key === col.key
                      ? sortConfig.direction === 'asc'
                        ? '↑'
                        : '↓'
                      : '↕'}
                  </span>
                )}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 && !loading ? (
          <tr>
            <td colSpan={columns.length} className="px-4 py-3 text-center text-gray-500 border-b border-gray-200">
              No components found
            </td>
          </tr>
        ) : (
          data.map((item) => (
            <tr
              key={item.component_id}
              className={`transition-colors duration-200 border-b border-gray-200 hover:bg-gray-50 ${
                item.total_on_hand_quantity < item.safety_stock_quantity
                  ? 'text-red-600'
                  : 'text-gray-700'
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render ? col.render(item[col.key], item) : item[col.key] || '-'}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  const columns = useMemo(
    () => [
      { key: 'item_description', label: 'Item Description', sortable: true },
      { key: 'mpn', label: 'MPN', sortable: true },
      { key: 'total_on_hand_quantity', label: 'Total On Hand Qty', sortable: true },
      {
        key: 'safety_stock_quantity',
        label: 'Safety Stock',
        sortable: true,
        render: (value, component) => {
          const isBelowSafety = component.total_on_hand_quantity < value;
          return (
            <span className={isBelowSafety ? 'text-red-600 font-medium' : ''}>
              {value || '-'} {isBelowSafety && '(Below Safety Stock)'}
            </span>
          );
        },
      },
      {
        key: 'related_pos',
        label: 'Related POs',
        sortable: false,
        render: (value) => (
          <div className="flex flex-wrap gap-2">
            {value.map((po_number) => (
              <button
                key={po_number}
                onClick={() => navigate(`/purchase-orders?po_number=${po_number}`)}
                className="text-blue-600 hover:underline text-sm"
              >
                {po_number}
              </button>
            ))}
          </div>
        ),
      },
    ],
    [navigate]
  );

  const summaryStats = useMemo(() => ({
    totalComponents: components.length,
    belowSafety: components.filter(c => c.total_on_hand_quantity < c.safety_stock_quantity).length,
    avgSafetyStock: components.length
      ? Math.round(components.reduce((sum, c) => sum + c.safety_stock_quantity, 0) / components.length)
      : 0,
  }), [components]);

  // Chart Data Preparation
  const belowSafetyData = components.filter(
    (comp) => comp.total_on_hand_quantity < comp.safety_stock_quantity
  ).map(comp => ({
    name: comp.item_description,
    onHand: comp.total_on_hand_quantity,
    safetyStock: comp.safety_stock_quantity,
  }));

  const demandTrendData = components.map(comp => {
    const demands = comp.data.map(item => parseInt(item.updated_requested_quantity) || 0);
    return {
      name: comp.item_description,
      period1: demands[0] || 0,
      period2: demands[1] || 0,
      period3: demands[2] || 0,
    };
  });

  return (
    <div className="flex p-12 flex-col h-screen bg-gray-100 overflow-y-auto">
      {/* Header */}
      {/* <header className="bg-indigo-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">ACME Inventory</h1>
          <button className="bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-lg text-sm">
            Logout
          </button>
        </div>
      </header> */}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Safety Stock Overview</h1>
          <p className="text-gray-600 mt-2">
            Monitor and analyze safety stock levels to prevent stockouts and optimize inventory.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800">Total Components</h3>
            <p className="text-3xl font-bold text-indigo-600 mt-2">{summaryStats.totalComponents}</p>
          </div>
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800">Below Safety Stock</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">{summaryStats.belowSafety}</p>
          </div>
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800">Average Safety Stock</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{summaryStats.avgSafetyStock}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <input
              value={searchTerm}
              onChange={handleSearchChange}
              type="text"
              placeholder="Search by Description or MPN"
              className="px-4 py-2 border rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 w-full sm:w-1/3 text-sm"
            />
            <button
              onClick={() => {
                setShowBelowSafetyStock(!showBelowSafetyStock);
                applyFilters(searchTerm);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                showBelowSafetyStock
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showBelowSafetyStock ? 'Show All Components' : 'Show Below Safety Stock'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
          <div className="relative overflow-x-auto max-h-[50vh] overflow-y-auto">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-10">
                <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
            <DynamicTable data={paginatedData} columns={columns} />
          </div>

                  {/* Charts */}
                  <div>
                  
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white shadow-lg rounded-lg p-6 overflow-x-auto">
            
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Components Below Safety Stock</h3>
            <div className="min-w-[300px]">
              {belowSafetyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={256}>
                  <BarChart data={belowSafetyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" label={{ value: 'Components', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Quantity', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend verticalAlign="top" />
                    <Bar dataKey="onHand" name="On Hand Quantity" fill="#ff6384" />
                    <Bar dataKey="safetyStock" name="Safety Stock" fill="#36a2eb" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500">No components below safety stock.</p>
              )}
            </div>
          </div>
          <div className="bg-white shadow-lg rounded-lg p-6 overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Demand Trends Over Time</h3>
            <div className="min-w-[300px]">
              {demandTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={256}>
                  <LineChart data={demandTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" label={{ value: 'Components', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Demand Quantity', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend verticalAlign="top" />
                    <Line type="monotone" dataKey="period1" name="Period 1" stroke="#8884d8" />
                    <Line type="monotone" dataKey="period2" name="Period 2" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="period3" name="Period 3" stroke="#ffc107" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500">No demand data available.</p>
              )}
            </div>
          </div>
        </div>
        </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mb-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  currentPage === page
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SafetyStock;