import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import * as THREE from 'three';
import { Tooltip } from 'react-tooltip';
import { FaBell } from 'react-icons/fa';
import moment from 'moment';
import { fetchMyRequests, fetchMrfApprovalRequests, fetchApprovalRequests, fetchReturnRequests, fetchUserPermissions, fetchPendingNonCOCIssueRequests } from '../utils/api';

// Interactive Particle Background Component
const ParticleBackground = () => {
  const particles = React.useRef();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      particles.current = canvasContainer.appendChild(renderer.domElement);
    } else {
      console.error('Canvas container not found');
      return;
    }

    const particleCount = 200;
    const particlesArray = new Float32Array(particleCount * 3);
    const colorsArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlesArray[i * 3] = (Math.random() - 0.5) * 20;
      particlesArray[i * 3 + 1] = (Math.random() - 0.5) * 20;
      particlesArray[i * 3 + 2] = (Math.random() - 0.5) * 20;
      const hue = Math.random() < 0.5 ? 0xe5e7eb : 0x9ca3af;
      colorsArray[i * 3] = (hue >> 16 & 255) / 255;
      colorsArray[i * 3 + 1] = (hue >> 8 & 255) / 255;
      colorsArray[i * 3 + 2] = (hue & 255) / 255;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlesArray, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.08,
      transparent: true,
      opacity: 0.5,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    camera.position.z = 5;

    const handleMouseMove = (e) => {
      mouseX.set((e.clientX - window.innerWidth / 2) / 50);
      mouseY.set((e.clientY - window.innerHeight / 2) / 50);
    };
    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId;
    const animate = () => {
      particleSystem.rotation.y = mouseX.get() * 0.003;
      particleSystem.rotation.x = mouseY.get() * 0.003;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        particlesArray[i3 + 1] += (Math.sin(Date.now() * 0.00015 + i) - particlesArray[i3 + 1]) * 0.008;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      if (particles.current && particles.current.parentNode) {
        particles.current.parentNode.removeChild(particles.current);
      }
    };
  }, [mouseX, mouseY]);

  return <div id="canvas-container" className="absolute inset-0 opacity-20" />;
};

// Compact Notes Section
const NotesSection = () => {
  const [notes, setNotes] = useState(() => {
    try {
      const savedNotes = localStorage.getItem('notes');
      return savedNotes ? JSON.parse(savedNotes) : [];
    } catch (error) {
      console.error('Error accessing localStorage for notes:', error);
      return [];
    }
  });
  const [newNote, setNewNote] = useState('');
  const [noteColor, setNoteColor] = useState('#d1d5db');
  const [isPinned, setIsPinned] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('notes', JSON.stringify(notes));
    } catch (error) {
      console.error('Error saving notes to localStorage:', error);
    }
  }, [notes]);

  const addNote = () => {
    if (newNote.trim()) {
      const timestamp = new Date().toLocaleString();
      setNotes([...notes, { id: Date.now(), text: newNote, x: 10, y: notes.length * 40, color: noteColor, pinned: isPinned, timestamp }]);
      setNewNote('');
      setIsOpen(false);
    }
  };

  const updateNotePosition = (id, x, y) => {
    setNotes(notes.map(note => (note.id === id ? { ...note, x, y } : note)));
  };

  const deleteNote = (id) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      setNotes(notes.filter(note => note.id !== id));
    }
  };

  const togglePin = (id) => {
    setNotes(notes.map(note => (note.id === id ? { ...note, pinned: !note.pinned } : note)));
  };

  const moveNote = (fromIndex, toIndex) => {
    const updatedNotes = [...notes];
    const [movedNote] = updatedNotes.splice(fromIndex, 1);
    updatedNotes.splice(toIndex, 0, movedNote);
    setNotes(updatedNotes);
  };

  return (
    <motion.div
      className="fixed bottom-6 right-6 bg-gray-100 p-4 rounded-xl shadow-xl max-w-sm z-30 border border-gray-300"
      drag={!isPinned}
      dragMomentum={false}
      dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.5, duration: 0.6 }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-sans text-gray-800 font-semibold">Notes</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-600 hover:text-gray-800 text-sm"
        >
          {isOpen ? '✖' : '➕'}
        </button>
      </div>
      {isOpen && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={noteColor}
              onChange={(e) => setNoteColor(e.target.value)}
              className="w-6 h-6 rounded-full border border-gray-300"
            />
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm bg-white text-gray-800 placeholder-gray-500"
            />
          </div>
          <button
            onClick={addNote}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition text-sm"
          >
            Add Note
          </button>
          <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
            {notes.map((note, index) => (
              <motion.div
                key={note.id}
                className="relative bg-white p-2 rounded-lg shadow-sm cursor-move border border-gray-200 hover:shadow-md transition-all duration-300"
                style={{ backgroundColor: note.color, zIndex: note.pinned ? 10 : 1 }}
                drag={!note.pinned}
                dragMomentum={false}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                onDrag={(e, info) => updateNotePosition(note.id, note.x + info.offset.x, note.y + info.offset.y)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onDragEnd={() => {
                  const newIndex = Math.max(0, Math.min(Math.round((note.y + 20) / 40), notes.length - 1));
                  if (newIndex !== index) moveNote(index, newIndex);
                }}
              >
                <div className="flex flex-col">
                  <div className="flex justify-between items-start">
                    <p className="text-gray-800 text-xs font-medium leading-snug break-words">{note.text}</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePin(note.id)}
                        className="text-gray-600 hover:text-gray-800 text-xs"
                        data-tooltip-id={`pin-${note.id}`}
                        data-tooltip-content={note.pinned ? 'Unpin' : 'Pin'}
                      >
                        {note.pinned ? '📌' : '📍'}
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        data-tooltip-id={`delete-${note.id}`}
                        data-tooltip-content="Delete"
                      >
                        ✖
                      </button>
                    </div>
                  </div>
                  <small className="text-gray-500 text-xs mt-1">{note.timestamp}</small>
                </div>
                <Tooltip id={`pin-${note.id}`} />
                <Tooltip id={`delete-${note.id}`} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Dashboard Component for Pending Requests
const Dashboard = ({ role, userId, email }) => {
  const [mifPendingCount, setMifPendingCount] = useState(0);
  const [mrfPendingCount, setMrfPendingCount] = useState(0);
  const [returnPendingCount, setReturnPendingCount] = useState(0);
  const [userMifPendingCount, setUserMifPendingCount] = useState(0);
  const [overdueMifCount, setOverdueMifCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isHeadOrAdminOrCEO = role?.endsWith('_head') || role === 'admin' || role === 'ceo';
  const isInventory = role === 'inventory_head' || role === 'inventory_employee';
  const isPurchaseOrCEO = email === 'kkpurchase@gmail.com' || email === 'ceo@gmail.com';
  const isNonApprover = !isHeadOrAdminOrCEO && !isPurchaseOrCEO;

  useEffect(() => {
    const fetchPendingCounts = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("Dashboard - User role:", role, "User ID:", userId, "Email:", email);

        // Fetch MIF requests for all users to check for overdue requests
        try {
          const mifData = await fetchMyRequests();
          console.log("Raw MIF data:", mifData);
          const userMifFiltered = mifData.filter(req => {
            const matchesStatus = req?.status?.toLowerCase?.()?.includes('receiving pending');
            console.log(`MIF Request:`, req, `Matches Status: ${matchesStatus}`);
            return matchesStatus;
          });
          console.log("Filtered MIF requests for user:", userMifFiltered);
          setUserMifPendingCount(userMifFiltered.length);

          // Check for overdue requests (issued before today)
          const currentDate = moment().startOf('day'); // Start of today (00:00)
          const overdueMifs = userMifFiltered.filter(req => {
            if (!req.issue_date) {
              console.warn(`MIF UMI: ${req.umi} has no issue_date`);
              return false;
            }
            const issueDate = moment(req.issue_date).startOf('day');
            const daysDifference = currentDate.diff(issueDate, 'days');
            console.log(`MIF UMI: ${req.umi}, Issue Date: ${req.issue_date}, Days Since Issuance: ${daysDifference}`);
            return daysDifference >= 1; // Overdue if issued before today
          });
          console.log("Overdue MIF requests:", overdueMifs);
          setOverdueMifCount(overdueMifs.length);
        } catch (err) {
          console.error("Failed to fetch MIF requests:", err);
          setUserMifPendingCount(0);
          setOverdueMifCount(0);
        }

        if (isNonApprover) {
          setLoading(false);
          return;
        }

        if (!isPurchaseOrCEO) {
          // Fetch MIF pending requests for approvers
          try {
            let mifFiltered = [];
            if (isInventory) {
              const mifData = await fetchPendingNonCOCIssueRequests();
              console.log("Raw MIF data for inventory:", mifData);
              mifFiltered = mifData.filter(req => {
                const matchesStatus = req?.status?.toLowerCase?.()?.includes('inventory approval pending');
                console.log(`Inventory MIF Request:`, req, `Matches Status: ${matchesStatus}`);
                return matchesStatus;
              });
              console.log("Filtered MIF requests for inventory:", mifFiltered);
            } else if (isHeadOrAdminOrCEO) {
              const mifData = await fetchApprovalRequests();
              mifFiltered = mifData.filter(req => 
                String(req?.user_id) !== String(userId) && 
                req?.status?.toLowerCase?.()?.includes('head approval pending')
              );
            }
            setMifPendingCount(mifFiltered.length);
          } catch (err) {
            console.error("Failed to fetch MIF requests for approver:", err);
            setMifPendingCount(0);
          }

          // Fetch Return pending requests for approvers
          try {
            const returnData = await fetchReturnRequests('all');
            let returnFiltered = [];
            if (isHeadOrAdminOrCEO) {
              returnFiltered = returnData.filter(req => 
                req?.status?.toLowerCase?.()?.includes('return initiated') || 
                req?.status?.toLowerCase?.()?.includes('return request')
              );
            } else if (isInventory) {
              returnFiltered = returnData.filter(req => 
                req?.status?.toLowerCase?.()?.includes('return request approved by head') || 
                req?.status?.toLowerCase?.()?.includes('return request approved')
              );
            }
            setReturnPendingCount(returnFiltered.length);
          } catch (err) {
            console.error("Failed to fetch Return requests for approver:", err);
            setReturnPendingCount(0);
          }
        }

        // Fetch MRF pending requests for approvers
        try {
          const mrfData = await fetchMrfApprovalRequests();
          let mrfFiltered = [];
          if (isHeadOrAdminOrCEO || isPurchaseOrCEO) {
            mrfFiltered = mrfData.filter(req => 
              String(req?.user_id) !== String(userId) && 
              !req?.status?.toLowerCase?.()?.includes('issued')
            );
          }
          const uniqueMrf = Array.from(new Map(mrfFiltered.map(req => [req.mrf_no, req])).values());
          setMrfPendingCount(uniqueMrf.length);
        } catch (err) {
          console.error("Failed to fetch MRF requests for approver:", err);
          setMrfPendingCount(0);
        }
      } catch (err) {
        setError('Failed to fetch pending requests. Please check the console for details.');
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (role && userId && email) {
      fetchPendingCounts();
    } else {
      // Fallback: Fetch role and permissions from API if localStorage is unreliable
      const fetchUserData = async () => {
        try {
          const emailFromStorage = localStorage.getItem('email');
          if (emailFromStorage) {
            const { role: fetchedRole, user_id } = await fetchUserPermissions(emailFromStorage);
            setLoading(false);
            if (fetchedRole && user_id) {
              localStorage.setItem('role', fetchedRole);
              localStorage.setItem('user_id', user_id);
              window.location.reload();
            }
          }
        } catch (err) {
          console.error("Failed to fetch user permissions:", err);
          setError('Failed to fetch user role.');
          setLoading(false);
        }
      };
      fetchUserData();
    }
  }, [role, userId, email, isHeadOrAdminOrCEO, isInventory, isPurchaseOrCEO, isNonApprover]);

  if (isNonApprover) {
    return (
      <motion.div
        className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        {overdueMifCount > 0 && (
          <motion.div
            className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-r-lg flex items-center"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <FaBell className="h-6 w-6 mr-2" />
            <p className="text-sm">
              <strong>Warning:</strong> You have {overdueMifCount} Receiving Pending{overdueMifCount > 1 ? 's' : ''}, Kindly close your receivings.
            </p>
          </motion.div>
        )}
        <h3 className="text-xl font-sans text-gray-800 font-semibold mb-4">Receiving Pending Requests</h3>
        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && (
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-200 min-w-[120px] max-w-[150px] overflow-hidden">
              <p className="text-lg font-medium text-gray-700 truncate">Pending MIF Requests</p>
              <p className="text-3xl font-bold text-gray-900">{userMifPendingCount}</p>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  const hasPendingRequests = mifPendingCount > 0 || mrfPendingCount > 0 || returnPendingCount > 0;

  return (
    <motion.div
      className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.6 }}
    >
      {overdueMifCount > 0 && (
        <motion.div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-r-lg flex items-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <FaBell className="h-6 w-6 mr-2" />
          <p className="text-sm">
            <strong>Warning:</strong> You have {overdueMifCount} Receiving Pending{overdueMifCount > 1 ? 's' : ''}, Kindly close your receivings.
          </p>
        </motion.div>
      )}
      <h3 className="text-xl font-sans text-gray-800 font-semibold mb-4">Pending Requests</h3>
      {loading && <p className="text-gray-600">Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && !hasPendingRequests && isHeadOrAdminOrCEO && (
        <p className="text-gray-600 text-center">No pending requests</p>
      )}
      {!loading && !error && (
        <div className="flex flex-wrap gap-4 justify-center">
          {!isPurchaseOrCEO && (
            <>
              <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-200 min-w-[120px] max-w-[150px] overflow-hidden">
                <p className="text-lg font-medium text-gray-700 truncate">MIF Requests</p>
                <p className="text-3xl font-bold text-gray-900">{mifPendingCount}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-200 min-w-[120px] max-w-[150px] overflow-hidden">
                <p className="text-lg font-medium text-gray-700 truncate">Return Requests</p>
                <p className="text-3xl font-bold text-gray-900">{returnPendingCount}</p>
              </div>
            </>
          )}
          <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-200 min-w-[120px] max-w-[150px] overflow-hidden">
            <p className="text-lg font-medium text-gray-700 truncate">MRF Requests</p>
            <p className="text-3xl font-bold text-gray-900">{mrfPendingCount}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Main Home Component
const Home = () => {
  const [greeting, setGreeting] = useState('');
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-100, 100], [4, -4]);
  const rotateY = useTransform(mouseX, [-100, 100], [-4, 4]);

  useEffect(() => {
    // Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 16) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    // Fetch role, userId, and email from localStorage
    const storedRole = localStorage.getItem('role') || 'employee';
    const storedUserId = localStorage.getItem('user_id') || 'unknown';
    const storedEmail = localStorage.getItem('email') || '';
    console.log("Home - Initial localStorage values:", { role: storedRole, userId: storedUserId, email: storedEmail });
    setRole(storedRole);
    setUserId(storedUserId);
    setEmail(storedEmail);
  }, []);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const x = (clientX - window.innerWidth / 2) / 5;
    const y = (clientY - window.innerHeight / 2) / 5;
    mouseX.set(x);
    mouseY.set(y);
  };

  return (
    <div
      className="relative h-screen w-screen bg-gradient-to-br from-blue-300 via-green-100 to-blue-200 font-sans animate-gradient-x"
      onMouseMove={handleMouseMove}
    >
      <ParticleBackground />
      <NotesSection />
      <div className="flex flex-col items-center justify-center h-full text-center z-10">
        <motion.p
          className="text-lg md:text-2xl text-gray-700 max-w-lg mb-4 font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          {greeting}
        </motion.p>
        <motion.h1
          className="text-4xl md:text-6xl font-bold text-gray-800 mb-6 tracking-tight bg-clip-text bg-gradient-to-r from-gray-600 to-gray-800"
          style={{ rotateX, rotateY, textShadow: '0 0 10px rgba(0,0,0,0.2)', fontFamily: "'Inter', sans-serif" }}
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          whileHover={{ scale: 1.03, textShadow: '0 0 15px rgba(0,0,0,0.3)' }}
        >
          Welcome to KAVACH
        </motion.h1>
        <motion.p
          className="text-lg md:text-2xl text-gray-700 max-w-lg mb-8 font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          The Armour of Operations
        </motion.p>
        {(role && userId && email) && <Dashboard role={role} userId={userId} email={email} />}
      </div>
      <style>
        {`
          @keyframes gradient-x {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient-x {
            background-size: 200% 200%;
            animation: gradient-x 15s ease infinite;
          }
        `}
      </style>
    </div>
  );
};

export default Home;