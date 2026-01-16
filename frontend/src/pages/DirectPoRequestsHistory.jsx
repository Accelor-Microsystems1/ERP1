import React, { useState, useEffect } from 'react';
import { Table, Spin, message, Modal, Card, Typography, Row, Col, Input, Button, Select, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import moment from 'moment';
import { fetchDirectPoHistory } from '../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

const DirectPoRequestsHistory = () => {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('sequence');
  const [columnVisibilityVisible, setColumnVisibilityVisible] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

const fetchData = async () => {
  setLoading(true);
  try {
    const data = await fetchDirectPoHistory();
    console.log('Raw API data:', data);

    const formattedData = data.reduce((acc, row) => {
      const sequence = row.direct_sequence || 'N/A';
      if (!acc[sequence]) {
        acc[sequence] = {
          key: sequence,
          direct_sequence: sequence,
          vendor: row.vendor || 'N/A',
          created_at: row.created_at !== 'N/A' ? moment(row.created_at).utcOffset('+05:30').format('DD-MM-YYYY') : 'N/A',
          remark: row.note || 'N/A',
          project_name: row.project_name || 'N/A',
          mrf_no: row.mrf_no || 'N/A',
          total_po_cost: parseFloat(row.total_po_cost || 0),
          submitted_at: row.submitted_at !== 'N/A' ? moment(row.submitted_at).utcOffset('+05:30').format('DD-MM-YYYY') : 'N/A',
          components: [],
        };
      }
      acc[sequence].components.push({
        component_id: row.id || null,
        mpn: row.mpn || 'N/A',
        item_description: row.item_description || 'N/A',
        make: row.make || 'N/A',
        part_no: row.part_no || 'N/A',
        requested_quantity: parseInt(row.requested_quantity, 10) || 0,
        uom: row.uom || 'N/A',
        vendor: row.vendor || 'N/A',
        rate_per_unit: parseFloat(row.rate_per_unit) || 0,
        amount_inr: parseFloat(row.amount_inr) || 0,
        gst_type: row.gst_type || 'N/A',
        gst_amount: parseFloat(row.gst_amount) || 0,
        total_po_cost: parseFloat(row.total_po_cost) || 0,
        note: row.note || 'N/A',
        status: row.status || 'N/A',
      });
      return acc;
    }, {});

    const requestsData = Object.values(formattedData);
    console.log('Formatted data:', requestsData);
    setRequests(requestsData);
    setFilteredRequests(requestsData);

    const initialColumnVisibility = columns.reduce((acc, col) => {
      acc[col.key] = true;
      return acc;
    }, {});
    setColumnVisibility(initialColumnVisibility);
  } catch (error) {
    console.error('Fetch data error:', error);
    message.error(`Failed to fetch requests: ${error.message}`);
  } finally {
    setLoading(false);
    console.log('Loading state set to false');
  }
};

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredRequests(requests);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = requests.filter((request) => {
      if (searchType === 'sequence') {
        return request.direct_sequence.toLowerCase().includes(lowerQuery);
      } else if (searchType === 'vendor') {
        return request.vendor.toLowerCase().includes(lowerQuery);
      } else if (searchType === 'component') {
        return request.components.some((comp) =>
          comp.item_description.toLowerCase().includes(lowerQuery) ||
          comp.mpn.toLowerCase().includes(lowerQuery) ||
          comp.part_no.toLowerCase().includes(lowerQuery) ||
          comp.make.toLowerCase().includes(lowerQuery) ||
          comp.status.toLowerCase().includes(lowerQuery)
        );
      }
      return false;
    });

    setFilteredRequests(filtered);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (!value.trim()) {
      setFilteredRequests(requests);
    }
  };

  const columns = [
    { title: 'Sequence No', dataIndex: 'direct_sequence', key: 'direct_sequence' },
    { title: 'MRF No', dataIndex: 'mrf_no', key: 'mrf_no' },
    { title: 'Project Name', dataIndex: 'project_name', key: 'project_name' },
    { title: 'Vendor', dataIndex: 'vendor', key: 'vendor' },
    { title: 'Created At', dataIndex: 'created_at', key: 'created_at' },
    {
      title: 'Total PO Cost',
      dataIndex: 'total_po_cost',
      key: 'total_po_cost',
      render: (totalPoCost) => `₹${totalPoCost.toFixed(2)}`,
    },
    //{ title: 'Submitted At', dataIndex: 'submitted_at', key: 'submitted_at' }, // Moved here with date-only
  ];

  const componentColumns = [
    { title: 'MPN', dataIndex: 'mpn', key: 'mpn' },
    { title: 'Description', dataIndex: 'item_description', key: 'item_description' },
    { title: 'Make', dataIndex: 'make', key: 'make' },
    { title: 'Part No', dataIndex: 'part_no', key: 'part_no' },
    { title: 'UOM', dataIndex: 'uom', key: 'uom' },
    { title: 'Requested Quantity', dataIndex: 'requested_quantity', key: 'requested_quantity' },
    { title: 'GST Type', dataIndex: 'gst_type', key: 'gst_type' },
    { title: 'Rate per Unit', dataIndex: 'rate_per_unit', key: 'rate_per_unit', render: (rate) => `₹${rate.toFixed(2)}` },
    { title: 'Amount (INR)', dataIndex: 'amount_inr', key: 'amount_inr', render: (amount) => `₹${amount.toFixed(2)}` },
    { title: 'GST Amount', dataIndex: 'gst_amount', key: 'gst_amount', render: (amount) => `₹${amount.toFixed(2)}` },
    { title: 'Status', dataIndex: 'status', key: 'status' }, // Kept for component-level display with fallback
  ];

  const filteredColumns = columns.filter((col) => columnVisibility[col.key]);

  const showModal = (record) => {
    setSelectedRequest(record);
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
    setSelectedRequest(null);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setSelectedRequest(null);
  };

  return (
    <div className="page-container" style={{ height: '100vh', width: '100%', overflowY: 'auto', padding: '2.7rem' }}>
      <div className="content-wrapper" style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', background: '#ffffff', borderRadius: '1rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="mb-1">
          <h1 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-200 pb-4">Direct PO Requests History</h1>
        </div>

        {/* Compact Search and Filter Section */}
        <div className="mb-2 flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
          <Select
            value={searchType}
            onChange={(value) => setSearchType(value)}
            className="w-24"
            size="small"
          >
            <Option value="sequence">Sequence</Option>
            <Option value="vendor">Vendor</Option>
            <Option value="component">Component</Option>
          </Select>
          <Input
            placeholder={`Search ${searchType.replace('_', ' ')}`}
            value={searchQuery}
            onChange={handleSearchChange}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined className="text-gray-400" />}
            className="w-40 rounded-lg"
            size="small"
          />
          <Button
            type="primary"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSearch}
            size="small"
          >
            Search
          </Button>
          <Button
            className="!bg-yellow-500 !text-white hover:!bg-teal-500 transition duration-300"
            onClick={() => setColumnVisibilityVisible(true)}
            size="small"
          >
            Customize Columns
          </Button>
        </div>

        <Spin spinning={loading}>
          <Table
            columns={filteredColumns}
            dataSource={filteredRequests}
            rowKey="key"
            pagination={{ pageSize: 10 }}
            bordered
            scroll={{ x: 1000, y: 'calc(100vh - 300px)' }}
            locale={{ emptyText: 'No data available' }}
            onRow={(record) => ({
              onClick: () => showModal(record),
            })}
          />
        </Spin>
        <Modal
          title="Component Details"
          open={isModalVisible}
          onOk={handleOk}
          onCancel={handleCancel}
          width={1400}
          footer={[
            <Button key="close" onClick={handleCancel}>
              Close
            </Button>,
          ]}
        >
          {selectedRequest && (
            <Card>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>Sequence No: </Text>
                  <Text>{selectedRequest.direct_sequence}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>MRF No: </Text>
                  <Text>{selectedRequest.mrf_no}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Project Name: </Text>
                  <Text>{selectedRequest.project_name}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Vendor: </Text>
                  <Text>{selectedRequest.vendor}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Created At: </Text>
                  <Text>{selectedRequest.created_at}</Text>
                </Col>
                <Col span={24}>
                  <Text strong>Total PO Cost: </Text>
                  <Text>₹{selectedRequest.total_po_cost.toFixed(2)}</Text>
                </Col>
              </Row>
              <Table
                columns={componentColumns}
                dataSource={selectedRequest.components}
                rowKey="mpn"
                pagination={false}
                style={{ marginTop: 16 }}
                bordered
              />
            </Card>
          )}
        </Modal>
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
                {columns.find((col) => col.key === key)?.title || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
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

export default DirectPoRequestsHistory;