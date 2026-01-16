import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaBell } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import io from 'socket.io-client';

const socket = io("http://localhost:5000", {
  withCredentials: true,
  auth: {
    token: localStorage.getItem("token"),
  },
});

const parseNotificationMessage = (message, type, status) => {
  const result = {
    umi: 'N/A',
    mrf_no: 'N/A',
    status: status || 'Unknown',
  };

  if (!message || typeof message !== 'string') return result;

  const mifMatch = message.match(/UMI(\w+)/);
  const mrfMatch = message.match(/MRF(\w+)/);
  const returnMatch = message.match(/UMI(\w+)/);

  if (type === 'mif' && mifMatch) {
    result.umi = mifMatch[1];
  } else if (type === 'mrf' && mrfMatch) {
    result.mrf_no = mrfMatch[1];
  } else if (type === 'return' && returnMatch) {
    result.umi = returnMatch[1];
  }

  return result;
};

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const userId = localStorage.getItem("user_id");
  const userRole = localStorage.getItem("role");

  useEffect(() => {
    console.log('NotificationBell: Initializing with userId:', userId, 'and userRole:', userRole);
    if (!userId) {
      console.log('NotificationBell: No userId found in localStorage, aborting setup');
      toast.error("User ID not found. Please log in again.");
      return;
    }

    console.log('NotificationBell: Registering user with Socket.IO for userId:', userId);
    socket.emit("register", userId);

    socket.on("notification", (notif) => {
      console.log('NotificationBell: Received new notification:', notif);
      if (!notif || !notif.id) {
        console.log('NotificationBell: Invalid notification received, skipping');
        return;
      }

      // Only process the notification if it's for the current user
      if (notif.user_id.toString() !== userId) {
        console.log('NotificationBell: Notification not for this user, skipping:', notif.user_id);
        return;
      }

      const parsedFields = parseNotificationMessage(notif.message, notif.type, notif.status);

      const newNotif = {
        id: notif.id,
        type: notif.type,
        message: notif.message || "New request received",
        status: parsedFields.status,
        created_at: notif.created_at || new Date().toISOString(),
        is_read: notif.is_read || false,
        ...parsedFields,
      };

      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) {
          console.log('NotificationBell: Duplicate notification id:', newNotif.id, 'skipping');
          return prev;
        }
        return [newNotif, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      });

      toast.info(newNotif.message, {
        position: 'top-right',
        autoClose: 10000,
        onClick: () => handleNotificationClick(newNotif),
      });

      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        new Notification('New Request - KAVACH', {
          body: newNotif.message,
          icon: '/path/to/icon.png',
        });
      }
    });

    const fetchNotifications = async () => {
      try {
        console.log('NotificationBell: Fetching initial notifications for userId:', userId, 'with role:', userRole);
        const response = await fetch("http://localhost:5000/api/notifications/pending", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
        }

        const data = await response.json();
        console.log('NotificationBell: Fetched notifications:', data);

        if (!Array.isArray(data)) {
          console.log('NotificationBell: Fetched data is not an array:', data);
          setNotifications([]);
          return;
        }

        const parsedNotifications = data.map((notif) => {
          const parsedFields = parseNotificationMessage(notif.message, notif.type, notif.status);
          return {
            id: notif.id,
            type: notif.type,
            message: notif.message,
            status: parsedFields.status,
            created_at: notif.created_at,
            is_read: notif.is_read,
            ...parsedFields,
          };
        });

        setNotifications(parsedNotifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } catch (error) {
        console.error("NotificationBell: Error fetching notifications:", error);
        toast.error("Failed to fetch notifications. Check server connection.");
        setNotifications([]);
      }
    };

    fetchNotifications();

    return () => {
      console.log('NotificationBell: Cleaning up Socket.IO listeners for userId:', userId);
      socket.off("notification");
    };
  }, [userId, userRole]);

  const handleBellClick = () => {
    console.log('NotificationBell: Bell clicked, current isOpen:', isOpen);
    setIsOpen((prev) => {
      const newState = !prev;
      console.log('NotificationBell: Setting isOpen to:', newState);
      return newState;
    });
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      console.log('NotificationBell: Marking notification as read, id:', notificationId);
      const url = `http://localhost:5000/api/notifications/${notificationId}/read`;
      console.log('NotificationBell: Constructed URL for markNotificationAsRead:', url);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`NotificationBell: Failed to mark notification as read - Status: ${response.status}, Message: ${errorText}`);
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
      }

      const updatedNotification = await response.json();
      console.log('NotificationBell: Notification marked as read:', updatedNotification);
      return updatedNotification;
    } catch (error) {
      console.error("NotificationBell: Error marking notification as read:", error);
      toast.error("Failed to mark notification as read.");
      throw error;
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      console.log('NotificationBell: Handling notification click:', notif);
      if (!notif.id) {
        console.log('NotificationBell: Invalid notification id, skipping');
        return;
      }

      console.log('NotificationBell: Notification ID for marking as read:', notif.id);
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );

      if (notif.type === 'mif' && notif.umi !== 'N/A') {
        navigate(`/mif-approval/${notif.umi}`);
      } else if (notif.type === 'mrf' && notif.mrf_no !== 'N/A') {
        navigate(`/mrf-approval/${notif.mrf_no}`);
      } else if (notif.type === 'return' && notif.umi !== 'N/A') {
        navigate(`/return-approval/${notif.umi}`);
      } else {
        console.log('NotificationBell: Cannot navigate, missing required fields:', notif);
        toast.warn("Unable to navigate to approval page. Missing required information.");
      }

      setIsOpen(false);
    } catch (error) {
      console.error("NotificationBell: Error handling notification click:", error);
      toast.error("Failed to process notification.");
    }
  };

  const handleCancelNotification = async (notif, e) => {
    e.stopPropagation();
    try {
      console.log('NotificationBell: Cancelling notification, id:', notif.id);
      await markNotificationAsRead(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      toast.success("Notification dismissed.");
    } catch (error) {
      console.error("NotificationBell: Error cancelling notification:", error);
      toast.error("Failed to dismiss notification.");
    }
  };

  const getBackgroundColor = (isRead) => {
    return isRead ? 'bg-gray-100' : 'bg-blue-100';
  };

  if (!userId) {
    console.log('NotificationBell: Not rendering due to missing userId');
    return null;
  }

  return (
    <div className="relative">
      <FaBell
        className="text-2xl cursor-pointer text-[#32328e] hover:text-[#3d3d82] transition-transform transform hover:scale-110"
        onClick={handleBellClick}
        title="Notifications"
      />
      {notifications.length > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
          {notifications.filter((n) => !n.is_read).length}
        </span>
      )}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border rounded shadow-lg z-50 max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-3 text-gray-700">
              <p>No pending notifications for your role ({userRole || 'unknown'}).</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 border-b ${getBackgroundColor(notif.is_read)} hover:bg-gray-200 cursor-pointer flex justify-between items-start`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div>
                  <p>
                    <strong className="text-blue-600">Type:</strong> {(notif.type || 'unknown').toUpperCase()}
                    {notif.umi !== 'N/A' && (
                      <span>
                        {' | '}
                        <strong className="text-blue-600">UMI:</strong> {notif.umi}
                      </span>
                    )}
                    {notif.mrf_no !== 'N/A' && (
                      <span>
                        {' | '}
                        <strong className="text-blue-600">MRF:</strong> {notif.mrf_no}
                      </span>
                    )}
                  </p>
                  <p>
                    <strong className="text-blue-600">Message:</strong> {notif.message || 'New request'}
                  </p>
                  {/* <p>
                    <strong className="text-blue-600">Status:</strong> {notif.status}
                  </p> */}
                  {/* <p className="text-sm text-gray-500">
                    <strong className="text-blue-600">Date:</strong>{' '}
                    {notif.created_at ? moment(notif.created_at).format("DD/MM/YYYY HH:mm:ss") : 'Unknown'}
                  </p> */}
                </div>
                <button
                  onClick={(e) => handleCancelNotification(notif, e)}
                  className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
                >
                  Dismiss
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;