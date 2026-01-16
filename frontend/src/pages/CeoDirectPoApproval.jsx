import React, { useState, useEffect } from "react";
import { Table, Input, Modal, Button, Spin, message, Card, Typography, Row, Col, Tabs, Checkbox, Menu } from "antd";
import { SearchOutlined, BarChartOutlined, CalculatorOutlined, HistoryOutlined, DownOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { fetchDirectPoComponents, approveDirectPoRequest, rejectDirectPoRequest, markDirectPoRequestAsHold, fetchPastDirectPoApprovals } from "../utils/api";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ArcElement,
  Title as ChartTitle,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement, ChartTitle);

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const CeoDirectPoApproval = ({ role }) => {
  const [groupedComponents, setGroupedComponents] = useState([]);
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [pastApprovals, setPastApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actionTarget, setActionTarget] = useState({ directSequence: null, mpn: null, isBatch: false });
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcInput, setCalcInput] = useState("");
  const [calcResult, setCalcResult] = useState("");
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [pieChartData, setPieChartData] = useState(null);
  const [activeTab, setActiveTab] = useState("active");
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [isApproveConfirmModalOpen, setIsApproveConfirmModalOpen] = useState(false);
  const [isRejectConfirmModalOpen, setIsRejectConfirmModalOpen] = useState(false);
  const [mainColumnVisibilityVisible, setMainColumnVisibilityVisible] = useState(false);
  const [detailColumnVisibilityVisible, setDetailColumnVisibilityVisible] = useState(false);
  const [mainColumnVisibility, setMainColumnVisibility] = useState({
    mrf_no: true,
    direct_sequence: true,
    vendor: true,
    created_at: true,
    note: true,
  });
  const [detailColumnVisibility, setDetailColumnVisibility] = useState({
    select: true,
    mpn: true,
    item_description: true,
    make: true,
    part_no: true,
    uom: true,
    requested_quantity: true,
    gst_type: true,
    rate_per_unit: true,
    amount_inr: true,
    gst_amount: true,
    status: true,
    actions: true,
  });

  const userRole = role || localStorage.getItem("role") || "employee";
  const userName = localStorage.getItem("name") || "Unknown";
  const isCeo = userRole === "ceo";

  useEffect(() => {
    if (!isCeo) return;
    fetchData();
    fetchPastApprovalData();
  }, [isCeo]);

  useEffect(() => {
    prepareChartData([...groupedComponents, ...pastApprovals]);
  }, [groupedComponents, pastApprovals]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await fetchDirectPoComponents();
      const groupedData = data.reduce((acc, item) => {
        const sequence = item.direct_sequence || "N/A";
        if (!acc[sequence]) {
          acc[sequence] = {
            direct_sequence: sequence,
            mrf_no: item.mrf_no || "N/A",
            vendor: item.vendor || "N/A",
            created_at: item.created_at || "N/A",
            note: item.note || "N/A",
            project_name: item.project_name || "N/A",
            total_po_cost: parseFloat(item.total_po_cost || 0),
            components: [],
            key: sequence,
          };
        }
        acc[sequence].components.push(
          ...(item.components || []).map(comp => ({
            mpn: comp.mpn || "N/A",
            item_description: comp.item_description || "N/A",
            make: comp.make || "N/A",
            part_no: comp.part_no || "N/A",
            uom: comp.uom || "N/A",
            requested_quantity: comp.requested_quantity || 0,
            gst_type: comp.gst_type || "N/A",
            rate_per_unit: parseFloat(comp.rate_per_unit || 0),
            amount_inr: parseFloat(comp.amount_inr || 0),
            gst_amount: parseFloat(comp.gst_amount || 0),
            status: comp.status || "CEO Approval Pending",
          }))
        );
        return acc;
      }, {});
      const groupedArray = Object.values(groupedData);
      setGroupedComponents(groupedArray);
      setFilteredComponents(groupedArray);
    } catch (error) {
      message.error(`Failed to fetch components: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchPastApprovalData = async () => {
    setLoading(true);
    try {
      const data = await fetchPastDirectPoApprovals();
      const groupedData = data.reduce((acc, item) => {
        const sequence = item.direct_sequence || "N/A";
        if (!acc[sequence]) {
          acc[sequence] = {
            direct_sequence: sequence,
            mrf_no: item.mrf_no || "N/A",
            vendor: item.vendor || "N/A",
            created_at: item.created_at || "N/A",
            note: item.note || "N/A",
            project_name: item.project_name || "N/A",
            total_po_cost: parseFloat(item.total_po_cost || 0),
            components: [],
            key: sequence,
          };
        }
        acc[sequence].components.push(
          ...(item.components || []).map(comp => ({
            mpn: comp.mpn || "N/A",
            item_description: comp.item_description || "N/A",
            make: comp.make || "N/A",
            part_no: comp.part_no || "N/A",
            uom: comp.uom || "N/A",
            requested_quantity: comp.requested_quantity || 0,
            gst_type: comp.gst_type || "N/A",
            rate_per_unit: parseFloat(comp.rate_per_unit || 0),
            amount_inr: parseFloat(comp.amount_inr || 0),
            gst_amount: parseFloat(comp.gst_amount || 0),
            status: comp.status || "Unknown",
          }))
        );
        return acc;
      }, {});
      const groupedArray = Object.values(groupedData);
      setPastApprovals(groupedArray);
    } catch (error) {
      message.error(`Failed to fetch past approvals: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = data => {
    const projects = [...new Set(data.map(item => item.project_name || "N/A"))];
    const quantities = projects.map(project =>
      data
        .filter(item => item.project_name === project)
        .reduce((sum, item) => sum + item.components.reduce((s, c) => s + (parseInt(c.requested_quantity, 10) || 0), 0), 0)
    );
    setChartData({
      labels: projects,
      datasets: [
        {
          label: "Total Quantity Ordered",
          data: quantities,
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
          borderRadius: 4,
          hoverBackgroundColor: "rgba(59, 130, 246, 1)",
        },
      ],
    });

    const vendors = [...new Set(data.map(item => item.vendor))];
    const vendorCounts = vendors.map(vendor => data.filter(item => item.vendor === vendor).length);
    setPieChartData({
      labels: vendors,
      datasets: [
        {
          label: "Requests by Vendor",
          data: vendorCounts,
          backgroundColor: [
            "rgba(255, 99, 132, 0.7)",
            "rgba(54, 162, 235, 0.7)",
            "rgba(255, 206, 86, 0.7)",
            "rgba(75, 192, 192, 0.7)",
            "rgba(153, 102, 255, 0.7)",
            "rgba(255, 159, 64, 0.7)",
          ],
          borderColor: "#fff",
          borderWidth: 2,
          hoverOffset: 10,
        },
      ],
    });
  };

  const handleCheckboxChange = (mpn, checked) => {
    setSelectedComponents(prev =>
      checked ? [...prev, mpn] : prev.filter(item => item !== mpn)
    );
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const selectableMpns = selectedGroup?.components
        .filter(comp => comp.status === "CEO Approval Pending" || comp.status === "Hold")
        .map(comp => comp.mpn) || [];
      setSelectedComponents(selectableMpns);
    } else {
      setSelectedComponents([]);
    }
  };

  const calculateSelectedTotalPoCost = () => {
    if (!selectedGroup || !selectedComponents.length) return selectedGroup?.total_po_cost || 0;
    return selectedGroup.components
      .filter(comp => selectedComponents.includes(comp.mpn))
      .reduce((sum, comp) => sum + (comp.amount_inr + comp.gst_amount), 0);
  };

  const handleApprove = (directSequence, mpn = null, isBatch = false) => {
    if (!isCeo || directSequence === "N/A") {
      message.error("Invalid request.");
      return;
    }
    setActionTarget({ directSequence, mpn, isBatch });
    setIsApproveConfirmModalOpen(true);
  };

  const confirmApproval = async () => {
    try {
      let successMessage = "";
      if (actionTarget.isBatch) {
        const allMpns = selectedGroup.components.map(comp => comp.mpn);
        const unselectedMpns = allMpns.filter(mpn => !selectedComponents.includes(mpn));

        for (const selectedMpn of selectedComponents) {
          await approveDirectPoRequest(actionTarget.directSequence, { mpn: selectedMpn });
        }

        if (unselectedMpns.length > 0) {
          await markDirectPoRequestAsHold(actionTarget.directSequence, { mpns: unselectedMpns });
        }

        successMessage = `Selected ${selectedComponents.length} component(s) for ${actionTarget.directSequence} approved successfully. ${unselectedMpns.length} unselected component(s) marked as Hold.`;
      } else {
        await approveDirectPoRequest(actionTarget.directSequence, { mpn: actionTarget.mpn });
        successMessage = actionTarget.mpn
          ? `Component ${actionTarget.mpn} approved successfully.`
          : `Request ${actionTarget.directSequence} approved successfully.`;
      }

      message.success(successMessage);
      await fetchData();
      await fetchPastApprovalData();
      setIsApproveConfirmModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedGroup(null);
      setSelectedComponents([]);
      setActionTarget({ directSequence: null, mpn: null, isBatch: false });
    } catch (error) {
      message.error(`Failed to approve: ${error.message}`);
    }
  };

  const handleReject = (directSequence, mpn = null, isBatch = false) => {
    if (!isCeo || directSequence === "N/A") {
      message.error("Invalid request.");
      return;
    }
    setActionTarget({ directSequence, mpn, isBatch });
    setRejectionNote("");
    setIsRejectModalOpen(true);
  };

  const confirmRejection = async () => {
    if (!rejectionNote.trim()) {
      message.error("Please provide a reason for rejection.");
      return;
    }
    setIsRejectModalOpen(false);
    setIsRejectConfirmModalOpen(true);
  };

  const confirmRejectionFinal = async () => {
    try {
      const noteEntry = [
        {
          timestamp: new Date().toISOString(),
          userName,
          role: userRole,
          content: rejectionNote,
        },
      ];

      let successMessage = "";
      if (actionTarget.isBatch) {
        const allMpns = selectedGroup.components.map(comp => comp.mpn);
        const unselectedMpns = allMpns.filter(mpn => !selectedComponents.includes(mpn));

        for (const selectedMpn of selectedComponents) {
          await rejectDirectPoRequest(actionTarget.directSequence, {
            note: noteEntry,
            reason: "Rejected by CEO",
            mpn: selectedMpn,
          });
        }

        if (unselectedMpns.length > 0) {
          await markDirectPoRequestAsHold(actionTarget.directSequence, { mpns: unselectedMpns });
        }

        successMessage = `Selected ${selectedComponents.length} component(s) for ${actionTarget.directSequence} rejected successfully. ${unselectedMpns.length} unselected component(s) marked as Hold.`;
      } else {
        await rejectDirectPoRequest(actionTarget.directSequence, {
          note: noteEntry,
          reason: "Rejected by CEO",
          mpn: actionTarget.mpn,
        });
        successMessage = actionTarget.mpn
          ? `Component ${actionTarget.mpn} rejected successfully.`
          : `Request ${actionTarget.directSequence} rejected successfully.`;
      }

      message.success(successMessage);
      await fetchData();
      await fetchPastApprovalData();
      setIsRejectConfirmModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedGroup(null);
      setSelectedComponents([]);
      setActionTarget({ directSequence: null, mpn: null, isBatch: false });
    } catch (error) {
      message.error(`Failed to reject: ${error.message}`);
    }
  };

  const showDetails = group => {
    setSelectedGroup(group);
    setSelectedComponents([]);
    setIsDetailsModalOpen(true);
  };

  const handleCalculatorInput = value => {
    setCalcInput(prev => prev + value);
  };

  const handleCalculate = () => {
    try {
      const result = eval(
        calcInput
          .replace(/sin/g, "Math.sin")
          .replace(/cos/g, "Math.cos")
          .replace(/tan/g, "Math.tan")
          .replace(/sqrt/g, "Math.sqrt")
          .replace(/log/g, "Math.log10")
          .replace(/ln/g, "Math.log")
          .replace(/exp/g, "Math.exp")
          .replace(/pi/g, "Math.PI")
      );
      setCalcResult(Number.isFinite(result) ? result.toFixed(4) : "Error");
    } catch {
      setCalcResult("Error");
    }
  };

  const handleClearCalculator = () => {
    setCalcInput("");
    setCalcResult("");
  };

  const renderNote = note => {
    if (note === "N/A" || !note) return "N/A";
    if (Array.isArray(note)) {
      return note.map(n => n.content).join("; ");
    }
    return note;
  };

  const handleSearch = (e, tab) => {
    const value = e.target.value.toLowerCase();
    setSearchTerm(value);
    if (tab === "active") {
      const filtered = groupedComponents.filter(
        item =>
          item.direct_sequence.toLowerCase().includes(value) ||
          item.mrf_no.toLowerCase().includes(value) ||
          item.vendor.toLowerCase().includes(value) ||
          item.project_name.toLowerCase().includes(value) ||
          (item.note !== "N/A" &&
            Array.isArray(item.note) &&
            item.note.some(n => n.content.toLowerCase().includes(value)))
      );
      setFilteredComponents(filtered);
    } else {
      const filtered = pastApprovals.filter(
        item =>
          item.direct_sequence.toLowerCase().includes(value) ||
          item.mrf_no.toLowerCase().includes(value) ||
          item.vendor.toLowerCase().includes(value) ||
          item.project_name.toLowerCase().includes(value) ||
          (item.note !== "N/A" &&
            Array.isArray(item.note) &&
            item.note.some(n => n.content.toLowerCase().includes(value)))
      );
      setPastApprovals(filtered);
    }
  };

  const isInPastApprovals = (directSequence) => {
    return pastApprovals.some(item => item.direct_sequence === directSequence);
  };

  const mainColumns = [
    {
      title: "MRF No",
      dataIndex: "mrf_no",
      sorter: (a, b) => a.mrf_no.localeCompare(b.mrf_no),
      render: (text, record) => <span className={isInPastApprovals(record.direct_sequence) ? "text-black-600" : "text-blue-600"}>{text}</span>,
      hidden: !mainColumnVisibility.mrf_no,
    },
    {
      title: "Direct Sequence",
      dataIndex: "direct_sequence",
      sorter: (a, b) => a.direct_sequence.localeCompare(b.direct_sequence),
      render: (text, record) => <span className={isInPastApprovals(record.direct_sequence) ? "text-black-600" : "text-blue-600"}>{text}</span>,
      hidden: !mainColumnVisibility.direct_sequence,
    },
    {
      title: "Vendor",
      dataIndex: "vendor",
      sorter: (a, b) => a.vendor.localeCompare(b.vendor),
      render: (text, record) => <span className={isInPastApprovals(record.direct_sequence) ? "text-black-600" : "text-blue-600"}>{text}</span>,
      hidden: !mainColumnVisibility.vendor,
    },
    {
      title: "Created At",
      dataIndex: "created_at",
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      render: (text, record) => <span className={isInPastApprovals(record.direct_sequence) ? "text-black-600" : "text-blue-600"}>{text}</span>,
      hidden: !mainColumnVisibility.created_at,
    },
    {
      title: "Note",
      dataIndex: "note",
      sorter: (a, b) => renderNote(a.note).localeCompare(renderNote(b.note)),
      render: (note, record) => <span className={isInPastApprovals(record.direct_sequence) ? "text-black-600" : "text-blue-600"}>{renderNote(note)}</span>,
      hidden: !mainColumnVisibility.note,
    },
  ].filter(column => !column.hidden);

  const detailColumns = [
    {
      title: () => (
        <Checkbox
          onChange={e => handleSelectAll(e.target.checked)}
          checked={selectedComponents.length === selectedGroup?.components.filter(comp => comp.status === "CEO Approval Pending" || comp.status === "Hold").length}
        >
          Select All
        </Checkbox>
      ),
      key: "select",
      render: (_, record) => {
        if (record.status !== "CEO Approval Pending" && record.status !== "Hold") return null;
        return (
          <Checkbox
            checked={selectedComponents.includes(record.mpn)}
            onChange={e => handleCheckboxChange(record.mpn, e.target.checked)}
          />
        );
      },
      hidden: !detailColumnVisibility.select,
    },
    {
      title: "MPN",
      dataIndex: "mpn",
      render: text => <span className="font-medium">{text}</span>,
      hidden: !detailColumnVisibility.mpn,
    },
    {
      title: "Item Description",
      dataIndex: "item_description",
      hidden: !detailColumnVisibility.item_description,
    },
    {
      title: "Make",
      dataIndex: "make",
      hidden: !detailColumnVisibility.make,
    },
    {
      title: "Part No",
      dataIndex: "part_no",
      hidden: !detailColumnVisibility.part_no,
    },
    {
      title: "UoM",
      dataIndex: "uom",
      hidden: !detailColumnVisibility.uom,
    },
    {
      title: "Quantity",
      dataIndex: "requested_quantity",
      align: "right",
      hidden: !detailColumnVisibility.requested_quantity,
    },
    {
      title: "GST Type",
      dataIndex: "gst_type",
      hidden: !detailColumnVisibility.gst_type,
    },
    {
      title: "Rate/Unit",
      dataIndex: "rate_per_unit",
      align: "right",
      render: text => `₹${text.toFixed(2)}`,
      hidden: !detailColumnVisibility.rate_per_unit,
    },
    {
      title: "Amount (INR)",
      dataIndex: "amount_inr",
      align: "right",
      render: text => `₹${text.toFixed(2)}`,
      hidden: !detailColumnVisibility.amount_inr,
    },
    {
      title: "GST Amount",
      dataIndex: "gst_amount",
      align: "right",
      render: text => `₹${text.toFixed(2)}`,
      hidden: !detailColumnVisibility.gst_amount,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: text => (
        <span
          className={`px-2 py-1 rounded ${
            text === "CEO Approval Done"
              ? "bg-green-100 text-green-800"
              : text === "Rejected"
              ? "bg-red-100 text-red-800"
              : text === "Hold"
              ? "bg-gray-100 text-gray-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {text}
        </span>
      ),
      hidden: !detailColumnVisibility.status,
    },
    {
      title: "Actions",
      render: (_, record) => {
        if (record.status !== "CEO Approval Pending" && record.status !== "Hold") return null;
        return (
          <div className="flex gap-2">
            <Button
              type="primary"
              size="small"
              className="bg-green-500 hover:bg-green-600"
              onClick={() => handleApprove(selectedGroup.direct_sequence, record.mpn)}
            >
              Approve
            </Button>
            <Button
              type="primary"
              size="small"
              className="bg-red-500 hover:bg-red-600"
              onClick={() => handleReject(selectedGroup.direct_sequence, record.mpn)}
            >
              Reject
            </Button>
          </div>
        );
      },
      hidden: !detailColumnVisibility.actions,
    },
  ].filter(column => !column.hidden);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Quantity by Project (Active & Past)" },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "Total Quantity" } },
      x: { title: { display: true, text: "Project" } },
    },
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "right" },
      title: { display: true, text: "Requests by Vendor (Active & Past)" },
    },
  };

  if (!isCeo) return <div className="p-6 text-red-600">Unauthorized Access</div>;

  return (
    <div className="p-12 bg-gray-50 min-h-screen">
      <Card className="shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <Title level={2} className="border-b-2 border-blue-600 pb-2">
            CEO Direct PO Approvals
          </Title>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setIsChartModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-200"
            >
              <BarChartOutlined />
              View Analytics
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setActiveTab("past")}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-200"
            >
              <HistoryOutlined />
              Past Approvals
            </motion.button>
            <Button onClick={() => setMainColumnVisibilityVisible(true)} className="flex items-center gap-2  !bg-yellow-500 !text-white hover:bg-blue-600">
              Customize Main Columns <DownOutlined />
            </Button>
          </div>
        </div>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Active Requests" key="active" style={{ height: "500px", overflowY: "auto" }}>
            <Input
              placeholder="Search by MRF No, Sequence, Vendor, Project, or Note..."
              value={searchTerm}
              onChange={e => handleSearch(e, "active")}
              prefix={<SearchOutlined />}
              className="w-64 mb-4"
            />
            {loading ? (
              <Spin size="large" className="flex justify-center py-10" />
            ) : (
              <Table
                columns={mainColumns}
                dataSource={filteredComponents}
                rowKey="key"
                onRow={record => ({
                  onClick: () => showDetails(record),
                  className: "cursor-pointer",
                })}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 800 }}
              />
            )}
          </TabPane>
          <TabPane tab="Past Approvals" key="past" style={{ height: "480px", overflowY: "auto" }}>
            <Input
              placeholder="Search by MRF No, Sequence, Vendor, Project, or Note..."
              value={searchTerm}
              onChange={e => handleSearch(e, "past")}
              prefix={<SearchOutlined />}
              className="w-64 mb-4"
            />
            {loading ? (
              <Spin size="large" className="flex justify-center py-10" />
            ) : (
              <Table
                columns={mainColumns}
                dataSource={pastApprovals}
                rowKey="key"
                onRow={record => ({
                  onClick: () => showDetails(record),
                  className: "cursor-pointer",
                })}
                pagination={{ pageSize: 10 }}
              />
            )}
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="Customize Main Columns"
        open={mainColumnVisibilityVisible}
        onCancel={() => setMainColumnVisibilityVisible(false)}
        footer={[
          <Button key="save" type="primary" onClick={() => setMainColumnVisibilityVisible(false)}>
            Save
          </Button>,
          <Button key="cancel" onClick={() => setMainColumnVisibilityVisible(false)}>
            Cancel
          </Button>,
        ]}
        width={400}
      >
        {Object.keys(mainColumnVisibility).map((key) => (
          <div key={key} className="flex items-center mb-2">
            <Checkbox
              checked={mainColumnVisibility[key]}
              onChange={(e) => setMainColumnVisibility({ ...mainColumnVisibility, [key]: e.target.checked })}
            >
              {key === "mrf_no" ? "MRF No" : 
               key === "direct_sequence" ? "Direct Sequence" : 
               key === "vendor" ? "Vendor" : 
               key === "created_at" ? "Created At" : 
               "Note"}
            </Checkbox>
          </div>
        ))}
      </Modal>

      <Modal
        title="Direct PO Analytics Dashboard"
        open={isChartModalOpen}
        onCancel={() => setIsChartModalOpen(false)}
        footer={null}
        width={900}
        bodyStyle={{ padding: "16px", backgroundColor: "#f9fafb" }}
        className="rounded-lg shadow-xl"
      >
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700 mb-3">Quantity Ordered by Project</h3>
            <div style={{ height: "300px" }}>
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700 mb-3">PO Requests by Vendor</h3>
            <div style={{ height: "300px", maxWidth: "400px", margin: "0 auto" }}>
              {pieChartData && <Pie data={pieChartData} options={pieChartOptions} />}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex justify-between items-center">
            <span className="text-xl font-semibold text-gray-800">
              Details for Direct Sequence {selectedGroup?.direct_sequence || ""}
            </span>
            <Button
              onClick={() => setDetailColumnVisibilityVisible(true)}
              className="flex items-center gap-2  !bg-yellow-500 !text-white !hover:bg-blue-600 mr-4"
            >
              Customize Detail Columns
            </Button>
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => {
          setIsDetailsModalOpen(false);
          setSelectedGroup(null);
          setIsCalculatorOpen(false);
          setSelectedComponents([]);
        }}
        footer={[
          <Button
            key="reject"
            type="primary"
            danger
            disabled={selectedComponents.length === 0}
            onClick={() => handleReject(selectedGroup?.direct_sequence, null, true)}
          >
            Reject Selected
          </Button>,
          <Button
            key="approve"
            type="primary"
            className="bg-green-500"
            disabled={selectedComponents.length === 0}
            onClick={() => handleApprove(selectedGroup?.direct_sequence, null, true)}
          >
            Approve Selected
          </Button>,
        ]}
        width="100vw"
        style={{ top: 0 }}
        bodyStyle={{ height: "100vh", overflowY: "auto", paddingRight: "24px" }}
        closeIcon={<span className="text-xl text-gray-600 hover:text-gray-800">×</span>}
      >
        <Modal
          title="Customize Detail Columns"
          open={detailColumnVisibilityVisible}
          onCancel={() => setDetailColumnVisibilityVisible(false)}
          footer={[
            <Button key="save" type="primary" onClick={() => setDetailColumnVisibilityVisible(false)}>
              Save
            </Button>,
            <Button key="cancel" onClick={() => setDetailColumnVisibilityVisible(false)}>
              Cancel
            </Button>,
          ]}
          width={400}
        >
          {Object.keys(detailColumnVisibility).map((key) => (
            <div key={key} className="flex items-center mb-2">
              <Checkbox
                checked={detailColumnVisibility[key]}
                onChange={(e) => setDetailColumnVisibility({ ...detailColumnVisibility, [key]: e.target.checked })}
              >
                {key === "select" ? "Select" :
                 key === "mpn" ? "MPN" :
                 key === "item_description" ? "Item Description" :
                 key === "make" ? "Make" :
                 key === "part_no" ? "Part No" :
                 key === "uom" ? "UoM" :
                 key === "requested_quantity" ? "Quantity" :
                 key === "gst_type" ? "GST Type" :
                 key === "rate_per_unit" ? "Rate/Unit" :
                 key === "amount_inr" ? "Amount (INR)" :
                 key === "gst_amount" ? "GST Amount" :
                 key === "status" ? "Status" :
                 "Actions"}
              </Checkbox>
            </div>
          ))}
        </Modal>
        <Row gutter={[16, 16]} className="mb-4">
          <Col span={8}>
            <Text strong>Project:</Text> {selectedGroup?.project_name}
          </Col>
          <Col span={8}>
            <Text strong>Vendor:</Text> {selectedGroup?.vendor}
          </Col>
          <Col span={8}>
            <Text strong>Created At:</Text> {selectedGroup?.created_at}
          </Col>
          <Col span={24}>
            <Text strong>Note:</Text> {renderNote(selectedGroup?.note)}
          </Col>
        </Row>
        <Table
          columns={detailColumns}
          dataSource={selectedGroup?.components || []}
          rowKey="mpn"
          pagination={false}
          scroll={{ x: 1000 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell colSpan={detailColumnVisibility.select ? 8 : 7} align="right">
                Total PO Cost:
              </Table.Summary.Cell>
              <Table.Summary.Cell colSpan={detailColumnVisibility.select ? 4 : 5} align="right">
                ₹{calculateSelectedTotalPoCost().toFixed(2)}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
        <motion.div
          className="mt-4"
          animate={{ height: isCalculatorOpen ? "auto" : 0 }}
          style={{ overflow: "hidden" }}
        >
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 shadow-md">
            <Title level={4}>Scientific Calculator</Title>
            <Input
              value={calcInput}
              onChange={e => setCalcInput(e.target.value)}
              placeholder="Enter expression (e.g., sin(pi/2)+sqrt(16))"
              className="mb-2 text-right text-lg"
              style={{ height: "40px" }}
            />
            <Input
              value={calcResult}
              readOnly
              className="mb-2 text-right text-lg font-semibold text-blue-600"
              style={{ height: "40px" }}
            />
            <div className="grid grid-cols-5 gap-2">
              {[
                ["sin", "cos", "tan", "sqrt", "log"],
                ["ln", "exp", "(", ")", "pi"],
                ["7", "8", "9", "/", "^"],
                ["4", "5", "6", "*", "-"],
                ["1", "2", "3", "+", "="],
                ["0", ".", ".", "C", "C"],
              ].map((row, rowIndex) =>
                row.map((btn, btnIndex) => {
                  const isOperator = ["+", "-", "*", "/", "^", "="].includes(btn);
                  const isFunction = ["sin", "cos", "tan", "sqrt", "log", "ln", "exp"].includes(btn);
                  const isClear = btn === "C";
                  return (
                    <Button
                      key={`${rowIndex}-${btnIndex}`}
                      onClick={() => {
                        if (btn === "=") handleCalculate();
                        else if (btn === "C") handleClearCalculator();
                        else handleCalculatorInput(
                          isFunction ? `${btn}(` : btn === "^" ? "**" : btn
                        );
                      }}
                      className={`
                        ${isOperator ? "bg-blue-500 text-white hover:bg-blue-600" : ""}
                        ${isFunction ? "bg-gray-200 text-gray-800 hover:bg-gray-300" : ""}
                        ${isClear ? "bg-red-500 text-white hover:bg-red-600 col-span-${rowIndex === 5 && btnIndex === 3 ? 2 : 1}" : ""}
                        ${!isOperator && !isFunction && !isClear ? "bg-white border border-gray-300 hover:bg-gray-100" : ""}
                        rounded h-10
                      `}
                    >
                      {btn}
                    </Button>
                  );
                })
              )}
            </div>
          </Card>
        </motion.div>
        <Button
          icon={<CalculatorOutlined />}
          onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
          className="mt-4 bg-blue-500 text-white hover:bg-blue-600"
        >
          {isCalculatorOpen ? "Hide" : "Show"} Calculator
        </Button>
      </Modal>

      <Modal
        title="Customize Detail Columns"
        open={detailColumnVisibilityVisible}
        onCancel={() => setDetailColumnVisibilityVisible(false)}
        footer={[
          <Button key="save" type="primary" onClick={() => setDetailColumnVisibilityVisible(false)}>
            Save
          </Button>,
          <Button key="cancel" onClick={() => setDetailColumnVisibilityVisible(false)}>
            Cancel
          </Button>,
        ]}
        width={400}
      >
        {Object.keys(detailColumnVisibility).map((key) => (
          <div key={key} className="flex items-center mb-2">
            <Checkbox
              checked={detailColumnVisibility[key]}
              onChange={(e) => setDetailColumnVisibility({ ...detailColumnVisibility, [key]: e.target.checked })}
            >
              {key === "select" ? "Select" :
               key === "mpn" ? "MPN" :
               key === "item_description" ? "Item Description" :
               key === "make" ? "Make" :
               key === "part_no" ? "Part No" :
               key === "uom" ? "UoM" :
               key === "requested_quantity" ? "Quantity" :
               key === "gst_type" ? "GST Type" :
               key === "rate_per_unit" ? "Rate/Unit" :
               key === "amount_inr" ? "Amount (INR)" :
               key === "gst_amount" ? "GST Amount" :
               key === "status" ? "Status" :
               "Actions"}
            </Checkbox>
          </div>
        ))}
      </Modal>

      <Modal
        title={`Confirm Approval for ${
          actionTarget.mpn
            ? `Component ${actionTarget.mpn}`
            : actionTarget.isBatch
            ? `Selected Components in Request ${actionTarget.directSequence}`
            : `Request ${actionTarget.directSequence}`
        }`}
        open={isApproveConfirmModalOpen}
        onOk={confirmApproval}
        onCancel={() => {
          setIsApproveConfirmModalOpen(false);
          setActionTarget({ directSequence: null, mpn: null, isBatch: false });
        }}
        okText="Confirm Approval"
        okButtonProps={{ className: "bg-green-500 hover:bg-green-600" }}
      >
        <p>
          Are you sure you want to approve{" "}
          {actionTarget.mpn
            ? `component ${actionTarget.mpn}`
            : actionTarget.isBatch
            ? `the selected components in request ${actionTarget.directSequence}`
            : `request ${actionTarget.directSequence}`}
          ?
        </p>
        {actionTarget.isBatch && (
          <p className="text-yellow-600">
            Note: Unselected components will be automatically marked as Hold.
          </p>
        )}
      </Modal>

      <Modal
        title={`Rejection Note for ${
          actionTarget.mpn
            ? `Component ${actionTarget.mpn}`
            : `Selected Components in Request ${actionTarget.directSequence || ""}`
        }`}
        open={isRejectModalOpen}
        onOk={confirmRejection}
        onCancel={() => {
          setIsRejectModalOpen(false);
          setActionTarget({ directSequence: null, mpn: null, isBatch: false });
        }}
        okText="Proceed to Confirm"
        okButtonProps={{ className: "bg-red-500 hover:bg-red-600" }}
      >
        <Input.TextArea
          rows={4}
          value={rejectionNote}
          onChange={e => setRejectionNote(e.target.value)}
          placeholder="Reason for rejection..."
        />
      </Modal>

      <Modal
        title={`Confirm Rejection for ${
          actionTarget.mpn
            ? `Component ${actionTarget.mpn}`
            : actionTarget.isBatch
            ? `Selected Components in Request ${actionTarget.directSequence}`
            : `Request ${actionTarget.directSequence}`
        }`}
        open={isRejectConfirmModalOpen}
        onOk={confirmRejectionFinal}
        onCancel={() => {
          setIsRejectConfirmModalOpen(false);
          setActionTarget({ directSequence: null, mpn: null, isBatch: false });
        }}
        okText="Confirm Rejection"
        okButtonProps={{ className: "bg-red-500 hover:bg-red-600" }}
      >
        <p>
          Are you sure you want to reject{" "}
          {actionTarget.mpn
            ? `component ${actionTarget.mpn}`
            : actionTarget.isBatch
            ? `the selected components in request ${actionTarget.directSequence}`
            : `request ${actionTarget.directSequence}`}
          ?
        </p>
        <p>
          <strong>Reason:</strong> {rejectionNote}
        </p>
        {actionTarget.isBatch && (
          <p className="text-yellow-600">
            Note: Unselected components will be automatically marked as Hold.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default CeoDirectPoApproval;