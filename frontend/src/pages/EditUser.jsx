import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Button, Upload, message, InputNumber, Spin, Checkbox, Select } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { fetchUsers, updateUser, fetchRoles } from '../utils/api';

const { Option } = Select;

const EditUser = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [signatureFile, setSignatureFile] = useState(null);
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user and roles concurrently
        const [users, rolesData] = await Promise.all([fetchUsers(), fetchRoles()]);
        const selectedUser = users.find(u => u.id === parseInt(id));
        if (!selectedUser) {
          message.error('User not found');
          navigate('/view-users');
          return;
        }
        setUser(selectedUser);
        setRoles(rolesData);
        form.setFieldsValue({
          name: selectedUser.name,
          email: selectedUser.email,
          department: selectedUser.department,
          designation: selectedUser.designation,
          role: selectedUser.role_name, // Display role_name in dropdown
          role_id: selectedUser.role_id,
          permissions: selectedUser.permissions,
        });
        setLoading(false);
      } catch (error) {
        message.error('Failed to fetch data: ' + error.message);
        setLoading(false);
        navigate('/view-users');
      }
    };
    fetchData();
  }, [id, form, navigate]);

  const handleSubmit = async (values) => {
    try {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('email', values.email);
      formData.append('department', values.department);
      formData.append('designation', values.designation || '');
      formData.append('role', values.role); // Role name
      formData.append('role_id', values.role_id || null);
      if (signatureFile) {
        formData.append('signature', signatureFile); // Append binary file
      }
      if (values.permissions) {
        formData.append('permissions', JSON.stringify(values.permissions));
      }

      const updatedUser = await updateUser(id, formData);
      message.success('User updated successfully');
      navigate('/view-users');
    } catch (error) {
      message.error('Failed to update user: ' + error.message);
    }
  };

  const handleRoleChange = (roleName) => {
    const selectedRole = roles.find(role => role.role_name === roleName);
    form.setFieldsValue({
      role: roleName,
      role_id: selectedRole ? selectedRole.id : null,
    });
  };

  const uploadProps = {
    beforeUpload: (file) => {
      const isImage = file.type === 'image/png' || file.type === 'image/jpeg';
      const isLt1M = file.size / 1024 / 1024 < 1;
      if (!isImage) {
        message.error('You can only upload PNG or JPEG files!');
        return false;
      }
      if (!isLt1M) {
        message.error('Image must be smaller than 1MB!');
        return false;
      }
      return false; // Prevent auto-upload
    },
    onChange: (info) => {
      if (info.fileList && info.fileList.length > 0) {
        setSignatureFile(info.fileList[0].originFileObj);
      } else {
        setSignatureFile(null);
      }
    },
    accept: 'image/png,image/jpeg',
    fileList: signatureFile ? [{
      uid: '-1',
      name: signatureFile.name || `signature.${signatureFile.type === 'image/jpeg' ? 'jpg' : 'png'}`,
      status: 'done',
    }] : [],
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Edit User</h1>
        <button
          onClick={() => navigate('/view-users')}
          className="text-gray-600 hover:text-blue-600 transition-transform transform hover:scale-110"
          title="Back to Users"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="max-w-4xl mx-auto mt-6 px-6 pb-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-h-[calc(100vh-120px)] overflow-y-auto">
          <Form
            form={form}
            onFinish={handleSubmit}
            layout="vertical"
            className="space-y-6"
          >
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Please enter the name' }]}
            >
              <Input className="rounded-lg" placeholder="Enter name" />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
            >
              <Input className="rounded-lg" placeholder="Enter email" />
            </Form.Item>
            <Form.Item
              name="department"
              label="Department"
              rules={[{ required: true, message: 'Please enter the department' }]}
            >
              <Input className="rounded-lg" placeholder="Enter department" />
            </Form.Item>
            <Form.Item name="designation" label="Designation">
              <Input className="rounded-lg" placeholder="Enter designation" />
            </Form.Item>
            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: 'Please select a role' }]}
            >
              <Select
                className="rounded-lg"
                placeholder="Select role"
                onChange={handleRoleChange}
              >
                {roles.map(role => (
                  <Option key={role.id} value={role.role_name}>
                    {role.role_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="role_id" hidden>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item name="signature" label="Signature">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />} className="rounded-lg">
                  Upload Signature (PNG or JPEG)
                </Button>
              </Upload>
              {user?.signature && (
                <img
                  src={user.signature}
                  alt="Current Signature"
                  className="mt-4 max-w-xs rounded-lg shadow-sm"
                />
              )}
            </Form.Item>
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">User Permissions</h2>
              {Object.keys(user?.permissions || {}).length === 0 ? (
                <p className="text-gray-500">No permissions available for this user.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Read</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.keys(user?.permissions || {}).map(moduleName => (
                        <tr key={moduleName} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{moduleName}</td>
                          <td className="px-6 py-4 text-sm">
                            <Form.Item
                              name={['permissions', moduleName, 'can_access']}
                              valuePropName="checked"
                              noStyle
                            >
                              <Checkbox className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            </Form.Item>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <Form.Item
                              name={['permissions', moduleName, 'can_read']}
                              valuePropName="checked"
                              noStyle
                            >
                              <Checkbox className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            </Form.Item>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <Form.Item
                              name={['permissions', moduleName, 'can_edit']}
                              valuePropName="checked"
                              noStyle
                            >
                              <Checkbox className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            </Form.Item>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <Form.Item
                              name={['permissions', moduleName, 'can_delete']}
                              valuePropName="checked"
                              noStyle
                            >
                              <Checkbox className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            </Form.Item>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <Form.Item className="mt-8">
              <div className="flex space-x-4">
                <Button
                  type="primary"
                  htmlType="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 transition-colors"
                >
                  Save
                </Button>
                <Button
                  onClick={() => navigate('/view-users')}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-6 py-2 transition-colors"
                >
                  Cancel
                </Button>
              </div>
            </Form.Item>
          </Form>
        </div>
      </div>
      <style jsx global>{`
        .ant-input, .ant-input-number, .ant-select-selector {
          border-radius: 0.5rem !important;
        }
        .ant-btn {
          border-radius: 0.5rem;
        }
        .ant-table-rounded .ant-table {
          border-radius: 0.8rem !important;
        }
        .ant-checkbox-checked .ant-checkbox-inner {
          background-color: #2563eb;
          border-color: #2563eb;
        }
      `}</style>
    </div>
  );
};

export default EditUser;