import React, { useState } from "react";
import { ShoppingCart } from "lucide-react";

const InventorySearch = () => {
  const [inventory] = useState({
    partNo: "12345",
    mpn: "MPN-6789",
    make: "BrandX",
    description: "PCB",
    onHandQuantity: 10,
    forecastQuantity: 160,
    orderedBy: "R&D",
    poNumber: "PO123",
    purchaseOrders: [
      { poNo: "PO123", poDate: "2025-03-20", orderedQty: 100, receivedQty: 80, deliveredDate: "2025-03-25", status: "Partial" },
    ],
    stockCard: [
      { date: "2025-03-19", poNo: "PO123", mrr: "MRR-001", requestedQty: 20, issuedQty: 10, issueFormNo: "IFN-456", balance: 70 },
    ],
  });

  return (
    <div className="p-6 bg-[#F4F2F2] min-h-screen fixed left-0 right-0 top-10">

      {/* First and Second Boxes Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* First Box: Part Details */}
        <div className="p-4 bg-[#3A3A5A] shadow-lg rounded-xl h-full">
          <div className="flex justify-between gap-4 h-23">
            {[{ label: "Part No.", value: inventory.partNo },
              { label: "MPN", value: inventory.mpn },
              { label: "Make", value: inventory.make },
              { label: "Description", value: inventory.description }].map((item, index) => (
              <div key={index} className="p-2 bg-[#EFEFF2] rounded-md text-center font-bold shadow-md w-full">
                <p className="text-[#3A3A5A] text-xs font-extrabold whitespace-nowrap">{item.label}</p>
                <p className="text-sm text-[#3A3A5A]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Second Box: Quantity and Order Details (Single Box) */}
        <div className="p-4 bg-[#D9D9D9] shadow-lg rounded-xl h-full">
          <div className="flex justify-between text-sm font-bold text-[#3A3A5A]">
            <p>On Hand Quantity: <span className="text-[#434372]">{inventory.onHandQuantity}</span></p>
            <p>PO Number: <span className="text-[#434372]">{inventory.poNumber}</span></p>
          </div>
          <div className="flex justify-between text-sm font-bold text-[#3A3A5A] mt-2">
            <p>Forecast Quantity: <span className="text-[#434372]">{inventory.forecastQuantity}</span></p>
            <p>Ordered By: <span className="text-[#434372]">{inventory.orderedBy}</span></p>
          </div>
           {/* Buttons */}
           <div className="flex justify-end gap-3 mt-4">
            <button className="px-3 py-1 bg-green-600 text-white font-semibold rounded-md shadow hover:bg-green-500">Add to Basket</button>
            <button className="px-3 py-1 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-500"><ShoppingCart size={18} className="mr-2" /> </button>
          </div>
        </div>
      </div>

      {/* Purchase Order and Stock Card Sections */}
      <div className="grid grid-cols-2 gap-4 mt-6 min-h-[370px]">
        <div className="bg-[#D9D9D9] p-4 shadow-lg rounded-xl overflow-auto flex flex-col h-full">
          <h3 className="text-lg font-bold text-black mb-2">Purchase Order Details</h3>
          <table className="w-full border-collapse border border-gray-700 text-xs">
            <thead>
              <tr className="bg-[#D9D9D9]">
                {[
                  "S.No", "PO No", "PO Date", "Ordered Qty", "Received Qty", "Delivered Date", "Status"
                ].map((heading, index) => (
                  <th key={index} className="border p-1 text-black whitespace-nowrap">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.purchaseOrders.map((order, index) => (
                <tr key={index} className="text-center bg-[#D9D9D9] hover:bg-[#bcbcbf]">
                  {[
                    index + 1, order.poNo, order.poDate, order.orderedQty,
                    order.receivedQty, order.deliveredDate, order.status
                  ].map((value, i) => (
                    <td key={i} className="border p-1 text-black">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[#2E2E4F] p-4 shadow-lg rounded-xl overflow-auto flex flex-col h-full">
          <h3 className="text-lg font-bold mb-2 text-white">Stock Card</h3>
          <table className="w-full border-collapse border border-gray-700 text-xs">
            <thead>
              <tr className="bg-[#2E2E4F]">
                {[
                  "S.No", "Date", "PO No", "MRR", "Requested Qty", "Issued Qty", "Issue Form No", "Balance"
                ].map((heading, index) => (
                  <th key={index} className="border p-1 text-white whitespace-nowrap">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.stockCard.map((stock, index) => (
                <tr key={index} className="text-center bg-[#2E2E4F] hover:bg-[#252545]">
                  {[
                    index + 1, stock.date, stock.poNo, stock.mrr,
                    stock.requestedQty, stock.issuedQty, stock.issueFormNo, stock.balance
                  ].map((value, i) => (
                    <td key={i} className="border p-1 text-white">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventorySearch;
