import React, { useState, useEffect } from "react";
import axios from "axios";

const AdminLogs = () => {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/admin/logs", {
                    headers: { Authorization: `${localStorage.getItem("token")}` }
                });
                setLogs(response.data);
            } catch (error) {
                console.error("Error fetching logs:", error);
            }
        };

        fetchLogs();
    }, []);

    return (
        <div className="p-20">
            <h1 className="text-2xl font-bold mb-4">User Activity Logs</h1>
            <table className="table-auto w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">User ID</th>
                        <th className="border p-2">Module</th>
                        <th className="border p-2">Action</th>
                        <th className="border p-2">Query</th>
                        <th className="border p-2">Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => (
                        <tr key={log.id} className="border">
                            <td className="border p-2">{log.user_id}</td>
                            <td className="border p-2">{log.module_name}</td>
                            <td className="border p-2">{log.action}</td>
                            <td className="border p-2">{log.query || "N/A"}</td>
                            <td className="border p-2">{new Date(log.timestamp).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AdminLogs;
