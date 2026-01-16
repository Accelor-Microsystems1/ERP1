import React, { useState, useEffect } from "react";

const RequestForPart = () => {
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const formattedDateTime = now.toLocaleString(); // Format: DD/MM/YYYY
    setCurrentDate(formattedDateTime);
  }, []);

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100 relative max-w-[100vw] overflow-hidden">

      {/* Form Card */}
      <div className="bg-[#2E2A4D] text-white p-6 md:p-8 rounded-lg shadow-lg z-10 w-[350px] md:w-[400px]">
        <h2 className="text-xl md:text-2xl font-bold text-center mb-4">Request for Part No.</h2>

        {/* Ref No. & Date (Header) */}
        <div className="flex justify-between text-sm mb-4">
          <span>Ref No.: <b>123456</b></span>
          <span>Date: <b>{currentDate}</b></span>
        </div>

        {/* Input Fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-gray-300 text-sm">Description</label>
            <input
              type="text"
              placeholder="Diode"
              className="w-full p-2 rounded-md bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm">MPN</label>
            <input
              type="text"
              placeholder="AH34543"
              className="w-full p-2 rounded-md bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm">Make</label>
            <input
              type="text"
              placeholder="Alteo Energies"
              className="w-full p-2 rounded-md bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-4 flex justify-center">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md" onClick={() => alert("Request submitted successfully! ")}>
            Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestForPart;
