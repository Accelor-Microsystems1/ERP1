import React, { useState, useEffect } from "react";
import { Button, Form, Input, Select, message } from "antd";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { setAuthHeader } from "../utils/api";
import ConfirmationModal from "../components/ConfirmationModal";

const { Option } = Select;
const API_BASE_URL = "http://localhost:5000/api";

const CreateLocation = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [parentLocations, setParentLocations] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [previewPath, setPreviewPath] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  

  useEffect(() => {
    if (selectedType) {
      fetchParentLocations(selectedType);
    }
  }, [selectedType]);

  const fetchParentLocations = async (type) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/locations/parents?type=${type}`,
        setAuthHeader()
      );
      setParentLocations(response.data);
      if (response.data.length === 0) {
        message.warning(
          `No parent locations available for ${type}. Please create a ${
            type === "shelf" ? "rack or cabinet" : type === "bin" ? "shelf" : "parent"
          } first.`
        );
      }
    } catch (error) {
      console.error("Error fetching parent locations:", error.response?.data || error.message);
      message.error("Failed to fetch parent locations");
    }
  };

  const fetchPreviewPath = async (values) => {
    const rawName =
    values.rackName ||
    values.cabinetName ||
    values.shelfName ||
    values.binName;

  if (!rawName || !selectedType || !values.parentLocation) {
    setPreviewPath("");
    return;
  }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/locations/preview-path`,
        {
          name: rawName.toUpperCase(),
          type: selectedType.toLowerCase(),
          parent_id: values.parentLocation,
        },
        setAuthHeader()
      );
      setPreviewPath(response.data.path);
    } catch (error) {
      console.error("Error fetching preview path:", error.response?.data || error.message);
      setPreviewPath("");
      message.error("Failed to preview path: " + (error.response?.data?.error || error.message));
    }
  };


  const handleTypeChange = (value) => {
    setSelectedType(value);
    form.resetFields(["parentLocation", "rackName", "shelfName", "binName"]);
    setPreviewPath("");
    setParentLocations([]); // Clear parent locations to force a refetch
  };

  const handleFormChange = (_, allValues) => {
    fetchPreviewPath(allValues);
  };

  const onFinish = async (values) => {
    try {
      const rawName =
      values.rackName ||
      values.cabinetName ||
      values.shelfName ||
      values.binName;
  
      const payload = {
        name: rawName.toUpperCase(),
        type: selectedType.toLowerCase(),
        parent_id: values.parentLocation || null,
      };

      const response = await axios.post(
        `${API_BASE_URL}/locations`,
        payload,
        setAuthHeader()
      );

      message.success(`Location added successfully at path: ${response.data.location.path}`);
      setTimeout(() => {
        const addMore = window.confirm("Location added successfully! Do you want to add another?");
        if (addMore) {
          form.resetFields();
          setSelectedType("");
          setPreviewPath("");
        } else {
          navigate("/locations");
        }
      }, 100);
    } catch (error) {
      console.error("Error creating location:", error.response?.data || error.message);
    
      const backendMessage = error?.response?.data?.error || error?.message || "";
    
      if (typeof backendMessage === "string" && backendMessage.includes("unique_name_per_parent")) {
        message.error("A location with this name already exists under the selected parent. Please choose a different name.");
      }
    
      message.error(`Failed to create location: ${backendMessage}`);
    }
  };    

  const isSubmitDisabled = () => {
    return selectedType && parentLocations.length === 0;
  };

  const handleSaveClick = () => {
    setIsSaveModalOpen(true);
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const confirmSave = () => {
    setIsSaveModalOpen(false);
    form.submit();
  };

  const confirmCancel = () => {
    setIsCancelModalOpen(false);
    navigate("/locations");
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-100 to-purple-100 p-18">
      <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button
            icon={<span>←</span>}
            onClick={() => navigate("/locations")}
            className="mr-4 text-gray-600 hover:text-blue-600 transition-colors duration-300"
          />
          <h2 className="text-4xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-500 bg-clip-text animate-pulse">
            Create New Location
          </h2>
          </div>
          <Button
            type="default"
            onClick={() => navigate("/all-locations")}
            className="bg-blue-500 hover:bg-blue-600 text-white transition-all duration-300 transform hover:scale-105"
          >
            View All Locations
          </Button>
        </div>
        <div className="bg-white shadow-2xl rounded-xl p-6 transform transition-all duration-500 hover:scale-102">
          <Form
            form={form}
            onFinish={onFinish}
            onValuesChange={handleFormChange}
            layout="vertical"
            className="max-h-[70vh] overflow-y-auto"
          >
            <Form.Item
              name="locationType"
              label="Location Type"
              rules={[{ required: true, message: "Location Type is required" }]}
            >
              <Select
                placeholder="Select location type"
                onChange={handleTypeChange}
                className="w-full transition-all duration-300 border-gray-300 rounded-md focus:border-purple-500"
              >
                <Option value="rack">Rack</Option>
                <Option value="shelf">Shelf</Option>
                <Option value="bin">Bin</Option>
                <Option value="cabinet">Cabinet</Option>
              </Select>
            </Form.Item>

            {selectedType && (
              <Form.Item
                name="parentLocation"
                label="Parent Location"
                rules={[{ required: true, message: "Parent Location is required" }]}
                // normalize={(value) => (value ? value.toUpperCase() : value)}
              >
                <Select
                  showSearch
                  placeholder={
                    parentLocations.length === 0
                      ? `No ${selectedType === "shelf" ? "racks or cabinets" : selectedType === "bin" ? "shelves" : "parents"} available`
                      : "Select parent location"
                  }
                  optionFilterProp="children"
                  className="w-full transition-all duration-300 border-gray-300 rounded-md focus:border-purple-500"
                  style={{ textTransform: 'uppercase' }}
                  disabled={parentLocations.length === 0}
                >
                  {parentLocations.map((loc) => (
                    <Option key={loc.id} value={loc.id}>
                      {loc.path}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}
            

             <Form.Item
              shouldUpdate={(prevValues, currentValues) => prevValues.locationType !== currentValues.locationType}
            >
              {({ getFieldValue }) => {
                const type = getFieldValue("locationType");
                return (
                  <>
                    {(type === "rack") && (
                      <Form.Item
                        name="rackName"
                        label="Rack Name"
                        rules={[{ required: true, message: "Rack Name is required" }]}
                        normalize={(value) => (value ? value.toUpperCase() : value)}
                      >
                        <Input placeholder="e.g., A" className="w-full transition-all duration-300 border-gray-300 rounded-md focus:border-purple-500"
                        style={{ textTransform: 'uppercase' }}/>
                      </Form.Item>
                    )}
                    {type === "cabinet" && (
                      <Form.Item
                        name="cabinetName"
                        label="Cabinet Name"
                        rules={[{ required: true, message: "Cabinet Name is required" }]}
                        normalize={(value) => (value ? value.toUpperCase() : value)}
                      >
                        <Input
                          placeholder="e.g., C"
                          className="w-full transition-all duration-300 border-gray-300 rounded-md focus:border-purple-500"
                          style={{ textTransform: "uppercase" }}
                        />
                      </Form.Item>
                    )}
                    { type === "shelf"  && (
                      <Form.Item
                        name="shelfName"
                        label="Shelf Name"
                        rules={[{ required: true, message: "Shelf Name is required" }]}
                        normalize={(value) => (value ? value.toUpperCase() : value)}
                      >
                        <Input placeholder="e.g., F4" className="w-full transition-all duration-300 border-gray-300 rounded-md focus:border-purple-500"  style={{ textTransform: 'uppercase' }} />
                      </Form.Item>
                    )}
                    {type === "bin" && (
                      <Form.Item
                        name="binName"
                        label="Bin Name"
                        rules={[{ required: true, message: "Bin Name is required" }]}
                        normalize={(value) => {
                          if (value) {
                            // Convert to uppercase first
                            const upperValue = value.toUpperCase();
                            // Check if the value is a single digit number
                            if (/^\d$/.test(upperValue)) {
                              return `0${upperValue}`; // Prepend zero if single digit
                            }
                            return upperValue; // Otherwise, return the uppercase value
                          }
                          return value;
                        }}
                      >
                        <Input placeholder="e.g., 2" className="w-full transition-all duration-300 border-gray-300 rounded-md focus:border-purple-500"  style={{ textTransform: 'uppercase' }} />
                      </Form.Item>
                    )}
                  </>
                );
              }}
            </Form.Item>
            <Form.Item label="Location Path">
              <Input
                value={previewPath}
                readOnly
                placeholder="Path will appear here after filling the form"
                className="w-full bg-gray-100 border-gray-300 rounded-md"
              />
            </Form.Item>

            <Form.Item>
            <Button
                type="primary"
                onClick={handleSaveClick}
                disabled={isSubmitDisabled()}
                className="custom-save text-white transition-all duration-300 transform hover:scale-105"
              >
                Save
              </Button>
              <Button
                style={{ marginLeft: 8 }}
                onClick={handleCancelClick}
                className="custom-cancel text-white transition-all duration-300 transform hover:scale-105"
              >
                Cancel
              </Button>
              <ConfirmationModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onConfirm={confirmSave}
                title="Confirm Save"
                content="Are you sure you want to save this new location?"
              />
              <ConfirmationModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={confirmCancel}
                title="Confirm Cancel"
                content="Are you sure you want to cancel? Any unsaved changes will be lost."
              />
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default CreateLocation;