import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Spin, Alert, Tag, Input } from 'antd';
import {  MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import moment from 'moment';
import { fetchUserReturnRequests } from "../utils/api.js";

const UserReturnRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchReturnRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchUserReturnRequests();
         // Apply search filter
         if (searchTerm) {
           let mappedRequests = mappedRequests.filter(
              (req) =>
                req.umi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.urf_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.date?.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }
        console.log('Processed Data:', data);
        setRequests(data);
      } catch (err) {
        console.error('Error fetching return requests:', err);
        setError(err.response?.data?.error || 'Failed to fetch return requests');
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };


    fetchReturnRequests();
  }, [searchTerm]);

  // Handle search input change
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const toggleSearchBar = () => {
    setSearchVisible(!searchVisible);
    if (searchVisible) setSearchTerm("");
  };

  const columns = [
    {
      title: 'URF ID',
      dataIndex: 'urf_id',
      key: 'urf_id',
      width: 100,
    },
    {
      title: 'UMI',
      dataIndex: 'umi',
      key: 'umi',
      width: 120,
    },
    {
      title: 'Part No',
      dataIndex: 'part_no',
      key: 'part_no',
      width: 120,
      render: (text) => (
        <span className="leading-tight">
          {text || "-"}
        </span>
      )
    },
    {
      title: 'Item Description',
      dataIndex: 'item_description',
      key: 'item_description',
      width: 200,
    },
    {
      title: 'Make',
      dataIndex: 'make',
      key: 'make',
      width: 120,
      render: (text) => (
        <span className="leading-tight">
          {text || "-"}
        </span>
      )
    },
    {
      title: 'MPN',
      dataIndex: 'mpn',
      key: 'mpn',
      width: 120,
    },
    {
      title: 'Return Quantity',
      dataIndex: 'return_quantity',
      key: 'return_quantity',
      width: 150, // Increased width to prevent wrapping
      render: (text) => <span className="whitespace-nowrap">{text}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 200,
      render: (status) => {
        let color;
        switch (status) {
          case 'Return Initiated':
            color = 'blue';
            break;
          case 'Return Request Approved by Head':
            color = 'green';
            break;
          case 'Material Returned Successfully':
            color = 'cyan';
            break;
          case 'Return Request Rejected by Head':
          case 'Return Request Rejected by Inventory Head':
            color = 'red';
            break;
          default:
            color = 'gray';
        }
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => moment(date).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div className="p-12 bg-gray-100 min-h-screen mt-8">
    <div className="flex h-[calc(100vh-rem)]">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full">
      <div className="flex justify-between items-center mb-6 border-b-2 border-blue-200 pb-2">
      <h2 className="text-2xl font-bold text-gray-900">
        My Return Requests
      </h2>
      <div className="flex items-center gap-4 relative">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleSearchBar}
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                <MagnifyingGlassIcon className="h-6 w-6" />
              </motion.button>
              <AnimatePresence>
                {searchVisible && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 256, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Input
                      placeholder="Search via UMI, URF, Status, or Project Name"
                      value={searchTerm}
                      onChange={handleSearch}
                      autoFocus
                      className="w-64 rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
            {error && <p className="text-red-600">{error}</p>}
      {loading ? (
       <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div> 
      ) : requests.length === 0 ? (
        <Alert
          message="No return requests found."
          type="info"
          showIcon
          
        />
      ) : (
        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: true, y: 450 }} // Adjusted y for better visibility
          className="custom-table"
        />
      )}
      </div>
      </div>
      <style jsx>{`
        .custom-table :global(.ant-table) {
          border-radius: 8px;
          overflow: hidden;
        }
        .custom-table :global(.ant-table-thead > tr > th) {
          background-color: #1f2937; /* Darker background for headers */
          color: #ffffff; /* White text for contrast */
          font-weight: 700;
          font-size: 16px;
          padding: 16px;
          border-bottom: 2px solid #374151;
          text-align: left;
        }
        .custom-table :global(.ant-table-tbody > tr > td) {
          padding: 14px 16px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
          color: #374151;
          text-align: centre;
        }
        .custom-table :global(.ant-table-tbody > tr:hover > td) {
          background-color: #f1f5f9;
        }
        .custom-table :global(.ant-table-container) {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .custom-table :global(.ant-table-body) {
          scrollbar-width: thin;
          scrollbar-color: #9ca3af #e5e7eb;
        }
        .custom-table :global(.ant-table-body::-webkit-scrollbar) {
          width: 8px;
          height: 8px;
        }
        .custom-table :global(.ant-table-body::-webkit-scrollbar-track) {
          background: #e5e7eb;
          border-radius: 4px;
        }
        .custom-table :global(.ant-table-body::-webkit-scrollbar-thumb) {
          background: #9ca3af;
          border-radius: 4px;
        }
        .custom-table :global(.ant-table-body::-webkit-scrollbar-thumb:hover) {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
};

export default UserReturnRequests;