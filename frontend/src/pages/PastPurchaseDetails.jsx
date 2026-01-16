import React, { useState, useEffect } from 'react';
import { Table, Input, Button, Select, Modal, message, Spin, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { fetchPreviousPurchases } from '../utils/api';

const { Option } = Select;

const API_BASE_URL = 'https://erp1-iwt1.onrender.com/api/non_coc_components';

const PastPurchaseDetails = () => {
  const [allComponents, setAllComponents] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('component');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [columnVisibilityVisible, setColumnVisibilityVisible] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({
    item_description: true,
    mpn: true,
    part_no: true,
    make: true,
    uom: true,
    previous_purchases: true,
  });

  // Fetch all components and their previous purchases
  const fetchAllComponents = async () => {
    setLoading(true);
    setError(null);
    setSearchQuery('');
    setFilteredComponents([]);
    setAllComponents([]);

    try {
      // Fetch all components
      const response = await axios.get(`${API_BASE_URL}/all`);
      let components = response.data || [];

      // Fetch previous purchases for each component
      components = await Promise.all(
        components.map(async (component) => {
          try {
            const filters = { componentId: component.component_id };
            const purchases = await fetchPreviousPurchases(filters);
            // Extract unique vendor names and PO numbers
            const vendorNames = [...new Set(purchases.map((p) => p.vendor_name?.toLowerCase()).filter(Boolean))];
            const poNumbers = [...new Set(purchases.map((p) => p.po_number?.toLowerCase()).filter(Boolean))];
            return {
              ...component,
              vendor_names: vendorNames, // For search filtering
              po_numbers: poNumbers, // For search filtering
              previous_purchases: purchases, // Full data for modal
            };
          } catch (error) {
            console.error(`Error fetching purchases for component ${component.component_id}:`, error.message);
            return {
              ...component,
              vendor_names: [],
              po_numbers: [],
              previous_purchases: [],
            };
          }
        })
      );

      setAllComponents(components);
      setFilteredComponents(components);
    } catch (error) {
      console.error('Error fetching all components:', error.message);
      setError('Failed to load components. Please try again.');
      setAllComponents([]);
      setFilteredComponents([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch previous purchases for a specific component (for modal)
  const fetchComponentPreviousPurchases = async (component_id) => {
    setModalLoading(true);
    try {
      const component = allComponents.find((c) => c.component_id === component_id);
      if (component && component.previous_purchases?.length) {
        // Use cached data if available
        const enhancedData = component.previous_purchases.map((item) => ({
          ...item,
          updated_requested_quantity: item.updated_requested_quantity || 'N/A',
          amount: item.amount || 0,
          created_at: item.created_at || 'N/A',
        }));
        setModalData(enhancedData);
      } else {
        // Fallback to API call
        const filters = { componentId: component_id };
        const data = await fetchPreviousPurchases(filters);
        const enhancedData = data.map((item) => ({
          ...item,
          updated_requested_quantity: item.updated_requested_quantity || 'N/A',
          amount: item.amount || 0,
          created_at: item.created_at || 'N/A',
        }));
        setModalData(enhancedData);
      }
    } catch (error) {
      console.error('Error fetching previous purchases:', error.message);
      message.error('Failed to fetch previous purchase details.');
      setModalData([]);
    } finally {
      setModalLoading(false);
    }
  };

  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredComponents(allComponents);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = allComponents.filter((component) => {
      if (searchType === 'component') {
        return (
          component.item_description?.toLowerCase().includes(lowerQuery) ||
          component.mpn?.toLowerCase().includes(lowerQuery) ||
          component.part_no?.toLowerCase().includes(lowerQuery)
        );
      } else if (searchType === 'vendor') {
        return component.vendor_names.some((name) => name.includes(lowerQuery));
      } else if (searchType === 'po_number') {
        return component.po_numbers.some((po) => po.includes(lowerQuery));
      }
      return false;
    });

    setFilteredComponents(filtered);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (!value.trim()) {
      setFilteredComponents(allComponents);
    }
  };

  // Show modal with previous purchase details
  const showModal = (component_id) => {
    fetchComponentPreviousPurchases(component_id);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchAllComponents();
  }, []);

  // Table columns for components
  const componentColumns = [
    {
      title: 'Description',
      dataIndex: 'item_description',
      key: 'item_description',
      width: 200,
      render: (text) => <span className="text-gray-700">{text || '-'}</span>,
      hidden: !columnVisibility.item_description,
    },
    {
      title: 'MPN',
      dataIndex: 'mpn',
      key: 'mpn',
      width: 150,
      render: (text) => <span className="text-gray-700">{text || '-'}</span>,
      hidden: !columnVisibility.mpn,
    },
    {
      title: 'Part No.',
      dataIndex: 'part_no',
      key: 'part_no',
      width: 150,
      render: (text) => <span className="text-gray-700">{text || '-'}</span>,
      hidden: !columnVisibility.part_no,
    },
    {
      title: 'Make',
      dataIndex: 'make',
      key: 'make',
      width: 150,
      render: (text) => <span className="text-gray-700">{text || '-'}</span>,
      hidden: !columnVisibility.make,
    },
    {
      title: 'UoM',
      dataIndex: 'uom',
      key: 'uom',
      width: 100,
      render: (text) => <span className="text-gray-700">{text || '-'}</span>,
      hidden: !columnVisibility.uom,
    },
    {
      title: 'Previous Purchases',
      key: 'previous_purchases',
      width: 150,
      render: (_, record) => (
        <Button
          type="link"
          className="text-blue-600 hover:text-blue-800"
          onClick={() => showModal(record.component_id)}
        >
          View Details
        </Button>
      ),
      hidden: !columnVisibility.previous_purchases,
    },
  ].filter((col) => !col.hidden);

  // Modal table columns for previous purchases
  const modalColumns = [
    {
      title: 'PO Number',
      dataIndex: 'po_number',
      key: 'po_number',
      width: 150,
    },
    {
      title: 'Purchase Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Vendor Name',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
      width: 150,
    },
    {
      title: 'Ordered Quantity',
      dataIndex: 'updated_requested_quantity',
      key: 'updated_requested_quantity',
      width: 120,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Rate/Unit',
      dataIndex: 'rate_per_unit',
      key: 'rate_per_unit',
      width: 100,
      render: (text) => (typeof text === 'number' ? text.toFixed(2) : parseFloat(text) || 0).toFixed(2),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (text) => (typeof text === 'number' ? text.toFixed(2) : parseFloat(text) || 0).toFixed(2),
    },
  ];

  return (
    <div className="page-container my-4">
      <div className="content-wrapper">
        <div className="mb-1">
          <h1 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-200 pb-4">
            Past Purchase Details
          </h1>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-2 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg shadow-sm">
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <Select
              value={searchType}
              onChange={(value) => setSearchType(value)}
              className="w-32"
            >
              <Option value="component">Component</Option>
              <Option value="vendor">Vendor</Option>
              <Option value="po_number">PO Number</Option>
            </Select>
            <Input
              placeholder={`Search by ${searchType.replace('_', ' ')}`}
              value={searchQuery}
              onChange={handleSearchChange}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined className="text-gray-400" />}
              className="w-full sm:w-64 rounded-lg"
            />
            <Button
              type="primary"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSearch}
            >
              Search
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-blue-500 text-white hover:bg-blue-600 transition duration-300"
              onClick={fetchAllComponents}
            >
              View All
            </Button>
            <Button
              className="!bg-yellow-500 !text-white hover:!bg-teal-500 transition duration-300"
              onClick={() => setColumnVisibilityVisible(true)}
            >
              Customize Columns
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Components Table */}
        <div className="table-container">
          <Table
            columns={componentColumns}
            dataSource={filteredComponents}
            rowKey="component_id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
            }}
            bordered
            loading={loading}
            className="w-full bg-white rounded-lg shadow-md"
            scroll={{ x: 1000, y: 'calc(100vh - 300px)' }}
            sticky
          />
        </div>

        {/* Previous Purchases Modal */}
        <Modal
          title="Previous Purchase Details"
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setModalVisible(false)}>
              Close
            </Button>,
          ]}
          width={800}
        >
          {modalLoading ? (
            <div className="flex justify-center py-8">
              <Spin size="large" />
            </div>
          ) : (
            <div>
              <Table
                columns={modalColumns}
                dataSource={modalData}
                pagination={false}
                bordered
                rowKey="po_number"
                className="w-full"
              />
              <p className="text-red-600 mt-2">
                * Amount is the Basic Total, and the GST was paid extra.
              </p>
            </div>
          )}
        </Modal>

        {/* Customize Columns Modal */}
        <Modal
          title="Customize Columns"
          open={columnVisibilityVisible}
          onCancel={() => setColumnVisibilityVisible(false)}
          footer={[
            <Button key="save" type="primary" onClick={() => setColumnVisibilityVisible(false)}>
              Save
            </Button>,
            <Button key="cancel" onClick={() => setColumnVisibilityVisible(false)}>
              Cancel
            </Button>,
          ]}
          width={400}
        >
          {Object.keys(columnVisibility).map((key) => (
            <div key={key} className="flex items-center mb-2">
              <Checkbox
                checked={columnVisibility[key]}
                onChange={(e) => setColumnVisibility({ ...columnVisibility, [key]: e.target.checked })}
              >
                {componentColumns.find((col) => col.key === key)?.title ||
                  key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Checkbox>
            </div>
          ))}
        </Modal>
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        .page-container {
          height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          overflow-y: auto;
          padding: 1.5rem;
        }

        .content-wrapper {
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 1rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .table-container {
          width: 100%;
          overflow: auto;
        }

        .ant-table-wrapper {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
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
          border: 2px solid #f1f1f1;
        }

        .ant-table-wrapper::-webkit-scrollbar-thumb:hover {
          background: #555;
        }

        .ant-table-thead > tr > th {
          background: #f8fafc;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
          text-align: left;
          padding: 12px 16px;
          font-size: 14px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
          text-align: left;
          padding: 12px 16px;
          font-size: 13px;
        }

        .ant-table-tbody > tr:hover > td {
          background: #f0f7ff;
        }

        .ant-select-single .ant-select-selector,
        .ant-input {
          border-radius: 8px !important;
          border: 1px solid #d1d5db !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
        }

        .ant-btn-primary {
          border-radius: 8px !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default PastPurchaseDetails;