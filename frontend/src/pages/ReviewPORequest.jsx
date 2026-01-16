import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Table, Input, Button, message, Select, Modal, Checkbox } from 'antd';
import Loader from '../components/loading';
import { submitDirectPurchaseRequest, fetchAllVendors, fetchPreviousPurchases } from '../utils/api';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;

const API_BASE_URL = "https://erp1-iwt1.onrender.com/api/non_coc_components";

const ReviewPORequest = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [components, setComponents] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [isCustomProject, setIsCustomProject] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [columnVisibilityVisible, setColumnVisibilityVisible] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({
    item_description: true,
    mpn: true,
    part_no: true,
    make: true,
    on_hand_quantity: state?.hasOnHandQuantity || false,
    required_quantity: true,
    uom: true,
    gst_type: true,
    rate_per_unit: true,
    amount_inr: true,
    gst_amount: true,
    status: true,
    previous_purchases: true,
  });

  const gstOptions = [
    '1% GST', '2% GST', '5% GST', '12% GST', '18% GST', '28% GST',
    '1% GST RC', '2% GST RC', '5% GST RC', '12% GST RC', '18% GST RC', '28% GST RC',
    '1% IGST', '2% IGST', '5% IGST', '12% IGST', '18% IGST', '28% IGST',
    '1% IGST RC', '2% IGST RC', '5% IGST RC', '12% IGST RC', '18% IGST RC', '28% IGST RC'
  ];

  useEffect(() => {
    const initializeComponents = async () => {
      setLoading(true);
      const updatedComponents = await Promise.all(
        (state?.selectedComponents || []).map(async (comp) => {
          let uom = comp.uom || '';
          let on_hand_quantity = state?.hasOnHandQuantity ? comp.on_hand_quantity : 0;

          if (!uom || on_hand_quantity === 0) {
            try {
              const response = await axios.get(`${API_BASE_URL}/search`, {
                params: { query: comp.part_no, type: 'part_no' },
              });
              const match = response.data.find((item) => item.part_no === comp.part_no);
              if (match) {
                uom = uom || match.uom || 'unit';
                on_hand_quantity = state?.hasOnHandQuantity ? on_hand_quantity : match.on_hand_quantity || 0;
              }
            } catch (error) {
              console.error(`Error fetching data for part_no ${comp.part_no}:`, error.message);
            }
          }

          return {
            ...comp,
            required_quantity: 1,
            vendor: selectedVendor,
            uom: uom || 'unit',
            gst_type: '18% GST',
            updated_qty: 0,
            rate_per_unit: 0,
            amount_inr: 0,
            gst_amount: 0,
            status: 'CEO APPROVAL PENDING',
            on_hand_quantity,
          };
        })
      );
      setComponents(updatedComponents);
      setLoading(false);
    };

    initializeComponents();
  }, [state?.selectedComponents, state?.hasOnHandQuantity, selectedVendor]);

  useEffect(() => {
    const loadVendors = async () => {
      setVendorLoading(true);
      try {
        const vendorData = await fetchAllVendors();
        setVendors(vendorData);
      } catch (error) {
        message.error('Failed to fetch vendors. Please try again.', 5);
      } finally {
        setVendorLoading(false);
      }
    };
    loadVendors();
  }, []);

const fetchComponentPreviousPurchases = async (component_id) => {
  setModalLoading(true);
  try {
    const filters = { componentId: component_id, limit: 5, sort: "created_at DESC" };
    const data = await fetchPreviousPurchases(filters);
    const enhancedData = data.slice(0, 5).map(item => ({
      po_number: item.po_number || 'N/A',
      created_at: item.created_at || 'N/A',
      vendor_name: item.vendor_name || 'N/A',
      updated_requested_quantity: item.updated_requested_quantity || 'N/A',
      rate_per_unit: isNaN(parseFloat(item.rate_per_unit)) ? 0 : parseFloat(item.rate_per_unit),
      amount: isNaN(parseFloat(item.amount)) ? 0 : parseFloat(item.amount),
      key: item.po_number || Math.random().toString(),
    }));
    setModalData(enhancedData);
  } catch (error) {
    console.error('Error fetching previous purchases:', error.message);
    message.error('Failed to fetch previous purchase details.');
    setModalData([]);
  } finally {
    setModalLoading(false);
  }
};
  const handleVendorChange = (value) => {
    setSelectedVendor(value);
    setComponents(prev =>
      prev.map(item => ({
        ...item,
        vendor: value,
      }))
    );
  };

  const handleQuantityChange = (mpn, value) => {
    const quantity = Math.max(0, parseInt(value) || 0);
    setComponents(prev =>
      prev.map(item => {
        if (item.mpn === mpn) {
          const newAmount = quantity * (item.rate_per_unit || 0);
          const gstRate = item.gst_type ? parseFloat(item.gst_type.match(/\d+(\.\d+)?/)[0]) / 100 : 0;
          const gstAmount = newAmount * gstRate;
          return {
            ...item,
            required_quantity: quantity,
            amount_inr: newAmount,
            gst_amount: gstAmount,
          };
        }
        return item;
      })
    );
  };

  const handleComponentChange = (mpn, field, value) => {
    setComponents(prev =>
      prev.map(item => {
        if (item.mpn === mpn) {
          if (field === 'rate_per_unit') {
            const parsedValue = parseFloat(value) || 0;
            const newAmount = (item.required_quantity || 0) * parsedValue;
            const gstRate = item.gst_type ? parseFloat(item.gst_type.match(/\d+(\.\d+)?/)[0]) / 100 : 0;
            const gstAmount = newAmount * gstRate;
            return {
              ...item,
              [field]: parsedValue,
              amount_inr: newAmount,
              gst_amount: gstAmount,
            };
          }
          if (field === 'gst_type') {
            const gstRate = value ? parseFloat(value.match(/\d+(\.\d+)?/)[0]) / 100 : 0;
            const gstAmount = (item.amount_inr || 0) * gstRate;
            return {
              ...item,
              [field]: value,
              gst_amount: gstAmount,
            };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleProjectChange = (e) => {
    const value = e.target.value;
    if (value === 'create_new') {
      setIsCustomProject(true);
      setProjectName('');
    } else {
      setIsCustomProject(false);
      setProjectName(value);
    }
  };

  const showModal = (component_id) => {
    fetchComponentPreviousPurchases(component_id);
    setModalVisible(true);
  };

  const basicTotal = components.reduce((sum, item) => sum + (item.amount_inr || 0), 0);
  const cgstTotal = components
    .filter(item => item.gst_type.includes('GST') && !item.gst_type.includes('IGST'))
    .reduce((sum, item) => sum + (item.gst_amount || 0) / 2, 0);
  const sgstTotal = cgstTotal;
  const igstTotal = components
    .filter(item => item.gst_type.includes('IGST'))
    .reduce((sum, item) => sum + (item.gst_amount || 0), 0);
  const totalPoCost = basicTotal + cgstTotal + sgstTotal + igstTotal;
  const hasGST = components.some(item => item.gst_type.includes('GST') && !item.gst_type.includes('IGST'));
  const hasIGST = components.some(item => item.gst_type.includes('IGST'));

const handleSubmit = async () => {
  console.log('Initiating direct purchase request submission', {
    components,
    projectName,
    note,
    totalPoCost,
  });

  // [Existing validation logic remains unchanged]

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('Submission blocked: No auth token');
    message.error('Please log in to submit the request.');
    navigate('/login');
    return;
  }

  setLoading(true);
  try {
    const submittedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    const payload = {
      items: components.map(item => ({
        mpn: item.mpn.trim(),
        requested_quantity: item.required_quantity,
        project_name: projectName.trim(),
        note: note.trim(),
        vendor: selectedVendor,
        uom: item.uom,
        gst_type: item.gst_type,
        updated_qty: item.updated_qty,
        rate_per_unit: item.rate_per_unit,
        amount_inr: item.amount_inr,
        gst_amount: item.gst_amount,
        total_po_cost: totalPoCost,
        submitted_at: submittedAt,
        item_description: item.item_description || 'N/A',
        make: item.make || 'N/A',
      })),
    };

    console.log('Submitting payload to API:', payload);

    const response = await submitDirectPurchaseRequest(payload);
    console.log('Submission successful:', response);

    alert(`Direct Purchase Request submitted successfully! PO No: ${response.direct_sequence}, MRF No: ${response.mrf_no}`)

    message.success(`Direct Purchase Request submitted successfully! PO No: ${response.direct_sequence}, MRF No: ${response.mrf_no}`);
    setProjectName('');
    setIsCustomProject(false);
    setNote('');
    setComponents([]);
    setSelectedVendor('');
    navigate('/raise-po-request');
  } catch (error) {
    console.error('Submission failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    message.error(
      error.response?.data?.error || 'Failed to submit request. Please try again.'
    );
  } finally {
    setLoading(false);
  }
};

  const combinedColumns = [
    {
      title: 'Description',
      dataIndex: 'item_description',
      key: 'item_description',
      className: 'text-gray-700 font-medium',
      width: 150,
      hidden: !columnVisibility.item_description,
    },
    {
      title: 'MPN',
      dataIndex: 'mpn',
      key: 'mpn',
      className: 'text-gray-700 font-medium',
      width: 120,
      hidden: !columnVisibility.mpn,
    },
    {
      title: 'Part No.',
      dataIndex: 'part_no',
      key: 'part_no',
      render: text => <span className="text-gray-600">{text || '-'}</span>,
      className: 'text-gray-700 font-medium',
      width: 120,
      hidden: !columnVisibility.part_no,
    },
    {
      title: 'Make',
      dataIndex: 'make',
      key: 'make',
      render: text => <span className="text-gray-600">{text || '-'}</span>,
      className: 'text-gray-700 font-medium',
      width: 120,
      hidden: !columnVisibility.make,
    },
    {
      title: 'UoM',
      dataIndex: 'uom',
      key: 'uom',
      className: 'text-gray-700 font-medium',
      width: 100,
      hidden: !columnVisibility.uom,
    },
    ...(state?.hasOnHandQuantity
      ? [{
          title: 'On Hand Qty',
          dataIndex: 'on_hand_quantity',
          key: 'on_hand_quantity',
          className: 'text-gray-700 font-medium',
          width: 100,
          hidden: !columnVisibility.on_hand_quantity,
        }]
      : []),
    {
      title: 'Required Quantity',
      key: 'required_quantity',
      render: (_, record) => (
        <Input
          type="number"
          min={0}
          value={record.required_quantity}
          onChange={e => handleQuantityChange(record.mpn, e.target.value)}
          className="w-20 rounded-md border-gray-300 focus:border-blue-600 focus:ring-blue-600"
        />
      ),
      className: 'text-gray-700 font-medium',
      width: 120,
      hidden: !columnVisibility.required_quantity,
    },
    {
      title: 'GST Type',
      key: 'gst_type',
      render: (_, record) => (
        <Select
          value={record.gst_type}
          onChange={value => handleComponentChange(record.mpn, 'gst_type', value)}
          className="w-24"
          placeholder="Select GST"
        >
          {gstOptions.map(option => (
            <Option key={option} value={option}>
              {option}
            </Option>
          ))}
        </Select>
      ),
      className: 'text-gray-700 font-medium',
      width: 120,
      hidden: !columnVisibility.gst_type,
    },
    {
      title: 'Rate/Unit',
      key: 'rate_per_unit',
      render: (_, record) => (
        <Input
          type="number"
          min={0}
          value={record.rate_per_unit}
          onChange={e => handleComponentChange(record.mpn, 'rate_per_unit', parseFloat(e.target.value) || 0)}
          className="w-24 rounded-md border-gray-300 focus:border-blue-600 focus:ring-blue-600"
        />
      ),
      className: 'text-gray-700 font-medium',
      width: 100,
      hidden: !columnVisibility.rate_per_unit,
    },
    {
      title: 'Amount (INR)',
      dataIndex: 'amount_inr',
      key: 'amount_inr',
      render: text => (typeof text === 'number' ? text.toFixed(2) : '0.00'),
      className: 'text-gray-700 font-medium',
      width: 100,
      hidden: !columnVisibility.amount_inr,
    },
    {
      title: 'GST Amount',
      dataIndex: 'gst_amount',
      key: 'gst_amount',
      render: text => (typeof text === 'number' ? text.toFixed(2) : '0.00'),
      className: 'text-gray-700 font-medium',
      width: 100,
      hidden: !columnVisibility.gst_amount,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: text => (
        <span className={`font-medium ${text === 'CEO APPROVAL DONE' ? 'text-green-600' : 'text-yellow-600'}`}>
          {text}
        </span>
      ),
      className: 'text-gray-700 font-medium',
      width: 120,
      hidden: !columnVisibility.status,
    },
    {
      title: 'Previous Purchases',
      key: 'previous_purchases',
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => showModal(record.component_id)}
        >
          View Details
        </Button>
      ),
      className: 'text-gray-700 font-medium',
      width: 120,
      hidden: !columnVisibility.previous_purchases,
    },
  ].filter(col => !col.hidden);

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
    render: text => text || 'N/A',
    width: 120,
  },
  {
    title: 'Rate/Unit',
    dataIndex: 'rate_per_unit',
    key: 'rate_per_unit',
    render: value => {
      const num = Number(value);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    },
    width: 100,
  },
  {
    title: 'Amount',
    dataIndex: 'amount',
    key: 'amount',
    render: value => {
      const num = Number(value);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    },
    width: 100,
  },
];

  return (
    <div className="page-container">
      <div className="content-wrapper">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-800 border-b pb-4">Review Purchase Request</h1>
        </div>

        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Project Name <span className="text-red-500">*</span>
            </label>
            {isCustomProject ? (
              <Input
                placeholder="Enter custom project name"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="w-full max-w-xs rounded-lg border-gray-300 focus:border-blue-600 focus:ring-blue-600 transition duration-200 shadow-sm"
              />
            ) : (
              <select
                value={projectName || ''}
                onChange={handleProjectChange}
                className="w-full max-w-xs rounded-lg border-gray-300 bg-white text-gray-700 focus:border-blue-600 focus:ring-blue-600 transition duration-200 py-2 px-4 shadow-sm"
              >
                <option value="" disabled>Select a project</option>
                <option value="V2">V2</option>
                <option value="M5">M5</option>
                <option value="Generic">Generic</option>
                <option value="create_new">Create New</option>
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Vendor <span className="text-red-500">*</span>
            </label>
            <Select
              value={selectedVendor}
              onChange={handleVendorChange}
              className="w-full max-w-xs"
              placeholder="Select Vendor"
              loading={vendorLoading}
              disabled={vendorLoading}
              showSearch
              filterOption={(input, option) =>
                option.children?.toLowerCase().includes(input.toLowerCase()) ||
                option.value?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {vendors.map(v => (
                <Option key={v.id} value={v.name}>
                  {v.name}
                </Option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Selected Components and Direct Purchase Order Details</h2>
          <div className="table-container">
            <Table
              columns={combinedColumns}
              dataSource={components}
              pagination={false}
              bordered
              rowKey="mpn"
              className="w-full bg-white rounded-lg shadow-md"
              rowClassName="hover:bg-gray-50 transition duration-150"
              scroll={{ x: 1500, y: 400 }}
              title={() => (
                <div className="flex justify-end mb-2">
<Button
  type="button"
  onClick={() => setColumnVisibilityVisible(true)}
  className="!bg-yellow-500  !text-white !font-semibold py-2 px-4 !rounded-lg !shadow ! hover:bg-yellow-600 !transition-all duration-200"
>
  Customize Columns
</Button>

                </div>
              )}
            />
          </div>
        </div>

<Modal
  title="Previous Purchase Details"
  visible={modalVisible}
  onCancel={() => setModalVisible(false)}
  footer={[
    <Button key="close" onClick={() => setModalVisible(false)}>
      Close
    </Button>,
  ]}
  width={800} // Increased width to accommodate data efficiently
>
  {modalLoading ? (
    <Loader />
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
      <p className="text-red-600 mt-2">* Amount is the Basic Total, and the GST was paid extra.</p> {/* Moved to bottom */}
    </div>
  )}
</Modal>
<Modal
  title="Customize Columns"
  visible={columnVisibilityVisible}
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
        {combinedColumns.find(col => col.key === key)?.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Checkbox>
    </div>
  ))}
</Modal>

        <div className="mt-8 bg-gray-50 p-6 rounded-xl shadow-inner mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Cost Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Basic Total (INR)
              </label>
              <div className="w-full h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                {basicTotal.toFixed(2)}
              </div>
            </div>
            {hasGST && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    CGST Total (INR)
                  </label>
                  <div className="w-full h-12 bg-gray-100 text-gray-900 font-medium rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                    {cgstTotal.toFixed(2)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    SGST Total (INR)
                  </label>
                  <div className="w-full h-12 bg-gray-100 text-gray-900 font-medium rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                    {sgstTotal.toFixed(2)}
                  </div>
                </div>
              </>
            )}
            {hasIGST && (
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  IGST Total (INR)
                </label>
                <div className="w-full h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                  {igstTotal.toFixed(2)}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Total PO Cost (INR)
              </label>
              <div className="w-full h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
                {totalPoCost.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-8 rounded-xl border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Request Details</h2>
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Note <span className="text-red-500">*</span>
            </label>
            <Input.TextArea
              placeholder="Enter any additional notes (mandatory)"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              className="w-full rounded-lg border-gray-300 focus:border-blue-600 focus:ring-blue-600 transition duration-200 shadow-sm"
            />
          </div>
          <div className="flex gap-4 justify-end">
            <Button
              type="primary"
              size="large"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-8 py-2 transition duration-200 shadow-md"
              onClick={handleSubmit}
              disabled={loading}
            >
              Submit Request
            </Button>
            <Button
              size="large"
              className="bg-gray-500 hover:bg-gray-600 text-white rounded-lg px-8 py-2 transition duration-200 shadow-md"
              onClick={() => navigate('/raise-po-request')}
              disabled={loading}
            >
              Back
            </Button>
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 flex items-center justify-center bg-opacity-50 z-50">
            <Loader />
          </div>
        )}
      </div>

      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
        }

        .page-container {
          height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
          padding: 2rem;
        }

        .page-container::-webkit-scrollbar {
          width: 10px;
        }

        .page-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 12px;
        }

        .page-container::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 12px;
          border: 2px solid #f1f1f1;
        }

        .page-container::-webkit-scrollbar-thumb:hover {
          background: #555;
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
          overflow: visible;
        }

        .ant-table-wrapper {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
        }

        .ant-table-wrapper::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .ant-table-wrapper::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 12px;
        }

        .ant-table-wrapper::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 12px;
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
          text-align: center;
          padding: 14px 16px;
          font-size: 15px;
          transition: background 0.3s ease;
        }

        .ant-table-thead > tr > th:hover {
          background: #e6f0ff;
        }

        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
          text-align: center;
          padding: 14px 16px;
          font-size: 14px;
          transition: background 0.3s ease;
        }

        .ant-table-tbody > tr.ant-table-row:hover > td {
          background: #e6f0ff;
        }

        .ant-select-single .ant-select-selector {
          border-radius: 8px !important;
          border: 1px solid #d1d5db !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
        }

        .ant-input-number {
          border-radius: 8px !important;
          border: 1px solid #d1d5db !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
        }
      `}</style>
    </div>
  );
};

export default ReviewPORequest;