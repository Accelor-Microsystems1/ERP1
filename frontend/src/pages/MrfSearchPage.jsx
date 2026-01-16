import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Button, Tag, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { searchMrfComponents } from '../utils/api';

const MrfSearchPage = () => {
  const [filters, setFilters] = useState({ search: '' });
  const [components, setComponents] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    try {
      const data = await searchMrfComponents({});
      const mappedData = data.map((component, index) => ({
        ...component,
        key: `${component.mrf_no}-${component.part_no}-${index}`,
      }));
      setComponents(mappedData);
      setFilteredComponents(mappedData);
    } catch (error) {
      console.error('Error fetching components:', error);
      alert('Failed to fetch components');
    }
  };

  const handleSearchChange = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    setFilters({ search: searchTerm });

    const filtered = components.filter((component) =>
      [
        component.mrf_no?.toLowerCase(),
        component.item_description?.toLowerCase(),
        component.mpn?.toLowerCase(),
        component.created_at?.toLowerCase(),
      ].some((field) => field?.includes(searchTerm))
    );
    setFilteredComponents(filtered);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleSelectComponent = (component) => {
    setSelectedComponents((prev) => {
      if (prev.some((c) => c.mrf_no === component.mrf_no && c.part_no === component.part_no)) {
        return prev.filter((c) => !(c.mrf_no === component.mrf_no && c.part_no === component.part_no));
      }
      return [...prev, component];
    });
  };

  const handleReviewSelected = () => {
    if (selectedComponents.length === 0) {
      alert('Please select at least one component');
      return;
    }
    navigate('/mrf/review', { state: { selectedComponents } });
  };

  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };

  const statusColorMap = {
    Approved: 'green',
    Rejected: 'red',
    Pending: 'gold',
    Issued: 'blue',
  };

  const columns = [
    {
      title: 'Select',
      dataIndex: 'select',
      key: 'select',
      render: (_, record) => (
        <input
          type="checkbox"
          checked={selectedComponents.some(
            (c) => c.mrf_no === record.mrf_no && c.part_no === record.part_no
          )}
          onChange={() => handleSelectComponent(record)}
        />
      ),
      width: 60,
      align: 'center',
    },
    {
      title: 'MRF No',
      dataIndex: 'mrf_no',
      key: 'mrf_no',
      width: 120,
    },
    {
      title: 'Item Description',
      dataIndex: 'item_description',
      key: 'item_description',
      width: 200,
    },
    {
      title: 'MPN',
      dataIndex: 'mpn',
      key: 'mpn',
      width: 150,
    },
    {
      title: 'Make',
      dataIndex: 'make',
      key: 'make',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'Part No',
      dataIndex: 'part_no',
      key: 'part_no',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'On Hand Qty',
      dataIndex: 'on_hand_quantity',
      key: 'on_hand_quantity',
      width: 120,
      align: 'center',
      render: (text) => text ?? '-',
    },
    {
      title: 'User',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'Project Name',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 150,
      render: (text) => text || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 200,
      align: 'center',
      render: (status) => (
        <Tag
          color={statusColorMap[status] || 'default'}
          className="py-1 px-3 rounded-full font-semibold text-sm"
        >
          {status}
        </Tag>
      ),
    },
    {
      title: 'Initial Qty',
      dataIndex: 'initial_requested_quantity',
      key: 'initial_requested_quantity',
      width: 120,
      align: 'center',
      render: (text) => text ?? '-',
    },
    {
      title: 'Updated Qty',
      dataIndex: 'updated_requested_quantity',
      key: 'updated_requested_quantity',
      width: 120,
      align: 'center',
      render: (text) => (text !== null ? text : '-'),
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      width: 200,
      render: (notes) => (notes?.length > 0 ? notes.map((n) => n.content).join(', ') : '-'),
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      render: (text) => text || '-',
    },
  ];

  return (
    <div className="p-12 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full transform transition-all duration-300 ease-in-out relative">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-black border-b-2 border-blue-200 pb-2">
            MRF Approvals
          </h1>
          <Space>
            <div className="relative">
              <Input
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder="Search by MRF No, MPN, Description, Date..."
                value={filters.search}
                onChange={handleSearchChange}
                className="w-80 h-12 text-lg rounded-lg border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all"
              />
            </div>
          </Space>
        </div>

        <div className="relative">
          <Table
            dataSource={filteredComponents}
            columns={columns}
            rowKey="key"
            className="w-full"
            rowClassName="cursor-pointer hover:bg-blue-50 transition-colors align-middle"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              total: filteredComponents.length,
              showTotal: undefined, // Removed the "1-10 of 26 items" display
            }}
            onChange={handleTableChange}
            scroll={{ x: 'max-content', y: 'calc(100vh - 18rem)' }}
            bordered
          />
          {/* <div className="sticky bottom-6 right-6 z-10">
            <Button
              onClick={handleReviewSelected}
              className="bg-indigo-600 text-white hover:bg-indigo-700 transition-colors h-12 text-lg px-6 rounded-lg shadow-md hover:shadow-lg"
              disabled={selectedComponents.length === 0}
            >
              Review Selected Components
            </Button>
          </div> */}
        </div>
      </div>

      <style jsx global>{`
        .ant-table-wrapper .ant-table {
          border-radius: 8px;
          overflow: hidden;
        }
        .ant-table-wrapper .ant-table-thead > tr > th {
          background: #f8fafc;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
          text-align: center;
          padding: 16px;
        }
        .ant-table-wrapper .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
          text-align: center;
          padding: 20px 16px;
          line-height: 1.5;
          white-space: normal;
          word-break: break-word;
        }
        .ant-table-wrapper .ant-table-tbody > tr {
          height: 60px;
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
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
          pointer-events: auto !important;
          z-index: 20 !important; /* Ensure pagination is above other elements */
          position: relative;
        }
        .ant-pagination-item,
        .ant-pagination-prev,
        .ant-pagination-next,
        .ant-pagination-options {
          pointer-events: auto !important;
          z-index: 21 !important;
        }
        .ant-select {
          pointer-events: auto !important;
          z-index: 21 !important;
        }
        .ant-table-container {
          position: relative;
          z-index: 1; /* Ensure table is below pagination and button */
        }
        .sticky {
          z-index: 10 !important; /* Ensure button is above table but below pagination */
        }
      `}</style>
    </div>
  );
};

export default MrfSearchPage;