import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { submitReturnForm } from "../utils/api";
import axios from "axios";
import moment from "moment";

const ReturnFormPage = () => {
  const { state: { returnItems } = {} } = useLocation();
  const [formData, setFormData] = useState([]);
  const [urfNo, setUrfNo] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (returnItems && returnItems.length > 0) {
      console.log("Initial return items:", returnItems); // Debug log
      setFormData(returnItems.map(item => ({
        ...item,
        returnQty: "",
        reasonForReturn: "",
        status: "Not Initiated",
        component_id: item.component_id // Ensure component_id is present
      })));
      setUrfNo(`URF-${moment().format("YYYYMMDDHHmmss")}`);
    } else {
      console.log("No return items found in state"); // Debug log
    }
  }, [returnItems]);

  const handleChange = (index, field, value) => {
    const updatedData = [...formData];
    updatedData[index][field] = value;
    if (field === "returnQty" && parseInt(value) > 0) {
      updatedData[index].status = "Return Initiated";
    } else if (field === "returnQty" && parseInt(value) === 0) {
      updatedData[index].status = "Not Initiated";
    }
    setFormData(updatedData);
    console.log(`Changed ${field} at index ${index} to ${value}`, updatedData); // Debug log
  };

  const handleSubmit = async () => {
    console.log("Submit button clicked"); // Debug log
    const validData = formData.filter(item => 
      item.returnQty && item.reasonForReturn && parseInt(item.returnQty) > 0 && item.status === "Return Initiated"
    );
    console.log("Valid data for submission:", validData); // Debug log
    if (!validData.length) {
      alert("Please fill Return Quantity and Reason for Return for at least one item marked for return!");
      return;
    }

    try {
      console.log("Attempting to submit return form with:", { items: validData, urfNo }); // Debug log
      const response = await submitReturnForm(
        validData.map(item => ({
          umi: item.umi,
          component_id: item.component_id,
          project_name: item.project_name || "null",
          received_quantity: item.received_quantity || 0,
          returnQty: parseInt(item.returnQty),
          remark: item.reasonForReturn
        })),
        urfNo
      );
      console.log("API response:", response); // Debug log
      setFormData(formData.map(item => 
        validData.some(v => v.basket_id === item.basket_id)
          ? { ...item, status: response.status || "Return Initiated" }
          : item
      ));
      alert("Return form submitted successfully! URF No: " + urfNo);
      navigate("/my-requests");
    } catch (error) {
      console.error("Submission error:", error.response?.data || error.message); // Debug log
      alert(`Error submitting return form: ${error.message || "Server error"}`);
    }
  };

  const handleDeleteItem = (index) => {
    setFormData(prev => prev.filter((_, i) => i !== index));
    console.log("Deleted item at index:", index); // Debug log
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Material Return Form</h2>
      <p className="mb-4">Date: {moment().format("DD/MM/YYYY, HH:mm:ss")} | URF No.: {urfNo}</p>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">S.No.</th>
            <th className="border p-2">Description</th>
            <th className="border p-2">MPN</th>
            <th className="border p-2">Part No.</th>
            <th className="border p-2">Make</th>
            <th className="border p-2">Project Name</th>
            <th className="border p-2">Received Quantity</th>
            <th className="border p-2">Return Quantity</th>
            <th className="border p-2">Reason for Return</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {formData.map((item, index) => (
            <tr key={index}>
              <td className="border p-2">{index + 1}</td>
              <td className="border p-2">{item.item_description}</td>
              <td className="border p-2">{item.mpn}</td>
              <td className="border p-2">{item.part_no}</td>
              <td className="border p-2">{item.make}</td>
              <td className="border p-2">{item.project_name || "null"}</td>
              <td className="border p-2">{item.received_quantity || 0}</td>
              <td className="border p-2">
                <input
                  type="number"
                  value={item.returnQty}
                  onChange={(e) => handleChange(index, "returnQty", e.target.value)}
                  className="border p-1 w-full"
                  min="0"
                  max={item.received_quantity || 0}
                  required
                />
              </td>
              <td className="border p-2">
                <input
                  type="text"
                  value={item.reasonForReturn}
                  onChange={(e) => handleChange(index, "reasonForReturn", e.target.value)}
                  className="border p-1 w-full"
                  placeholder="Enter Reason for Return"
                  required={item.returnQty > 0}
                />
              </td>
              <td className="border p-2">{item.status}</td>
              <td className="border p-2">
                <button
                  onClick={() => handleDeleteItem(index)}
                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <button
          className="bg-red-500 text-white px-4 py-2 rounded mr-2 hover:bg-red-400 transition duration-300"
          onClick={() => navigate("/my-requests")}
        >
          Cancel
        </button>
        <button
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-400 transition duration-300"
          onClick={handleSubmit}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default ReturnFormPage;