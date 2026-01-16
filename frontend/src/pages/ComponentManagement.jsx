import React, { useState } from 'react';

const ComponentManagement = () => {
  const [components] = useState([
    { id: '1', part_no: '1110100269', vendor_name: 'SCTMP', min_order_value: 11025.00 },
    { id: '2', part_no: '1900123128', vendor_name: 'TATA', min_order_value: 11150.00 },
    { id: '3', part_no: '2567891234', vendor_name: "Sharma & Son's Pvt Ltd", min_order_value: 17000.50 },
    { id: '4', part_no: '4210987654', vendor_name: 'S Puri & CO', min_order_value: 1800.00 },
    { id: '5', part_no: '6891234560', vendor_name: 'Dhiman Pvt Ltd', min_order_value: 12000.00 },
    { id: '6', part_no: '8543210987', vendor_name: 'Arrow Electronics', min_order_value: 2500.00 },
    { id: '7', part_no: '9234567890', vendor_name: 'SCTMP', min_order_value: 3000.00 },
  ]);
  const [error, setError] = useState(''); // Added error state

  return (
    <div className="min-h-screen bg-gray-50 p-12">
      {/* Header
      <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center">
          <button className="mr-4 text-blue-600 hover:text-blue-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          <img src="https://via.placeholder.com/40" alt="ACCELOR Logo" className="h-10" />
          <h1 className="text-xl font-bold text-gray-700 ml-2">ACCELOR</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-blue-600 hover:text-blue-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="relative text-blue-600 hover:text-blue-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">5</span>
          </button>
          <span className="text-gray-600">kkpurchase@gmail.com</span>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Logout</button>
        </div>
      </header> */}

      {/* Main Content */}
      <main className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Component Management</h2>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create New Entry
          </button>
        </div>

        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-200 bg-white shadow-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 p-3 text-left text-sm font-semibold text-gray-700">Part Number</th>
                <th className="border border-gray-200 p-3 text-left text-sm font-semibold text-gray-700">Vendor Name</th>
                <th className="border border-gray-200 p-3 text-left text-sm font-semibold text-gray-700">Min Order Value</th>
              </tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <tr key={component.id} className="hover:bg-gray-50 transition duration-150">
                  <td className="border border-gray-200 p-3 text-gray-600">{component.part_no}</td>
                  <td className="border border-gray-200 p-3 text-gray-600">{component.vendor_name}</td>
                  <td className="border border-gray-200 p-3 text-gray-600">Rs.{component.min_order_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default ComponentManagement;