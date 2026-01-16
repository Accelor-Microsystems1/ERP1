import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Add useNavigate for navigation
import { fetchNonCOCData, importNonCOCData, updateNonCOCLocation } from "../utils/api";
import { Button, Table, Input, message, Upload, Modal, Form, Select, AutoComplete } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { FaSearch } from "react-icons/fa";
import moment from "moment";

const { Option } = Select;
const { TextArea } = Input;

const NonCOCPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [parentLocations, setParentLocations] = useState([]);
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [type, setType] = useState('');
  const navigate = useNavigate(); // Initialize navigate

  useEffect(() => {
    fetchData();
    fetchParentLocations();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetchNonCOCData();
      setData(response || []);
    } catch (error) {
      console.error("Error fetching Non-COC data:", error);
    }
  };

  const fetchParentLocations = async () => {
    try {
      const response = await fetchNonCOCData();
      const locations = response.map((item) => ({
        id: item.component_id,
        path: item.location || "WH-STOCK",
      }));
      setParentLocations(locations);
    } catch (error) {
      console.error("Error fetching parent locations:", error);
    }
  };

  const filteredData = data.filter(
    (item) =>
      (item.item_description?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (item.mpn?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (String(item.component_id)?.includes(searchQuery) || false)
  );

  const columns = [
    { title: "Description", dataIndex: "item_description", key: "item_description" },
    { title: "MPN", dataIndex: "mpn", key: "mpn" },
    { title: "Part No.", dataIndex: "part_no", key: "part_no",  
      render: (text) => (
      <span className="leading-tight">
        {text || "-"}
      </span>
    ),
   },

    { title: "Make", dataIndex: "make", key: "make" , 
      render: (text) => (
        <span className="leading-tight">
          {text || "-"}
        </span>
      ),
    },
    { title: "On Hand Qty", dataIndex: "on_hand_quantity", key: "on_hand_quantity" },
    {
      title: "Location",
      dataIndex: "location",
      key: "location",
      render: (text, record) => (
        <span onClick={() => handleEdit(record)} className="cursor-pointer text-blue-600 hover:underline">
          {text || "N/A"}
        </span>
      ),
    },
    // {
    //   title: "Receive In Store Date",
    //   dataIndex: "receive_date",
    //   key: "receive_date",
    //   render: (text) => {
    //     if (!text || text === "Invalid Date") return "N/A";
    //     const date = moment(text, "YYYY-MM-DDTHH:mm:ssZ", true);
    //     return date.isValid() ? date.format("DD/MM/YYYY") : "Invalid Date";
    //   },
    // },
    // {
    //   title: "Actions",
    //   key: "actions",
    //   render: (_, record) => (
    //     <Button onClick={() => handleEdit(record)} className="bg-green-500 hover:bg-green-600 text-white">
    //       Edit
    //     </Button>
    //   ),
    // },
  ];

  const fetchSuggestions = async (query) => {
    if (query.length < 1) return;
    try {
      const response = await fetchNonCOCData(`${API_BASE_URL}/noncoc/locations/suggestions`, {
        params: { query }
      });
      setSuggestions(response.data || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setLocation(record.location || 'WH-STOCK');
    setType(''); // Reset type
    form.setFieldsValue({
      parentLocation: record.location || 'WH-STOCK',
      type: '',
      name: '',
      metadata: '',
    });
    setIsModalVisible(true);
  };

  const handleLocationChange = (value) => {
    setLocation(value);
    fetchSuggestions(value);
  };

  const handleTypeChange = (value) => {
    setType(value);
  };

  const generatePath = (parentLocation, type, name) => {
    let path = parentLocation || 'WH-STOCK';
    if (type && name) {
      if (type === 'Rack') {
        path += `/RACK ${name}`;
      } else if (type === 'Shelf') {
        path += `/RACK A/SHELF ${name}`; // Assuming a default rack (e.g., "RACK A")
      } else if (type === 'Bin') {
        // Parse name for shelf and bin (e.g., "F4 BIN 2" -> shelf: F4, bin: BIN 2)
        const [shelfPart, binPart] = name.split(' BIN ');
        if (shelfPart && binPart) {
          path += `/RACK A/SHELF ${shelfPart}/BIN ${binPart}`;
        } else {
          path += `/RACK A/SHELF UNKNOWN/BIN ${name}`; // Fallback if format is incorrect
          message.warning('Please use format "Shelf BIN Name" (e.g., "F4 BIN 2") for Bin type.');
        }
      }
    }
    return path;
  };

  const handleSave = async (values) => {
    try {
      const fullPath = generatePath(values.parentLocation, values.type, values.name);
      const response = await updateNonCOCLocation(editingRecord.component_id, fullPath); 
      setData(data.map(c => c.component_id === editingRecord.component_id ? response.data : c));
      setIsModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      message.success("Location updated successfully");
    } catch (error) {
      console.error('Error updating location:', error);
      message.error(`Failed to update location: ${error.message}`);
    }
  };
  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const beforeUpload = (file) => {
    if (!file) {
      console.error("No file selected in beforeUpload.");
      return false;
    }
    handleImport(file);
    return false;
  };

  const handleImport = async (file) => {
    if (!file) {
      message.error("No file selected.");
      return;
    }

    const reader = new FileReader();
    reader.readAsBinaryString(file);

    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const parsedData = XLSX.utils.sheet_to_json(sheet);

        if (!parsedData.length) {
          message.error("Excel file is empty or incorrectly formatted.");
          return;
        }

        const formattedData = parsedData.map((item) => ({
          ...item,
          receive_date: moment(item.receive_date, "DD-MM-YYYY", true).isValid()
            ? moment(item.receive_date, "DD-MM-YYYY").toISOString()
            : moment().toISOString(),
        }));

        await importNonCOCData(formattedData);
        message.success("File imported successfully.");
        fetchData();
      } catch (error) {
        console.error("Import error:", error);
        message.error("Error processing file.");
      }
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="mt-14 px-6 py-4 flex-grow">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-center">
            <div className="relative max-w-2xl w-full">
              <input
                type="text"
                placeholder="Search by Description, MPN...."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-6 py-2 bg-white rounded-full shadow-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300 pr-20"
              />
              {/* <FaSearch className="text-white cursor-pointer hover:text-black transition-all" /> */}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">NON-COC Components</h2>
            <div className="flex space-x-4">
              <Upload beforeUpload={beforeUpload} showUploadList={false}>
                <Button
                  icon={<UploadOutlined />}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 flex items-center space-x-2"
                >
                  <span>Import Excel</span>
                </Button>
              </Upload>
              {/* <Button
                className="bg-blue-600 text-white hover:bg-blue-700 flex items-center space-x-2"
                onClick={() => navigate("/locations")}
              >
                <span>Locations</span>
              </Button> */}
            </div>
          </div>

          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-y-auto max-h-[calc(100vh-11rem)]">
              <Table
                columns={columns}
                dataSource={filteredData}
                pagination={true}
                bordered
                className="w-full"
                rowClassName="hover:bg-gray-100"
              />
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="Edit Location"
        visible={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        okText="Save"
        cancelText="Cancel"
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item
            name="parentLocation"
            label="Parent Location"
            initialValue="WH-STOCK"
            rules={[{ required: true, message: "Parent Location is required" }]}
          >
            <Input value={location} onChange={(e) => handleLocationChange(e.target.value)} />
          </Form.Item>
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: "Type is required" }]}
          >
            <Select placeholder="Select type" onChange={handleTypeChange}>
              <Option value="Rack">Rack</Option>
              <Option value="Shelf">Shelf</Option>
              <Option value="Bin">Bin</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="Enter name (e.g., A3 for Shelf, F4 BIN 2 for Bin)" />
          </Form.Item>
          <Form.Item name="metadata" label="Metadata">
            <TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NonCOCPage;