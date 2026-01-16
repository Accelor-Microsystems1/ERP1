import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Upload, message, Select, Modal, Spin, Checkbox } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { createUser, fetchRoles } from '../utils/api';
// import './UserCreation.css';

const { Option } = Select;

const UserCreation = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [signatureFile, setSignatureFile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBackModalVisible, setIsBackModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState(null); // New state to store form values

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rolesData = await fetchRoles();
        console.log("Fetched roles:", rolesData);
        setRoles(rolesData);
        setLoading(false);
      } catch (error) {
        message.error('Failed to fetch roles: ' + error.message);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRoleChange = (value) => {
    console.log("Selected role name:", value);
    console.log("All roles:", roles);
    const selectedRole = roles.find((role) => role.role_name === value);
    console.log("Selected role object:", selectedRole);

    if (selectedRole) {
      form.setFieldsValue({ role_id: selectedRole.id });
      console.log("Setting rolePermissions with:", {
        modules: selectedRole.modules,
        permissions: selectedRole.permissions,
      });
      setRolePermissions({
        modules: selectedRole.modules || [],
        permissions: selectedRole.permissions || {},
      });
    } else {
      console.log("No role found for value:", value);
      form.setFieldsValue({ role_id: '' });
      setRolePermissions(null);
    }
  };

const handleSubmit = async (values) => {
    try {
      const formData = new FormData();
      formData.append('name', values.name || '');
      formData.append('email', values.email || '');
      formData.append('password', values.password || '');
      formData.append('department', values.department || '');
      formData.append('designation', values.designation || '');
      formData.append('role', values.role || '');
      formData.append('role_id', values.role_id || '');

      // Validate required fields
      const requiredFields = ['name', 'email', 'password', 'password', 'department', 'role', 'designation', 'role_id'];
      for (const field of requiredFields) {
        if (!formData.get(field)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      if (signatureFile) {
        formData.append('signature', signatureFile);
      }

      // Log FormData entries
      console.log("FormData entries before submission:");
      for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value instanceof File ? value.name : value}`);
      }

      console.log("Submitting user data as FormData");
      await createUser(formData);
      message.success('User created successfully!');
      navigate('/view-users');
    } catch (error) {
      console.error('Error in user creation:', error);
      message.error('Failed to create user: ' + (error.response?.data?.error || error.message));
    }
  };

  const onFinish = (values) => {
    setFormValues(values); // Store the form values
    setIsModalOpen(true); // Open the confirmation modal
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
      return false;
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

  const handleBack = () => {
    setIsBackModalVisible(true);
  };

  const confirmBack = () => {
    setIsBackModalVisible(false);
    navigate('/view-users');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Add New User</h1>
        <button
          onClick={handleBack}
          className="text-gray-600 hover:text-blue-600 transition-transform transform hover:scale-110"
          title="Back to Users"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="max-w-4xl mx-auto mt-6 px-6 pb-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-custom">
          <Form
            form={form}
            onFinish={onFinish} // Updated to use onFinish
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
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter the password' }]}
            >
              <Input.Password className="rounded-lg" placeholder="Enter password" />
            </Form.Item>
            <Form.Item
              name="department"
              label="Department"
              rules={[{ required: true, message: 'Please enter the department' }]}
            >
              <Input className="rounded-lg" placeholder="Enter department" />
            </Form.Item>
            <Form.Item
              name="designation"
              label="Designation"
              rules={[{ required: true, message: 'Please enter the designation' }]}
            >
              <Input className="rounded-lg" placeholder="Enter designation" />
            </Form.Item>
            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: 'Please select a role' }]}
            >
              <Select
                onChange={handleRoleChange}
                placeholder="Select role"
              >
                {roles.map((role) => (
                  <Option key={role.id} value={role.role_name}>
                    {role.role_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="role_id" noStyle>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item name="signature" label="Signature">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />} className="rounded-lg">
                  Upload Signature (PNG or JPEG)
                </Button>
              </Upload>
            </Form.Item>
            {rolePermissions && rolePermissions.modules && rolePermissions.modules.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Role Permissions</h2>
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
                      {rolePermissions.modules.map((module) => (
                        <tr key={module.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{module.module_name}</td>
                          <td className="px-6 py-4 text-sm">
                            <Checkbox
                              checked={rolePermissions.permissions[module.id]?.can_access || false}
                              disabled
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <Checkbox
                              checked={rolePermissions.permissions[module.id]?.can_read || false}
                              disabled
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <Checkbox
                              checked={rolePermissions.permissions[module.id]?.can_edit || false}
                              disabled
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <Checkbox
                              checked={rolePermissions.permissions[module.id]?.can_delete || false}
                              disabled
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                  onClick={handleBack}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-6 py-2 transition-colors"
                >
                  Cancel
                </Button>
              </div>
            </Form.Item>
          </Form>
        </div>
      </div>

      <Modal
        title="Confirm Save"
        open={isModalOpen}
        onOk={() => {
          setIsModalOpen(false);
          handleSubmit(formValues); // Call handleSubmit directly with stored values
        }}
        onCancel={() => {
          setIsModalOpen(false);
          setFormValues(null); // Clear stored values if canceled
        }}
        okText="Yes"
        cancelText="No"
        okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
        cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
      >
        <p>Are you sure you want to save this user?</p>
      </Modal>

      <Modal
        title="Confirm Navigation"
        open={isBackModalVisible}
        onOk={confirmBack}
        onCancel={() => setIsBackModalVisible(false)}
        okText="Yes"
        cancelText="No"
        okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }}
        cancelButtonProps={{ className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg' }}
      >
        <p>Are you sure you want to go back? Any unsaved changes will be lost.</p>
      </Modal>
    </div>
  );
};

export default UserCreation;