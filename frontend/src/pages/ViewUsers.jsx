import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Button, Space, message, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { fetchUsers, deleteUser } from '../utils/api';

const ViewUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentSignature, setCurrentSignature] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersData = await fetchUsers();
        console.log('Fetched users:', usersData); // Debug log
        setUsers(usersData);
        setFilteredUsers(usersData);
        setLoading(false);
      } catch (error) {
        message.error('Failed to fetch users: ' + error.message);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = users.filter(user =>
      (user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
       user.role_name?.toLowerCase().includes(searchText.toLowerCase()) ||
       user.designation?.toLowerCase().includes(searchText.toLowerCase()))
    );
    setFilteredUsers(filtered);
  }, [searchText, users]);

  const handleAddUser = () => {
    navigate('/create-user');
  };

  const handleEditUser = (userId) => {
    navigate(`/users/edit/${userId}`);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await deleteUser(userId);
      setUsers(users.filter(user => user.id !== userId));
      setFilteredUsers(filteredUsers.filter(user => user.id !== userId));
      message.success('User deleted successfully');
    } catch (error) {
      message.error('Failed to delete user: ' + error.message);
    }
  };

  const handleViewSignature = (signature) => {
    console.log('handleViewSignature called with signature:', signature);
    if (!signature || !signature.startsWith('data:image/')) {
      console.log('Signature validation failed:', signature);
      message.warning('Invalid or missing signature data.');
      return;
    }
    console.log('Setting signature and opening modal:', signature);
    setCurrentSignature(signature);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    console.log('Closing modal');
    setIsModalVisible(false);
    setCurrentSignature(null);
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Department', dataIndex: 'department', key: 'department' },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (text) => <span className="leading-tight">{text || "-"}</span>,
    },
    { title: 'Role', dataIndex: 'role_name', key: 'role_name' },
    {
      title: 'Signature',
      key: 'signature',
      render: (text, record) => (
        record.signature ? (
          <button
            onClick={() => handleViewSignature(record.signature)}
            className="text-blue-600 hover:underline z-50"
          >
            View Signature
          </button>
        ) : null
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<PencilIcon className="h-4 w-4" />}
            onClick={() => handleEditUser(record.id)}
          >
            Edit
          </Button>
          <Button
            type="link"
            icon={<TrashIcon className="h-4 w-4" />}
            onClick={() => handleDeleteUser(record.id)}
            danger
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 mt-8">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-gray-800 border-l-4 border-green-600 pl-3">
              All Users <span className="text-gray-500 ml-2">({filteredUsers.length})</span>
            </h2>
          </div>
          <div className="flex items-center space-x-3 gap-4">
            <Input
              placeholder="Search by name, role, or designation"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64"
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>
              Add User
            </Button>
          </div>
        </div>
        <div className="relative max-h-[calc(100vh-3rem)]">
          <Table
            dataSource={filteredUsers}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            className="ant-table-rounded"
            scroll={{ y: 'calc(100vh - 300px)' }}
            sticky
          />
        </div>
        <Modal
          title="Signature"
          open={isModalVisible}
          onCancel={handleModalClose}
          footer={null}
          style={{ zIndex: 1000 }}
          styles={{ zIndex: 999 }}
        >
          {currentSignature ? (
            <img
              src={currentSignature}
              alt="User Signature"
              style={{ maxWidth: '100%', maxHeight: '16rem', objectFit: 'contain' }}
              onError={() => {
                console.log('Image failed to load:', currentSignature);
                message.error('Failed to load signature image.');
              }}
              onLoad={() => console.log('Image loaded successfully')}
            />
          ) : (
            <p>No signature to display.</p>
          )}
        </Modal>
      </div>
      <style jsx global>{`
        .ant-table-rounded .ant-table {
          border-radius: 0.8rem !important;
        }
        .ant-table-thead > tr > th {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #fafafa;
        }
        .ant-table-container {
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
};

export default ViewUsers;