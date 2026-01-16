import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../utils/api";
 import logo from '../assets/accelor-nobg.png'; // logo path

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // const getGreeting = () => {
  //   const hour = new Date().getHours();
  //   return hour < 12 ? "Good Morning!" : hour < 17 ? "Good Afternoon!" : "Good Evening!";
  // };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await loginUser(email, password);
      console.log("Login Response:", response);

      if (!response.success) {
        throw new Error(response.message || "Invalid credentials");
      }

      console.log("Stored Role in localStorage:", localStorage.getItem("role"));
      console.log("Stored Name in localStorage:", localStorage.getItem("name"));
      navigate("/home");
    } catch (err) {
      console.error("Login Error:", err);
      setError("Login failed. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="h-screen flex flex-col justify-center items-center bg-gradient-to-r from-blue-100 to-gray-200">
      <div className="flex flex-col items-center">
        <img src={logo} alt="Accelor Microsystems Logo" className="w-20h-20 mb-2" />
        {/* <h1 className="text-2xl font-bold mb-6 text-gray-800">ACCELOR MICROSYSTEMS</h1> */}
      </div>
      <div className="bg-white/70 backdrop-blur-sm p-6 rounded-lg shadow-md w-80 relative">
        <h2 className="text-xl font-bold mb-4 text-center">Login</h2>
        {/* <p className="text-center text-gray-600 mb-4">{getGreeting()} Ready to accelerate?</p> */}
        {error && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-md flex items-center">
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-2 text-white">&times;</button>
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700">Email</label>
            <input
              type="email"
              className="w-full p-2 border rounded transition duration-200 focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Password</label>
            <input
              type="password"
              className="w-full p-2 border rounded transition duration-200 focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-900 text-white py-2 rounded hover:bg-blue-700 transition disabled:bg-gray-400 flex items-center justify-center"
            disabled={loading}
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            )}
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;