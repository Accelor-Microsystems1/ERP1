import axios from 'axios';
import moment from 'moment';

const API_BASE_URL = "https://erp1-iwt1.onrender.com/api";

// Export setAuthHeader
export const setAuthHeader = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No auth token found!');
    return { headers: {} };
  }
  return { headers: { Authorization: `Bearer ${token}` } };
};

// In api.js
export const fetchComponentsForMRR = async (poNumber) => {
  try {
    const encodedPoNumber = encodeURIComponent(poNumber);
    const response = await axios.get(
      `${API_BASE_URL}/quality-inspection/mrr-components/${encodedPoNumber}`,
      setAuthHeader()
    );
    console.log("Fetched components raw response:", response.data);

    // Ensure the response is an array and contains mrr_no
    const components = Array.isArray(response.data.data) ? response.data.data : [];
    if (components.length > 0 && response.data.mrr_no) {
      components.forEach(comp => {
        comp.mrr_no = response.data.mrr_no; // Ensure mrr_no is set on each component
      });
    }

    console.log("Processed components with mrr_no:", components);
    return components;
  } catch (error) {
    console.error("Error fetching components for MRR:", error);
    throw new Error(`Failed to fetch components: ${error.response?.data?.error || error.message}`);
  }
};

// In api.js


export const uploadMRRDocuments = async (poNumber, components, cocFiles = [], idFiles = [], backorderSequence = null) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();

  formData.append('po_number', poNumber || '');
  if (backorderSequence !== null && backorderSequence !== undefined) {
    formData.append('backorder_sequence', backorderSequence);
  }

  const mpnValues = components.map(component => component.mpn || '').filter(Boolean).join(',');
  formData.append('mpn', mpnValues);

  cocFiles.forEach((file, index) => {
    formData.append(`coc[]`, file);
  });

  idFiles.forEach((file, index) => {
    formData.append(`idCard[]`, file);
  });

  console.log('FormData entries:');
  for (let [key, value] of formData.entries()) {
    console.log(`FormData: ${key} = ${value.name || value}`);
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/quality-inspection/mrr-upload-documents`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    console.log('Upload response:', response.data);
    return {
      message: response.data.message,
      mrr_no: response.data.mrr_no || 'N/A', // Ensure mrr_no is always returned
      data: response.data.data,
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || 'Failed to upload MRR documents';
    console.error('Upload error:', {
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error(errorMessage);
  }
};

//   console.log("Preparing FormData with:", { po_number, part_no, cocFile: cocFile?.name, idCardFile: idCardFile?.name });

//   const formData = new FormData();
//   formData.append('po_number', po_number);
//   formData.append('part_no', part_no);
//   if (cocFile) formData.append('coc', cocFile);
//   if (idCardFile) formData.append('idCard', idCardFile);

//   const formDataEntries = {};
//   for (let [key, value] of formData.entries()) {
//     formDataEntries[key] = value instanceof File ? value.name : value;
//   }
//   console.log("FormData entries being sent:", formDataEntries);

//   try {
//     const response = await axios.post(
//       `${API_BASE_URL}/quality-inspection/mrr-upload-documents`,
//       formData,
//       {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token')}`,
//           'Content-Type': 'multipart/form-data',
//         },
//       }
//     );
//     console.log("Upload response:", response.data);
//     return response.data;
//   } catch (error) {
//     console.error("Upload error:", error.response?.data || error.message);
//     throw error;
//   }
// };

//   console.log("Preparing FormData with:", { cocFile, idCardFile });

//   const formData = new FormData();
//   //formData.append('po_number', po_number);
//   //formData.append('part_no', part_no);
//   // if (cocFile) formData.append('coc', cocFile);
//   // if (idCardFile) formData.append('idCard', idCardFile);

//   // const formDataEntries = {};
//   // for (let [key, value] of formData.entries()) {
//   //   formDataEntries[key] = value instanceof File ? value.name : value;
//   // }
//   // console.log("FormData entries:", formDataEntries);

//   return await axios.post(`${API_BASE_URL}/quality-inspection/mrr-upload-documents`, formData, {
//     headers: {
//       Authorization: `Bearer ${localStorage.getItem('token')}`,
//     },
//   });
// };
// New API: Fetch purchase orders
// Fetch purchase orders with location, mrr_no, and component_id
// In api.js
// Fetch purchase orders with updated fields
export const fetchPurchaseOrders = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/purchase-orders`, setAuthHeader());
    console.log("Fetched purchase orders:", response.data);

    const purchaseOrders = Array.isArray(response.data) ? response.data : [];

    const formattedData = purchaseOrders.map(item => ({
      po_id: item.po_id || null,
      mrf_no: item.mrf_no || 'N/A',
      po_number: item.po_number || 'N/A',
      mpn: item.mpn || 'N/A',
      mrr_no: item.mrr_no || 'N/A',
      uom: item.uom || 'N/A',
      mpn_received: item.mpn_received || 'N/A',
      make_received: item.make_received || 'N/A',
      date_code: item.date_code || 'N/A',
      lot_code: item.lot_code || 'N/A',
      received_quantity: item.received_quantity || 0,
      passed_quantity: item.passed_quantity || 0,
      coc_received: item.coc_received || false,
      note: item.note || 'N/A',
      failed_quantity: item.failed_quantity || '0',
      material_in_quantity: item.material_in_quantity || 0,
      item_description: item.item_description || 'N/A',
      part_no: item.part_no || 'N/A',
      make: item.make || 'N/A',
      on_hand_quantity: item.on_hand_quantity || 0,
      location: item.location || 'N/A',
      updated_requested_quantity: item.updated_requested_quantity || 0,
      status: item.status || 'Unknown',
      vendor_name: item.vendor_name || 'N/A',
      expected_delivery_date: item.expected_delivery_date || 'N/A',
      component_id: item.component_id || null,
      backorder_sequences: Array.isArray(item.backorder_sequences) 
        ? item.backorder_sequences.map(bo => ({
          backorder_sequence: bo.backorder_sequence || 'N/A',
          reordered_quantity: bo.reordered_quantity || 0,
          received_quantity: bo.received_quantity || 0,
          material_in_quantity: bo.material_in_quantity || 0,
          status: bo.status || 'Unknown',
          created_at: bo.created_at || 'N/A' // Add created_at mapping
        }))
        : [],
      return_sequence: item.return_sequence || null,
      return_reordered_quantity: item.return_reordered_quantity || 0,
      created_at: item.created_at || 'N/A',
    }));

    console.log("Formatted purchase orders:", formattedData);
    return formattedData;
  } catch (error) {
    console.error("Error fetching purchase orders:", error.response?.data || error.message);
    throw new Error(`Failed to fetch purchase orders: ${error.response?.data?.error || error.message}`);
  }
};

// Fetch purchase order details for a specific component
export const fetchPurchaseOrderDetails = async (componentId) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/non_coc_components/nc-requests/purchase-orders/${componentId}`,
      setAuthHeader()
    );
    console.log("Fetched purchase order details:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching purchase order details:", error.response?.data || error.message);
    throw new Error(`Failed to fetch purchase order details: ${error.response?.data?.error || error.message}`);
  }
};

// Update material in quantity
export const updateMaterialIn = async ({ po_number, mpn, material_in_quantity }) => {
  try {
    // Input validation
    if (!po_number || typeof po_number !== 'string' || po_number.trim() === '') {
      throw new Error('Invalid or missing po_number');
    }
    if (!mpn || typeof mpn !== 'string' || mpn.trim() === '') {
      throw new Error('Invalid or missing mpn');
    }
    if (material_in_quantity == null || isNaN(material_in_quantity) || material_in_quantity < 0) {
      throw new Error('Invalid material_in_quantity: must be a non-negative number');
    }

    // Trim inputs to avoid issues with whitespace
    const trimmedPoNumber = po_number.trim();
    const trimmedMpn = mpn.trim();

    // Fetch the po_id using po_number and mpn
    const poResponse = await axios.get(`${API_BASE_URL}/purchase-orders`, setAuthHeader());
    const purchaseOrder = poResponse.data.find(
      (po) => po.po_number === trimmedPoNumber && po.mpn === trimmedMpn
    );

    if (!purchaseOrder) {
      throw new Error(`Purchase order not found for po_number: ${trimmedPoNumber} and mpn: ${trimmedMpn}`);
    }

    const po_id = purchaseOrder.po_id;

    const response = await axios.put(
      `${API_BASE_URL}/purchase-orders/${po_id}/material-in`,
      { 
        material_in_quantity,
        mrf_no: purchaseOrder.mrf_no || null // Pass mrf_no if available, null otherwise
      },
      setAuthHeader()
    );
    console.log("Material in updated:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updating material in:", error.response?.data || error.message);
    throw new Error(`Failed to update material in: ${error.response?.data?.error || error.message}`);
  }
};

// POST: User Login
export const loginUser = async (email, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
    const { token, user_id, role, permissions, name } = response.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user_id", user_id);
    localStorage.setItem("role", role);
    localStorage.setItem("permissions", JSON.stringify(permissions));
    localStorage.setItem("email", email);
    localStorage.setItem("name", name);
    return response.data;
  } catch (error) {
    console.error("Login error:", error.response?.data || error.message);
    return { success: false, message: "Login failed" };
  }
};

// GET: Fetch Vendor by GSTIN
export const fetchVendorByGSTIN = async (gstin) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/vendors/gstin/${gstin}`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching vendor by GSTIN:", error.response?.data || error.message);
    throw error;
  }
};

// NEW: Add API utility to fetch vendors
export const fetchVendors = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/vendors`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching vendors:", error);
    throw error;
  }
};

// POST: Create a Vendor
export const createVendor = async (vendorData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/vendors/vendors`, vendorData, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error creating vendor:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchAllVendors = async () => {
  try {
    console.log("API Request to:", `${API_BASE_URL}/vendors/vendors`); // Debug endpoint
    const response = await axios.get(`${API_BASE_URL}/vendors/vendors`, setAuthHeader());
    console.log("API Response:", response); // Log full response
    if (!response.data) {
      console.warn("No data in API response:", response);
      return { data: [] }; // Return empty array if data is missing
    }
    return response.data;
  } catch (error) {
    console.error("API Error fetching vendors:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config?.url,
    });
    throw error; // Re-throw to be caught by useEffect
  }
};

// PUT: Update a Vendor
export const updateVendor = async (id, vendorData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/vendors/vendors/${id}`, vendorData, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error updating vendor:", error.response?.data || error.message);
    throw error;
  }
};

// Start: Add getPaymentTerms
export const getPaymentTerms = async () => {
  try {
    console.log("Fetching payment terms");
    const response = await axios.get(`${API_BASE_URL}/purchase-orders/payment-terms`, setAuthHeader());
    console.log("Fetched payment terms:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching payment terms:", error.response?.data || error.message);
    throw new Error(`Failed to fetch payment terms: ${error.response?.data?.error || error.message}`);
  }
};
// End: Add getPaymentTerms

// Start: Add createPaymentTerm
export const createPaymentTerm = async (termData) => {
  try {
    console.log("Creating payment term with payload:", termData);
    const response = await axios.post(
      `${API_BASE_URL}/purchase-orders/create-payment-terms`,
      termData,
      setAuthHeader()
    );
    console.log("Payment term created:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error creating payment term:", error.response?.data || error.message);
    throw new Error(`Failed to create payment term: ${error.response?.data?.error || error.message}`);
  }
};
// End: Add createPaymentTerm

// Start: Add getOtherTermsConditions
export const getOtherTermsConditions = async () => {
  try {
    console.log("Fetching other terms & conditions");
    const response = await axios.get(`${API_BASE_URL}/purchase-orders/other-terms-conditions`, setAuthHeader());
    console.log("Fetched other terms & conditions:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching other terms & conditions:", error.response?.data || error.message);
    throw new Error(`Failed to fetch other terms & conditions: ${error.response?.data?.error || error.message}`);
  }
};
// End: Add getOtherTermsConditions

// Start: Add createOtherTermCondition
export const createOtherTermCondition = async (termData) => {
  try {
    console.log("Creating other term/condition with payload:", termData);
    const response = await axios.post(
      `${API_BASE_URL}/purchase-orders/create-other-terms-conditions`,
      termData,
      setAuthHeader()
    );
    console.log("Other term/condition created:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error creating other term/condition:", error.response?.data || error.message);
    throw new Error(`Failed to create other term/condition: ${error.response?.data?.error || error.message}`);
  }
};
// End: Add createOtherTermCondition

export const updateVendorDetails = async (mrf_id, component_id, vendorDetails) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/vendors/update`,
      {
        mrf_id,
        component_id,
        vendor: vendorDetails.vendor,
        vendor_link: vendorDetails.vendor_link,
        approx_price: vendorDetails.approx_price,
        expected_deliverydate: vendorDetails.expected_deliverydate,
        certificate_desired: vendorDetails.certificate_desired,
      },
      setAuthHeader()
    );
    console.log("Vendor details updated:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updating vendor details:", error.response?.data || error.message);
    throw new Error(`Failed to update vendor details: ${error.response?.data?.error || error.message}`);
  }
};

// Fetch rejected MRF requests
export const fetchRejectedMrfRequests = async (params = {}) => {
  const { date } = params;
  try {
    const response = await axios.get(
      `${API_BASE_URL}/mrf-approvals/rejected${date ? `?date=${date}` : ''}`,
      setAuthHeader()
    );
    console.log("Fetched rejected MRF requests:", response.data);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message;
    console.error("Error fetching rejected MRF requests:", {
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error(`Failed to fetch rejected MRF requests: ${errorMessage}`);
  }
};

export const fetchPreviousVendors = async (params = {}) => {
  const { componentId, limit = 5, offset = 0 } = params;
  try {
    const response = await axios.get(
      `${API_BASE_URL}/mrf-approvals/previous-vendors?componentId=${encodeURIComponent(componentId)}&limit=${limit}&offset=${offset}`,
      setAuthHeader()
    );
    console.log("Fetched previous vendors:", response.data);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message;
    console.error("Error fetching previous vendors:", {
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error(`Failed to fetch previous vendors: ${errorMessage}`);
  }
};

// POST: Raise Purchase Order
export const raisePurchaseOrder = async (purchaseOrderData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/purchase-orders/raise`,
      purchaseOrderData,
      setAuthHeader()
    );
    console.log("Purchase order raised:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error raising purchase order:", error.response?.data || error.message);
    throw new Error(`Failed to raise purchase order: ${error.response?.data?.error || error.message}`);
  }
};

export const raiseDirectPurchaseOrder = async (purchaseOrderData) => {
  try {
    const { items, vendor, quotation_no, totalpo_cost, expected_delivery_date, paymentTerms, otherTerms, direct_sequence, mrf_no, po_number } = purchaseOrderData;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }
    if (!vendor || !vendor.name || typeof vendor.name !== 'string' || vendor.name.trim() === '') {
      throw new Error('Vendor name is required and must be a non-empty string');
    }
    if (isNaN(totalpo_cost) || totalpo_cost <= 0) {
      throw new Error('Total PO cost must be a positive number');
    }
    if (!expected_delivery_date) {
      throw new Error('Expected delivery date is required');
    }
    const deliveryDate = moment(expected_delivery_date, 'YYYY-MM-DD', true);
    if (!deliveryDate.isValid()) {
      throw new Error('Invalid expected delivery date format. Use YYYY-MM-DD');
    }
    if (deliveryDate.isBefore(moment().startOf('day'))) {
      throw new Error('Expected delivery date cannot be in the past');
    }
    if (!paymentTerms || typeof paymentTerms !== 'string' || paymentTerms.trim() === '') {
      throw new Error('Payment terms must be a non-empty string');
    }
    if (!otherTerms || typeof otherTerms !== 'string' || otherTerms.trim() === '') {
      throw new Error('Other terms and conditions must be a non-empty string');
    }
    if (!direct_sequence || typeof direct_sequence !== 'string' || direct_sequence.trim() === '') {
      throw new Error('Direct sequence is required and must be a non-empty string');
    }

    for (const item of items) {
      const { requested_quantity, uom, ratePerUnit, amount, gstAmount, mpn, item_description, make, part_no } = item;

      const parsedQuantity = parseInt(requested_quantity, 10);
      if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        throw new Error(`Invalid requested_quantity for MPN ${mpn || 'unknown'}: must be a positive integer`);
      }
      if (!uom || typeof uom !== 'string' || uom.trim() === '') {
        throw new Error(`Invalid uom for MPN ${mpn || 'unknown'}: must be a non-empty string`);
      }
      if (isNaN(ratePerUnit) || ratePerUnit < 0) {
        throw new Error(`Invalid ratePerUnit for MPN ${mpn || 'unknown'}: must be a non-negative number`);
      }
      if (isNaN(amount) || amount < 0) {
        throw new Error(`Invalid amount for MPN ${mpn || 'unknown'}: must be a non-negative number`);
      }
      if (isNaN(gstAmount) || gstAmount < 0) {
        throw new Error(`Invalid gstAmount for MPN ${mpn || 'unknown'}: must be a non-negative number`);
      }
      if (!mpn || typeof mpn !== 'string' || mpn.trim() === '') {
        throw new Error(`MPN for item is required and must be a non-empty string`);
      }
    }

    const sanitizedPayload = {
      items: items.map(item => ({
        updated_requested_quantity: parseInt(item.requested_quantity, 10),
        uom: item.uom.trim(),
        ratePerUnit: parseFloat(item.ratePerUnit),
        amount: parseFloat(item.amount),
        gstAmount: parseFloat(item.gstAmount),
        mpn: item.mpn.trim(),
        item_description: item.item_description ? item.item_description.trim() : null,
        make: item.make ? item.make.trim() : null,
        part_no: item.part_no ? item.part_no.trim() : null,
      })),
      vendor: {
        name: vendor.name.trim(),
        address: vendor.address ? vendor.address.trim() : null,
        gstin: vendor.gstin ? vendor.gstin.trim() : null,
        pan: vendor.pan ? vendor.pan.trim() : null,
      },
      quotation_no: quotation_no ? quotation_no.trim() : null,
      totalpo_cost: parseFloat(totalpo_cost),
      expected_delivery_date: deliveryDate.format('YYYY-MM-DD'),
      paymentTerms: paymentTerms.trim(),
      otherTerms: otherTerms.trim(),
      mrf_no: mrf_no.trim(),
      direct_sequence: direct_sequence.trim(),
    };

    console.log('Sending payload for direct PO:', sanitizedPayload);

    const response = await axios.post(
      `${API_BASE_URL}/purchase-orders/raise-direct`,
      sanitizedPayload,
      setAuthHeader()
    );
    console.log("Direct purchase order raised:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error raising direct purchase order:", error.response?.data || error.message);
    throw new Error(`Failed to raise direct purchase order: ${error.response?.data?.error || error.message}`);
  }
};
// GET: Search MRF Components
export const searchMrfComponents = async (filters = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mrf-approvals/search-components`, {
      params: filters,
      ...setAuthHeader(),
    });
    console.log("Fetched MRF components:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching MRF components:", error.response?.data || error.message);
    throw new Error(`Failed to fetch MRF components: ${error.response?.data?.error || error.message}`);
  }
};

// GET: Search MRF Components for Purchase Head
export const searchMrfComponentsForPurchaseHead = async (filters = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mrf-approvals/search-components-purchase-head`, {
      params: filters,
      ...setAuthHeader(),
    });
    console.log("Fetched MRF components for Purchase Head:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching MRF components for Purchase Head:", error.response?.data || error.message);
    throw new Error(`Failed to fetch MRF components for Purchase Head: ${error.response?.data?.error || error.message}`);
  }
};

//new api
// GET: Search MRF Components for Purchase Head
export const searchMrfComponentsForPORaised = async (filters = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mrf-approvals/search-components-po-raised`, {
      params: filters,
      ...setAuthHeader(),
    });
    console.log("Fetched MRF components for Purchase Head:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching MRF components for Purchase Head:", error.response?.data || error.message);
    throw new Error(`Failed to fetch MRF components for Purchase Head: ${error.response?.data?.error || error.message}`);
  }
};

export const fetchUserDetails = async (userId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/${userId}`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching user details:", error.response?.data || error.message);
    throw error;
  }
};

// GET: Fetch User Permissions
export const fetchUserPermissions = async (email) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/user-permissions/${email}`, setAuthHeader());
    console.log("Fetched user permissions:", response.data);
    return response.data;
  } catch (error) {
    console.error("Permission fetch error:", error.response?.data || error.message);
    return { role: null, permissions: {} };
  }
};

// FETCH NON-COC DATA
export const fetchNonCOCData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/noncoc`, setAuthHeader());
    console.log("Raw NON-COC API response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching NON-COC data:", error.response?.data || error.message);
    throw error;
  }
};

// IMPORT NON-COC DATA
export const importNonCOCData = async (data) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/noncoc/import`, { data }, setAuthHeader());
    console.log("Import response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error importing NON-COC data:", error.response?.data || error.message);
    throw error;
  }
}; 

export const submitReturnForm = async (items) => {
  const response = await fetch(`${API_BASE_URL}/returns/submit-return-form`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    throw new Error("Failed to submit return form");
  }

  return response.json(); // Returns { message, urfNo, status }
};

// Fetch Return Requests
export const fetchReturnRequests = async (type = "pending") => {
  try {
    let endpoint = `${API_BASE_URL}/returns/return-requests`;
    if (type === "past") {
      endpoint = `${API_BASE_URL}/returns/past-return-requests`;
    } else if (type === "all") {
      // Fetch both pending and past requests for inventory users
      const [pendingResponse, pastResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/returns/return-requests`, setAuthHeader()),
        axios.get(`${API_BASE_URL}/returns/past-return-requests`, setAuthHeader()),
      ]);
      const combinedData = [...pendingResponse.data, ...pastResponse.data];
      console.log(`Combined return requests for type 'all':`, combinedData);
      // Log the structure of each request
      combinedData.forEach((req, index) => {
        console.log(`Return Request ${index} (type 'all'):`, {
          user_id: req.user_id,
          status: req.status,
          fullRequest: req,
        });
      });
      return combinedData.map(req => ({
        ...req,
        status: req.status || "Unknown", // Fallback for missing status
      }));
    }
    const response = await axios.get(endpoint, setAuthHeader());
    console.log(`Fetched ${type} return requests:`, response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`Return Request ${index} (type '${type}'):`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data.map(req => ({
      ...req,
      status: req.status || "Unknown", // Fallback for missing status
    }));
  } catch (error) {
    console.error(`Error fetching ${type} return requests:`, error.response?.data || error.message);
    throw error;
  }
};

// Fetch User's Own Return Requests
export const fetchUserReturnRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/returns/user-return-requests`, setAuthHeader());
    console.log("Fetched user's return requests:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`User Return Request ${index}:`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data.map(req => ({
      ...req,
      status: req.status || "Unknown", // Fallback for missing status
      user_id: req.user_id || "unknown", // Fallback for missing user_id
    }));
  } catch (error) {
    console.error("Error fetching user's return requests:", error.response?.data || error.message);
    throw error;
  }
};

// Approve Return Request
export const approveReturnRequest = async (urf_id, { note }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/returns/approve-return/${urf_id}`,
      { note },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error approving return request:", error.response?.data || error.message);
    throw error;
  }
};

// Reject Return Request
export const rejectReturnRequest = async (urf_id, { note }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/returns/reject-return/${urf_id}`,
      { note },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error rejecting return request:", error.response?.data || error.message);
    throw error;
  }
};

// Update Non-COC Location
export const updateNonCOCLocation = async (component_id, location) => {
  try {
    // Validate inputs
    if (!component_id || isNaN(parseInt(component_id))) {
      throw new Error("Invalid component_id: Component ID must be a valid integer");
    }
    if (!location || typeof location !== 'string' || location.trim() === '') {
      throw new Error("Invalid location: Location must be a non-empty string");
    }

    console.log("Sending update request:", { component_id, location });
    const response = await axios.put(
      `${API_BASE_URL}/locations/noncoc/${component_id}`,
      { location: location.trim().toUpperCase() }, // Ensure location is trimmed and uppercase
      setAuthHeader()
    );
    console.log("Update location response:", response.data);

    // Fetch updated data to ensure frontend reflects the latest state
    const updatedData = await fetchNonCOCData();
    return { ...response.data, updatedData };
  } catch (error) {
    console.error("Error updating location:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw new Error(`Failed to update location: ${error.response?.data?.message || error.message}`);
  }
};


// FETCH USER LOGS
export const fetchUserLogs = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/logs`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching User Logs:", error.response?.data || error.message);
    throw error;
  }
};

// FETCH USERS ISSUE MATERIAL REQUESTS
export const fetchNonCOCRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/ncRequests`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching Non-COC Requests:", error.response?.data || error.message);
    throw error;
  }
};

// POST: Add to Basket
export const addToBasket = async (item) => {
  const token = localStorage.getItem("token");
  const response = await axios.post(
    "http://localhost:5000/api/non_coc_components/add-to-basket",
    { component_id: item.component_id },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

// GET: stock card
export const fetchStockCardData = async (componentId, periodFrom, periodTo) => {
  const token = localStorage.getItem("token");
  try {
    const params = { componentId };
    if (periodFrom) params.periodFrom = periodFrom;
    if (periodTo) params.periodTo = periodTo;

    const response = await axios.get(
      `http://localhost:5000/api/non_coc_components/nc-requests/stock-card/${componentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching stock card data:", error);
    throw error;
  }
};

export const fetchBasketItemsForUMIF = async () => {
  try {
    console.log(`Fetching basket items from: ${API_BASE_URL}/noncoc_umif/basket-items`);
    const response = await axios.get(`${API_BASE_URL}/noncoc_umif/basket-items`, setAuthHeader());
    if (response.data && !Array.isArray(response.data)) {
      console.warn("Unexpected response format:", response.data);
      return [];
    }
    console.log("Fetched basket items:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching basket items for UMIF:", {
      message: error.message,
      code: error.code,
      response: error.response?.data || error.response,
      stack: error.stack,
    });
    throw new Error(`Failed to fetch basket items: ${error.message}`);
  }
};

// Update UMIF quantity
export const updateBasketQuantities = async (basket_id, requested_quantity) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/noncoc_umif/update-quantities`,
      { basket_id, requested_quantity },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error updating basket quantities:", error.response?.data || error.message);
    throw error;
  }
};

// // GET: Fetch All Purchase Orders
// export const fetchAllPurchaseOrders = async () => {
//   try {
//     const response = await axios.get(`${API_BASE_URL}/purchase-orders//purchase-orders/`, setAuthHeader());
//     console.log("Fetched all purchase orders:", response.data);
//     return response.data;
//   } catch (error) {
//     console.error("Error fetching all purchase orders:", error.response?.data || error.message);
//     throw new Error(`Failed to fetch purchase orders: ${error.response?.data?.error || error.message}`);
//   }
// };

export const fetchAllPurchaseOrders = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/purchase-orders//purchase-orders/`, setAuthHeader());
    console.log("Fetched all purchase orders:", response.data);

    // Handle different response structures
    let purchaseOrders;
    if (Array.isArray(response.data)) {
      // If response.data is an array (unexpected but handle it)
      purchaseOrders = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      // Expected structure: { message: '...', data: [...] }
      purchaseOrders = response.data.data;
    } else {
      throw new Error("Unexpected response structure: data is not an array");
    }

    // Check for duplicate po_number entries
    const poNumbers = purchaseOrders.map(item => item.po_number);
    const uniquePoNumbers = new Set(poNumbers);
    if (poNumbers.length !== uniquePoNumbers.size) {
      console.warn("Duplicate PO numbers detected:", poNumbers.filter((item, index) => poNumbers.indexOf(item) !== index));
    }

    // Log project_name and direct_sequence for debugging
    purchaseOrders.forEach(item => {
      console.log(`PO ${item.po_number}: mrf_no=${item.mrf_no}, direct_sequence=${item.direct_sequence || 'N/A'}, project_name=${item.project_name}`);
    });

    return { data: purchaseOrders }; // Normalize the return value to match frontend expectation
  } catch (error) {
    console.error("Error fetching all purchase orders:", error.response?.data || error.message);
    throw new Error(`Failed to fetch purchase orders: ${error.response?.data?.error || error.message}`);
  }
};

//get only returned and backorder (po backorder receipts)
export const fetchBackorderedReturnedPOs = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/purchase-orders/backordered-returned`, setAuthHeader());
    console.log("Raw API response:", response);
    console.log("Fetched backordered/returned purchase orders:", response.data);

    const purchaseOrders = Array.isArray(response.data.data) ? response.data.data : [];

    const validStatuses = [
      'Returned',
      'Warehouse In, Backordered (%)',
      'Warehouse In, Backordered (%) Returned (%)'
    ];

    const formattedData = purchaseOrders.map(item => {
      if (!validStatuses.some(status => item.po_status === status || item.po_status.match(status.replace('(%)', '\\(\\d+\\)')))) {
        console.warn(`Unexpected status for PO ${item.po_number}: ${item.po_status}. Expected one of ${validStatuses.join(', ')}`);
      }

      return {
        po_id: item.po_id || null,
        mrf_no: item.mrf_no || 'N/A',
        po_number: item.po_number || 'N/A',
        mpn: item.mpn || 'N/A',
        uom: item.uom || 'N/A',
        item_description: item.item_description || 'N/A',
        part_no: item.part_no || 'N/A',
        make: item.make || 'N/A',
        on_hand_quantity: item.on_hand_quantity || 0,
        updated_requested_quantity: item.updated_requested_quantity || 0,
        initial_requested_quantity: item.initial_requested_quantity || 0,
        rate_per_unit: item.rate_per_unit || 0,
        gst_amount: item.gst_amount || 0,
        amount: item.amount || 0,
        po_status: item.po_status || 'Unknown',
        vendor_name: item.vendor_name || 'N/A',
        expected_delivery_date: item.expected_delivery_date || 'N/A',
        component_id: item.component_id || null,
        project_name: item.project_name || 'N/A',
        po_created_at: item.po_created_at || 'N/A',
        backorder_sequence: item.backorder_sequence || null,
        pending_quantity: item.pending_quantity || 0,
        return_sequence: item.return_sequence || null,
        return_reordered_quantity: item.return_reordered_quantity || 0,
        received_quantity: item.received_quantity || 0,
      };
    });

    console.log("Formatted backordered/returned purchase orders:", formattedData);
    return formattedData;
  } catch (error) {
    console.error("Error fetching backordered/returned purchase orders:", error.response?.data || error.message);
    throw new Error(`Failed to fetch backordered/returned purchase orders: ${error.response?.data?.error || error.message}`);
  }
};

// Update a purchase order
export const updatePurchaseOrder = async (po_number, component_id, expected_delivery_date, updated_requested_quantity) => {
  // Client-side validation
  if (!po_number || !component_id || !expected_delivery_date || updated_requested_quantity === undefined) {
    throw new Error('Missing required fields: po_number, component_id, expected_delivery_date, and updated_requested_quantity are required');
  }

  const today = new Date('2025-06-07'); // Current date as per prompt
  const deliveryDate = new Date(expected_delivery_date);
  if (isNaN(deliveryDate.getTime()) || deliveryDate < today) {
    throw new Error('Expected delivery date must be a valid date and cannot be in the past');
  }

  if (isNaN(updated_requested_quantity) || updated_requested_quantity <= 0) {
    throw new Error('Updated requested quantity must be a positive number');
  }

  try {
    const response = await axios.put(
      `${API_BASE_URL}/purchase-orders/update`,
      {
        po_number,
        component_id,
        expected_delivery_date,
        updated_requested_quantity,
      },
      {
        ...setAuthHeader(),
        timeout: 10000, // 10-second timeout
      }
    );
    console.log('Updated purchase order:', response.data);
    return response.data;
  } catch (error) {
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      'Unknown error occurred while updating purchase order';
    console.error('Error updating purchase order:', errorMessage);
    throw new Error(`Failed to update purchase order: ${errorMessage}`);
  }
};

export const updateBackorderItem = async (po_number, component_id, expected_delivery_date) => {
  // Client-side validation
  if (!po_number || !component_id || !expected_delivery_date) {
    throw new Error('Missing required fields: po_number, component_id, and expected_delivery_date are required');
  }

  const today = new Date('2025-06-07'); // Current date as per prompt
  const deliveryDate = new Date(expected_delivery_date);
  if (isNaN(deliveryDate.getTime()) || deliveryDate < today) {
    throw new Error('Expected delivery date must be a valid date and cannot be in the past');
  }

  try {
    const response = await axios.put(
      `${API_BASE_URL}/purchase-orders/backorder-items/update`,
      {
        po_number,
        component_id,
        expected_delivery_date,
      },
      {
        ...setAuthHeader(),
        timeout: 10000, // 10-second timeout
      }
    );
    console.log('Updated backorder item:', response.data);
    return response.data;
  } catch (error) {
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      'Unknown error occurred while updating backorder item';
    console.error('Error updating backorder item:', errorMessage);
    throw new Error(`Failed to update backorder item: ${errorMessage}`);
  }
};
export const submitMaterialIssueForm = async ({ items }) => {
  try {
    // Validate items array before sending
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("No valid items provided for submission");
    }
    items.forEach(item => {
      if (!item.basket_id || !Number.isInteger(item.requested_quantity) || item.requested_quantity < 0) {
        throw new Error(`Invalid item data: ${JSON.stringify(item)}`);
      }
    });

    console.log("Submitting material issue form with payload:", { items });
    const response = await axios.post(
      `${API_BASE_URL}/noncoc_umif/submit-material-issue`,
      { items },
      setAuthHeader()
    );
    console.log("Material issue form submission response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error submitting material issue form:", {
      message: error.message,
      response: error.response?.data || error.response,
      status: error.response?.status,
    });
    throw new Error(`Failed to submit material issue form: ${error.response?.data?.error || error.message}`);
  }
};

export const submitMaterialRequestForm = async ({ items, basket_ids }) => {
  try {
    // Validate inputs
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Items array is empty or invalid");
    }
    if (!Array.isArray(basket_ids) || basket_ids.length === 0) {
      throw new Error("Basket IDs array is empty or invalid");
    }
    if (items.length !== basket_ids.length) {
      throw new Error("Mismatch between items and basket_ids lengths");
    }

    const sanitizedItems = items.map(item => {
      const requestedQty = parseInt(item.requested_quantity) || 0;
      if (requestedQty <= 0) {
        throw new Error(`Invalid requested quantity for component_id ${item.component_id}: ${requestedQty}`);
      }
      if (!item.component_id) {
        throw new Error("Missing component_id in item");
      }

      // Ensure user_id is an integer
      let userId = item.user_id;
      if (typeof userId === 'string') {
        userId = parseInt(userId, 10);
      }
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error(`Invalid user_id for component_id ${item.component_id}: ${item.user_id}`);
      }

      if (!item.date || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(item.date)) {
        throw new Error(`Invalid date format for component_id ${item.component_id}: ${item.date}`);
      }

      return {
        component_id: item.component_id,
        requested_quantity: requestedQty,
        project_name: item.project_name,
        date: item.date,
        user_id: userId, // Use the parsed integer user_id
        status: item.status, // Ensure status is passed as provided
        vendorDetails: item.vendorDetails,
      };
    });

    console.log("Sending MRF submission payload:", { items: sanitizedItems, basket_ids });
    const response = await axios.post(
      `${API_BASE_URL}/noncoc_umif/submit-material-request`,
      { items: sanitizedItems, basket_ids },
      setAuthHeader()
    );
    console.log("MRF submission response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error submitting material request form:", {
      message: error.message,
      response: error.response?.data || error.response,
      status: error.response?.status,
    });
    throw error;
  }
};

export const deleteBasketItem = async (basketId) => {
  try {
    console.log(`Deleting basket item at: ${API_BASE_URL}/noncoc_umif/basket-item/${basketId}`);
    const headers = setAuthHeader();
    console.log("Headers:", headers);
    const response = await axios.delete(
      `${API_BASE_URL}/noncoc_umif/basket-item/${basketId}`,
      headers
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting basket item:", error.response?.data || error.message);
    if (error.response && error.response.status === 404) {
      throw new Error("Basket item not found.");
    }
    throw error;
  }
};

// My Requests APIs (MIF)
export const fetchMyRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/approvals/my-requests`, setAuthHeader());
    // console.log("Fetched my requests:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      // console.log(`MIF Request ${index}:`, {
      //   user_id: req.user_id,
      //   status: req.status,
      //   fullRequest: req,
      // });
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching my requests:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchMyRequestDetails = async (umi) => {
  try {
    if (!umi) {
      throw new Error("UMI is undefined or invalid");
    }
    console.log(`Fetching request details for UMI: ${umi}`);
    const response = await axios.get(`${API_BASE_URL}/approvals/my-request-details/${umi}`, setAuthHeader());
    console.log("FetchMyRequestDetails response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching my request details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
};

// My Requests APIs (MRF)
export const fetchMyMrfRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/approvals/mrf-requests`, setAuthHeader());
    console.log("Fetched my MRF requests:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`MRF Request ${index}:`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching my MRF requests:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchMyMrfRequestDetails = async (mrf_no) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/approvals/mrf-request-details/${mrf_no}`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching my MRF request details:", error.response?.data || error.message);
    throw error;
  }
};

// MIF Approvals (head & admin)
export const fetchApprovalRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/approvals/approval-requests`, setAuthHeader());
    console.log("fetchApprovalRequests response:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`Approval Request ${index}:`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching approval requests:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch Inventory Approval Requests
export const fetchInventoryApprovalRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/approvals/inventory-approval-requests`, setAuthHeader());
    console.log("Fetched inventory approval requests:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`Inventory Approval Request ${index}:`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching inventory approval requests:", error.response?.data || error.message);
    throw error;
  }
};

// Approve Inventory Request
export const approveInventoryRequest = async (umi, { note }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/approvals/inventory-approve-request/${umi}`,
      { note },
      setAuthHeader()
    );
    console.log("Inventory approve request response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error approving inventory request:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchPastApprovedRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/approvals/past-approved`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching past approved requests:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchRequestDetails = async (umi) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/approvals/request-details/${umi}`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching request details:", error.response?.data || error.message);
    throw error;
  }
};

export const approveRequest = async (umi, { updatedItems, note, priority }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/approvals/approve-request/${umi}`,
      { updatedItems, note, priority },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error approving request:", error.response?.data || error.message);
    throw error;
  }
};

// Check MRF Existence
export const fetchMrfExistence = async (umi) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/approvals/check-mrf/${umi}`, setAuthHeader());
    return response.data; // { exists: boolean, mrf_no: string | null }
  } catch (error) {
    console.error(`Error checking MRF existence for UMI ${umi}:`, error.response?.data || error.message);
    return { exists: false, mrf_no: null };
  }
};

// MRF Approval Requests
export const fetchMrfApprovalRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mrf-approvals/approval-requests`, setAuthHeader());
    console.log("fetchMrfApprovalRequests response:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`MRF Approval Request ${index}:`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching MRF approval requests:", error.response?.data || error.message);
    throw new Error(`Failed to fetch MRF approval requests: ${error.response?.data?.error || error.message}`);
  }
};

// Fetch Purchase Approval Requests
export const fetchPurchaseApprovalRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mrf-approvals/purchase-approval-requests`, setAuthHeader());
    console.log("Fetched purchase approval requests:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`Purchase Approval Request ${index}:`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching purchase approval requests:", error.response?.data || error.message);
    throw error;
  }
};

// Approve Purchase Request
export const approvePurchaseRequest = async (mrf_no, { note }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/mrf-approvals/purchase-approve-request/${mrf_no}`,
      { note },
      setAuthHeader()
    );
    console.log("Purchase approve request response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error approving purchase request:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch CEO Approval Requests
export const fetchCEOApprovalRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mrf-approvals/ceo-approval-requests`, setAuthHeader());
    console.log("Fetched CEO approval requests:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`CEO Approval Request ${index}:`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching CEO approval requests:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch Direct PO Requests History
export const fetchDirectPoHistory = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/mrf-approvals/direct-po-history`,
      setAuthHeader()
    );
    console.log('Fetched direct PO requests history:', response.data);

    // Log the structure of each request for debugging, including component-wise status
    response.data.forEach((req, index) => {
      console.log(`Direct PO Request ${index}:`, {
        direct_sequence: req.direct_sequence,
        mpn: req.mpn,
        status: req.status,
        fullRequest: req,
      });
    });

    return response.data;
  } catch (error) {
    console.error(
      'Error fetching direct PO requests history:',
      error.response?.data || error.message
    );
    throw error;
  }
};

// Approve CEO Request
export const approveCEORequest = async (mrf_no, { note }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/mrf-approvals/ceo-approve-request/${mrf_no}`,
      { note },
      setAuthHeader()
    );
    console.log("CEO approve request response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error approving CEO request:", error.response?.data || error.message);
    throw error;
  }
};

export const rejectRequest = async (umi, { note }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/approvals/reject-request/${umi}`,
      { note },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error rejecting request:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchPastMrfApprovedRequests = async (params = {}) => {
  const { date } = params;
  try {
    const response = await axios.get(
      `${API_BASE_URL}/mrf-approvals/past-approved${date ? `?date=${date}` : ''}`,
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("API Error fetching past MRF approved requests:", error.response?.data || error.message);
    throw new Error(`Failed to fetch past approved requests: ${error.response?.statusText || error.message}`);
  }
};

export const fetchMrfRequestDetails = async (mrf_no, isPastApproved = false) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/mrf-approvals/request-details/${mrf_no}${isPastApproved ? '?past=true' : ''}`,
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("API Error:", error.response?.status, error.response?.statusText, error.response?.data || error.message);
    throw new Error(`Failed to fetch MRF request details: ${error.response?.data?.error || error.message}`);
  }
};

// Add to api.js
export const confirmMrfReceipt = async (mrf_no) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/mrf-approvals/confirm-receipt/${mrf_no}`,
      {},
      setAuthHeader()
    );
    window.dispatchEvent(new CustomEvent('statusChange', { detail: { mrfNo: mrf_no, status: 'Request Accepted' } }));
    return response.data;
  } catch (error) {
    console.error("Error confirming MRF receipt:", error.response?.data || error.message);
    throw error;
  }
};

export const approveMrfRequest = async (mrf_no, { updatedItems, note, priority, prioritySetBy, currentUserNotes }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/mrf-approvals/approve-request/${mrf_no}`,
      { updatedItems, note, priority, prioritySetBy, currentUserNotes },
      setAuthHeader()
    );
    console.log("approveMrfRequest response:", response.data); // Debug log
    return response.data;
  } catch (error) {
    console.error("Error approving MRF request:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to approve MRF request");
  }
};

export const rejectMrfRequest = async (mrf_no, { updatedItems, note }) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/mrf-approvals/reject-request/${mrf_no}`,
      { updatedItems, note },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error rejecting MRF request:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch pending non-COC issue requests
export const fetchPendingNonCOCIssueRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nc-requests/pending`, setAuthHeader());
    console.log("Fetched pending non-COC issue requests:", response.data);
    // Log the structure of each request
    response.data.forEach((req, index) => {
      console.log(`Pending Non-COC Request ${index}:`, {
        user_id: req.user_id,
        status: req.status,
        fullRequest: req,
      });
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching pending non-COC issue requests:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchPastNonCOCIssuedRequests = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nc-requests/past-issued`, setAuthHeader());
    console.log("Fetched past non-COC issued requests:", response.data);
    return response.data.map(item => {
      console.log(`Raw mrr_allocations for umi ${item.umi}, component_id ${item.component_id}:`, item.mrr_allocations);

      let mrrOptions = [];
      if (item.mrr_allocations !== null && item.mrr_allocations !== undefined) {
        if (typeof item.mrr_allocations === 'string') {
          try {
            mrrOptions = JSON.parse(item.mrr_allocations);
            console.log(`Parsed mrr_options (JSON) for umi ${item.umi}:`, mrrOptions);
          } catch (e) {
            console.warn(`mrr_allocations is not JSON for umi ${item.umi}, attempting to parse as text:`, item.mrr_allocations);
            try {
              const allocations = item.mrr_allocations.split(',').filter(Boolean);
              mrrOptions = allocations.map(allocation => {
                const [mrr_no, quantity] = allocation.split(':').map(part => part.trim());
                if (!mrr_no || !quantity) {
                  throw new Error(`Invalid format for allocation: ${allocation}`);
                }
                return {
                  mrr_no: mrr_no || "N/A",
                  material_in_quantity: parseInt(quantity, 10) || 0,
                  source: "unknown",
                  component_id: item.component_id || "N/A", // Associate with component_id
                  mpn: item.mpn || "N/A", // Associate with mpn
                };
              });
              console.log(`Parsed mrr_options (text) for umi ${item.umi}:`, mrrOptions);
            } catch (parseError) {
              console.error(`Failed to parse mrr_allocations as text for umi ${item.umi}:`, item.mrr_allocations, parseError);
              mrrOptions = [];
            }
          }
        } else {
          mrrOptions = item.mrr_allocations;
          console.log(`mrr_allocations is already an array for umi ${item.umi}:`, mrrOptions);
        }
      } else {
        console.warn(`mrr_allocations is null or undefined for umi ${item.umi}`);
        mrrOptions = [];
      }

      mrrOptions = Array.isArray(mrrOptions)
        ? mrrOptions.map(allocation => ({
            mrr_no: allocation.mrr_no || allocation.mrrNo || "N/A",
            material_in_quantity: allocation.quantity || allocation.material_in_quantity || 0,
            source: allocation.source || "unknown",
            component_id: allocation.component_id || item.component_id || "N/A",
            mpn: allocation.mpn || item.mpn || "N/A",
          }))
        : [];

      return {
        ...item,
        mrr_options: mrrOptions.sort((a, b) => a.mrr_no.localeCompare(b.mrr_no)),
      };
    });
  } catch (error) {
    console.error("Error fetching past non-COC issued requests:", error.response?.data || error.message);
    throw error;
  }
};


// Fetch details of a specific non-COC issue request with MRR numbers
export const fetchNonCOCIssueRequestDetails = async (umi) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nc-requests/issue-details/${umi}`, setAuthHeader());
    console.log("Fetched non-COC issue request details with MRR:", response.data);
    return response.data.map(item => ({
      ...item,
      mrr_options: item.mrr_options ? item.mrr_options.sort((a, b) => a.mrr_no.localeCompare(b.mrr_no)) : [],
    }));
  } catch (error) {
    console.error("Error fetching non-COC issue request details:", error.response?.data || error.message);
    throw error;
  }
};

export const deleteMRFItem = async (mrfId, componentId, userId) => {
  try {
    console.log(`Deleting MRF item at: ${API_BASE_URL}/noncoc_umif/mrf-item/${mrfId}`);
    const headers = setAuthHeader();
    console.log("Headers:", headers);
    // Pass componentId and userId in the request body or query if needed by backend
    const response = await axios.delete(
      `${API_BASE_URL}/noncoc_umif/mrf-item/${mrfId}`,
      {
        ...headers,
        data: { componentId, userId } // Include componentId and userId in the request body
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting MRF item:", error.response?.data || error.message);
    if (error.response && error.response.status === 404) {
      throw new Error("MRF item not found.");
    }
    throw error;
  }
};


export const submitNonCOCMaterialIssueForm = async (umi, items, issue_date, note) => {
  try {
    console.log("Submitting with payload:", { umi, items, issue_date, note });
    const response = await axios.post(
      `${API_BASE_URL}/nc-requests/submit-material-issue`,
      { umi, items, issue_date, note },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error submitting non-COC material issue form:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error.response?.data || error;
  }
};

export const fetchPastIssuedRequestDetails = async (umi) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nc-requests/past-issued/${umi}`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching past issued request details:", error.response?.data || error.message);
    throw error;
  }
};

export const confirmNotificationReceipt = async (umi) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/notifications/confirm/${umi}`,
      {},
      setAuthHeader()
    );
    window.dispatchEvent(new CustomEvent('statusConfirm', { detail: { umiNo: umi, status: 'Issued' } }));
    return response.data;
  } catch (error) {
    console.error('Error confirming receipt:', error.response?.data || error.message);
    throw error;
  }
};

// Create a new location
export const createLocation = async (locationData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/locations`, locationData, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error creating location:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch all locations
export const fetchLocations = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/locations`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error("Error fetching locations:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch parent locations
export const fetchParentLocations = async (type = "") => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/locations/parents${type ? `?type=${type}` : ""}`,
      setAuthHeader()
    );
    return response.data.data; // Only return the data array
  } catch (error) {
    console.error("Error fetching parent locations:", error.response?.data || error.message);
    throw error;
  }
};

//backorder of backorder
// Function to handle backorder of backorder (unchanged)
export const handleBackorderOfBackorder = async (data) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No token found');
  }

  const response = await fetch('/api/noncoc/handle-backorder-of-backorder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to handle backorder of backorder');
  }

  return await response.json();
};

// Fetch all locations from the locations table
export const fetchAllLocations = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/locations/all`, setAuthHeader());
    if (!Array.isArray(response.data)) {
      console.warn("Unexpected response format from /locations/all:", response.data);
      throw new Error("Expected an array of locations, but received a different format.");
    }
    console.log("Fetched all locations:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching all locations:", error.response?.data || error.message);
    throw error;
  }
};
export const fetchPurchaseOrderComponents = async () => {
  const role = localStorage.getItem('role');
  const allowedRoles = ["inventory_head", "inventory_employee", "admin", "purchase_head"];
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Unauthorized: Only inventory team, purchase head, or admin can access purchase order components");
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/nc-requests/purchase-order-components`, setAuthHeader());
    console.log("Full API response:", response);
    console.log("Raw API data:", response.data);

    const components = response.data.data || []; // Extract data array

    if (!Array.isArray(components)) {
      throw new Error("Expected an array of purchase order components, but received an invalid format.");
    }

    const formattedComponents = components.map(item => ({
      po_number: item.po_number || 'N/A',
      mrf_no: item.mrf_no || 'N/A',
      mrr_no: item.mrr_no || 'N/A',
      vendor_name: item.vendor_name || 'N/A',
      created_at: item.created_at || 'N/A', // Already in YYYY-MM-DD format from server
      mpn: item.mpn || 'N/A',
      item_description: item.item_description || 'N/A',
      part_no: item.part_no || 'N/A',
      make: item.make || 'N/A',
      uom: item.uom || 'N/A',
      updated_requested_quantity: item.updated_requested_quantity || 0,
      expected_delivery_date: item.expected_delivery_date || 'N/A',
      status: item.status || 'Material Delivery Pending',
      backorder_sequence: item.backorder_sequence || 'N/A',
      backorder_pending_quantity: item.backorder_pending_quantity || 0,
      return_sequence: item.return_sequence || 'N/A',
      return_reordered_quantity: item.return_reordered_quantity || 0,
      component_id: item.component_id || null,
      location: item.location || 'N/A',
    }));

    console.log("Formatted purchase order components:", formattedComponents);
    return formattedComponents;
  } catch (error) {
    console.error("Error fetching purchase order components:", error.response || error.message);
    console.error("Error details:", error.response?.data, error.response?.status);
    throw new Error(`Failed to fetch purchase order components: ${error.response?.data?.error || error.message}`);
  }
};

//status change for quality check 
// Update purchase order status using axios
export const updatePurchaseOrderStatus = async ({ po_number, mpn, status }) => {
  // Check user role before proceeding
  const role = localStorage.getItem('role');
  const allowedRoles = ["inventory_head", "inventory_employee", "admin"];
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Unauthorized: Only inventory team or admin can update purchase order status");
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/nc-requests/update-po-status`,
      { po_number, mpn, status },
      setAuthHeader()
    );
    console.log("Updated purchase order status:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updating purchase order status:", error.response?.data || error.message);
    throw error;
  }
};

// bo status updation in backorder table 
// Update backorder item status
export const updateBackorderStatus = async (data) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No token found');
  }

  const response = await fetch(`${API_BASE_URL}/nc-requests/update-bo-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update backorder status');
  }

  return await response.json();
};


export const confirmReceipt = async (umi) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/nc-requests/confirm-receipt/${umi}`,
      {},
      setAuthHeader()
    );
    window.dispatchEvent(new CustomEvent('statusChange', { detail: { umiNo: umi, status: 'Receiving Pending' } }));
    return response.data;
  } catch (error) {
    console.error("Error confirming receipt:", error.response?.data || error.message);
    throw error;
  }
};

export const approveNonCOCMaterialIssueForm = async (umi, items, issue_date, note) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/nc-requests/submit-material-issue`,
      { umi, items, issue_date, note },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error approving non-COC material issue form:", error.response?.data || error.message);
    throw error;
  }
};

export const rejectNonCOCMaterialIssueForm = async (umi, note) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/nc-requests/reject/${umi}`,
      { note },
      setAuthHeader()
    );
    return response.data;
  } catch (error) {
    console.error("Error rejecting non-COC material issue form:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch pending notifications
export const fetchPendingNotifications = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/notifications/pending`, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error('Error fetching pending notifications:', error.response?.data || error.message);
    throw error;
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/notifications/${notificationId}/read`, {}, setAuthHeader());
    return response.data;
  } catch (error) {
    console.error('Error marking notification as read:', error.response?.data || error.message);
    throw error;
  }
};

export const fetchBackorderQualityInspectionComponents = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/quality-inspection/backorder-quality-inspection`, setAuthHeader());
    console.log("Fetched Backorder quality inspection components:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching Backorder quality inspection components:", error.response?.data || error.message);
    throw new Error(`Failed to fetch backorder quality inspection components: ${error.response?.data?.error || error.message}`);
  }
};


export const fetchQualityInspectionComponents = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/quality-inspection/quality-inspection-components`, setAuthHeader());
    console.log("Fetched quality inspection components:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching quality inspection components:", error.response?.data || error.message);
    throw error;
  }
};
export const updateQualityInspectionStatus = async ({
  po_number,
  mpn,
  status,
  received_mpn,
  received_make,
  date_code,
  lot_code,
  received_quantity,
  passed_quantity,
  failed_quantity,
  coc_received,
  note,
  source
}) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/quality-inspection/quality-inspection-components/status`,
      {
        po_number,
        mpn,
        status,
        received_mpn,
        received_make,
        date_code,
        lot_code,
        received_quantity,
        passed_quantity,
        failed_quantity,
        coc_received,
        note,
        source
      },
      setAuthHeader()
    );
    console.log("Updated quality inspection status:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updating quality inspection status:", error.response?.data || error.message);
    throw error;
  }
};

export const submitBackorder = async (components) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/backorder`,
      { components },
      setAuthHeader()
    );
    console.log("Backorder submitted:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error submitting backorder:", error.response?.data || error.message);
    throw new Error(`Failed to submit backorder: ${error.response?.data?.error || error.message}`);
  }
};


export const submitReturn = async (components) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/return`,
      { components },
      setAuthHeader()
    );
    console.log("Return submitted:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error submitting return:", error.response?.data || error.message);
    throw new Error(`Failed to submit return: ${error.response?.data?.error || error.message}`);
  }
};
export const fetchDocuments = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/documents`, setAuthHeader());
    console.log('Fetched documents:', response.data);
    return response.data; // Return data as-is; base64 handling is done in frontend
  } catch (error) {
    console.error('Error fetching documents:', error.response?.data || error.message);
    throw new Error(`Failed to fetch documents: ${error.response?.data?.error || error.message}`);
  }
};

// Download a document (coc_file or id_card_file) as a PDF
export const downloadDocuments = async (poNumber, mrrNo, fileType) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/documents/download/${poNumber}/${mrrNo}/${fileType}`,
      {
        ...setAuthHeader(),
        responseType: 'blob', // Expect binary data (PDF)
      }
    );
    console.log(`Downloaded ${fileType} document for PO: ${poNumber}, MRR: ${mrrNo}`);
    return response.data; // Returns a Blob
  } catch (error) {
    console.error(`Error downloading ${fileType} document:`, error.response?.data || error.message);
    throw new Error(`Failed to download ${fileType} document: ${error.response?.data?.error || error.message}`);
  }
};


// Get a URL for serving a document (for iframe display)
export const getDocumentUrl = async (poNumber, mrrNo, fileType) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/documents/serve/${poNumber}/${mrrNo}/${fileType}`,
      {
        ...setAuthHeader(),
        responseType: 'blob', // Expect binary data (PDF)
      }
    );
    console.log(`Fetched ${fileType} document URL for PO: ${poNumber}, MRR: ${mrrNo}`);
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return URL.createObjectURL(blob); // Returns a temporary URL for the Blob
  } catch (error) {
    console.error(`Error fetching ${fileType} document URL:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch ${fileType} document URL: ${error.response?.data?.error || error.message}`);
  }
};

export const submitDirectPurchaseRequest = async ({ items }) => {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is empty or invalid');
    }

    const sanitizedItems = items.map((item, index) => {
      const requestedQty = parseInt(item.requested_quantity) || 0;
      if (requestedQty <= 0) throw new Error(`Invalid requested quantity for MPN ${item.mpn || 'unknown'} at index ${index}`);
      if (!item.mpn || typeof item.mpn !== 'string' || item.mpn.trim() === '') throw new Error(`Invalid or missing MPN at index ${index}`);
      if (!item.project_name || typeof item.project_name !== 'string' || item.project_name.trim() === '') throw new Error(`Invalid project_name for MPN ${item.mpn} at index ${index}`);
      if (item.note && typeof item.note !== 'string') throw new Error(`Invalid note type for MPN ${item.mpn} at index ${index}`);
      if (!item.vendor || typeof item.vendor !== 'string' || item.vendor.trim() === '') throw new Error(`Invalid vendor for MPN ${item.mpn} at index ${index}`);
      if (!item.uom || typeof item.uom !== 'string' || item.uom.trim() === '') throw new Error(`Invalid uom for MPN ${item.mpn} at index ${index}`);
      if (!item.gst_type || typeof item.gst_type !== 'string' || !['18% GST', '18% IGST'].includes(item.gst_type)) throw new Error(`Invalid gst_type for MPN ${item.mpn} at index ${index}`);
      if (item.item_description && typeof item.item_description !== 'string') throw new Error(`Invalid item_description for MPN ${item.mpn} at index ${index}`);
      if (item.make && typeof item.make !== 'string') throw new Error(`Invalid make for MPN ${item.mpn} at index ${index}`);

      const updatedQty = parseInt(item.updated_qty) || 0;
      if (updatedQty < 0) throw new Error(`Invalid updated_qty for MPN ${item.mpn} at index ${index}`);
      const ratePerUnit = parseFloat(item.rate_per_unit) || 0;
      if (ratePerUnit < 0) throw new Error(`Invalid rate_per_unit for MPN ${item.mpn} at index ${index}`);
      const amountINR = parseFloat(item.amount_inr) || 0;
      if (amountINR < 0) throw new Error(`Invalid amount_inr for MPN ${item.mpn} at index ${index}`);
      const gstAmount = parseFloat(item.gst_amount) || 0;
      if (gstAmount < 0) throw new Error(`Invalid gst_amount for MPN ${item.mpn} at index ${index}`);
      const totalPoCost = parseFloat(item.total_po_cost) || 0;
      if (totalPoCost <= 0) throw new Error(`Invalid total_po_cost for MPN ${item.mpn} at index ${index}`);

      if (!item.submitted_at || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(item.submitted_at)) {
        throw new Error(`Invalid submitted_at format for MPN ${item.mpn} at index ${index}: ${item.submitted_at}`);
      }

      return {
        mpn: item.mpn.trim(),
        requested_quantity: requestedQty,
        project_name: item.project_name.trim(),
        note: item.note ? item.note.trim() : '',
        vendor: item.vendor.trim(),
        uom: item.uom.trim(),
        gst_type: item.gst_type,
        updated_qty: updatedQty,
        rate_per_unit: ratePerUnit,
        amount_inr: amountINR,
        gst_amount: gstAmount,
        total_po_cost: totalPoCost,
        submitted_at: item.submitted_at,
        item_description: item.item_description ? item.item_description.trim() : 'N/A',
        make: item.make ? item.make.trim() : 'N/A',
      };
    });

    const totalPoCostSet = new Set(sanitizedItems.map(item => item.total_po_cost));
    if (totalPoCostSet.size !== 1) throw new Error('Inconsistent total_po_cost values across items');

    console.log('Sending direct purchase request payload:', { items: sanitizedItems });

    const response = await axios.post(
      `${API_BASE_URL}/noncoc_umif/submit-direct-purchase-request`,
      { items: sanitizedItems },
      setAuthHeader()
    );

    console.log('Direct purchase request submission response:', {
      status: response.status,
      data: response.data,
      direct_sequence: response.data.direct_sequence || 'N/A',
      mrf_no: response.data.mrf_no || 'N/A',
    });

    return {
      message: response.data.message,
      direct_sequence: response.data.direct_sequence || 'N/A',
      mrf_no: response.data.mrf_no || 'N/A',
      ids: response.data.ids || [],
    };
  } catch (error) {
    console.error('Error submitting direct purchase request:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw new Error(`Failed to submit direct purchase request: ${error.response?.data?.error || error.message}`);
  }
};

// In api.js, fetchDirectPoRequests

export const fetchDirectPoComponents = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/direct-po-components`, setAuthHeader());
    return response.data.map(item => ({
      ...item,
      components: item.components.map(comp => ({
        ...comp,
        item_description: comp.item_description || "N/A",
        make: comp.make || "N/A",
        part_no: comp.part_no || "N/A",
        mrf_no: comp.mrf_no || "N/A",
      })),
    }));
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch components");
  }
};

// Approve a direct PO request by direct_sequence
export const approveDirectPoRequest = async (directSequence, { note, mpn }) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/direct-po-components/direct-po-requests/${directSequence}/approve`, // Updated path
      { note, mpn },
      setAuthHeader()
    );
    console.log("Approved direct PO request:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error approving direct PO request:", error.response?.data || error.message);
    throw new Error(`Failed to approve direct PO request: ${error.response?.data?.message || error.message}`);
  }
};

// Reject a direct PO request by direct_sequence
export const rejectDirectPoRequest = async (directSequence, { note, reason, mpn }) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/direct-po-components/direct-po-requests/${directSequence}/reject`, // Updated path
      { note, reason, mpn },
      setAuthHeader()
    );
    console.log("Rejected direct PO request:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error rejecting direct PO request:", error.response?.data || error.message);
    throw new Error(`Failed to reject direct PO request: ${error.response?.data?.message || error.message}`);
  }
};

// Mark components as Hold for a direct PO request
export const markDirectPoRequestAsHold = async (directSequence, { mpns }) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/direct-po-components/direct-po-requests/${directSequence}/hold`,
      { mpns },
      setAuthHeader()
    );
    console.log("Marked components as Hold:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error marking components as Hold:", error.response?.data || error.message);
    throw new Error(`Failed to mark components as Hold: ${error.response?.data?.message || error.message}`);
  }
};

//purchase 
/* Frontend: API function in api.js */

export const fetchCeoApprovedMrfRequestsForPo = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/mrf-approvals/ceo-approved-for-po`,
      setAuthHeader()
    );
    console.log("Raw API response for CEO approved direct PO requests:", response.data);

    const poRequests = Array.isArray(response.data) ? response.data : [];

    const formattedData = poRequests.map(item => {
      console.log(`Received dates for direct_sequence ${item.direct_sequence}:`, {
        created_at: item.created_at,
        submitted_at: item.components?.[0]?.submitted_at,
      });

      return {
        direct_sequence: item.direct_sequence || 'N/A',
        project_name: item.project_name || 'N/A',
        mrf_no: item.mrf_no || 'N/A',
        user_name: item.user_name || 'Unknown User',
        status: item.status || 'CEO Approval Done',
        created_at: item.created_at || 'N/A',
        vendor: item.vendor || 'Unknown Vendor',
        note: item.note || '',
        total_po_cost: parseFloat(item.total_po_cost) || 0,
        components: Array.isArray(item.components)
          ? item.components.map(comp => ({
              id: comp.id || null,
              mpn: comp.mpn || 'N/A',
              item_description: comp.item_description || 'N/A',
              make: comp.make || 'N/A',
              part_no: comp.part_no || 'N/A',
              requested_quantity: parseInt(comp.requested_quantity) || 0,
              uom: comp.uom || 'N/A',
              vendor: comp.vendor || 'Unknown Vendor',
              rate_per_unit: parseFloat(comp.rate_per_unit) || 0,
              amount_inr: parseFloat(comp.amount_inr) || 0,
              gst_type: comp.gst_type || 'N/A',
              gst_amount: parseFloat(comp.gst_amount) || 0,
              total_po_cost: parseFloat(comp.total_po_cost) || 0,
              note: comp.note || 'N/A',
              submitted_at: comp.submitted_at || 'N/A',
            }))
          : [],
      };
    });

    console.log("Formatted CEO approved direct PO requests:", formattedData);
    return formattedData;
  } catch (error) {
    console.error("Error fetching CEO approved direct PO requests:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
    });
    throw new Error(`Failed to fetch CEO approved direct PO requests: ${JSON.stringify(error.response?.data) || error.message}`);
  }
};

export const fetchPastDirectPoApprovals = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/direct-po-components/past-approvals`,
      setAuthHeader()
    );
    return response.data.map(item => ({
      ...item,
      components: item.components.map(comp => ({
        ...comp,
        item_description: comp.item_description || "N/A",
        make: comp.make || "N/A",
        part_no: comp.part_no || "N/A",
      })),
    }));
  } catch (error) {
    console.error("Error fetching past direct PO approvals:", error.response?.data || error.message);
    throw new Error(`Failed to fetch past direct PO approvals: ${error.response?.data?.error || error.message}`);
  }
};

export const fetchBackorderItems = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/quality-inspection/components`, {
      params: {
        status: ['QC Cleared', 'QC Rejected']
      },
      ...setAuthHeader() // Add authentication header
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch backorder items: ' + (error.response?.data?.message || error.message));
  }
};

export const updateBackorderMaterialIn = async ({mpn, material_in_quantity, mrf_no }) => {
  // Validate inputs before making the request
  if (!mpn || typeof mpn !== 'string' || mpn.trim() === '') {
    throw new Error('Invalid or missing mpn');
  }
  if (material_in_quantity == null) {
    throw new Error('Material in quantity is required');
  }
  if (material_in_quantity < 0) {
    throw new Error('Material in quantity must be a non-negative number');
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/backorder-items/${encodeURIComponent(mpn)}/material-in`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...setAuthHeader().headers, // Spread headers property correctly
        },
        body: JSON.stringify({
          material_in_quantity,
          mrf_no: mrf_no || null, // Send null if mrf_no is not provided
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update backorder material in');
    }

    return await response.json(); // Returns { success: true }
  } catch (error) {
    console.error('Error updating backorder material in:', error.message);
    throw error; // Propagate error to be handled by the caller
  }
};

// Fetch quality checkpoints (already exists, but included for reference)
export const fetchCheckpoints = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/quality-checkpoints`, setAuthHeader());
    console.log("Fetched checkpoints:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching checkpoints:", error.response?.data || error.message);
    throw new Error(`Failed to fetch checkpoints: ${error.response?.data?.error || error.message}`);
  }
};

// Create a new quality checkpoint
export const createQualityCheckpoint = async (checkpointData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/quality-checkpoints/create`,
      checkpointData,
      setAuthHeader()
    );
    console.log("Created quality checkpoint:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error creating quality checkpoint:", error.response?.data || error.message);
    throw new Error(`Failed to create quality checkpoint: ${error.response?.data?.error || error.message}`);
  }
};

export const fetchQCdoneComponents = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/quality-inspection/quality-inspection-done`,
      setAuthHeader()
    );

    // Log the successful response for debugging
    console.log("Fetched quality inspection components:", response.data);

    // Validate the response structure
    if (!response.data || !response.data.data || !response.data.data.overview || !response.data.data.components) {
      throw new Error("Invalid response structure: Expected data with overview and components");
    }

    return response.data;
  } catch (error) {
    // Enhanced error handling
    let errorMessage = "Failed to fetch QC done components";
    if (error.response) {
      // Server responded with a status other than 2xx
      if (error.response.status === 403) {
        errorMessage = "Unauthorized: Only quality team or admin can access QC done components";
      } else if (error.response.status === 401) {
        errorMessage = "Session expired. Please log in again.";
      } else {
        errorMessage = error.response.data?.error || errorMessage;
      }
      console.error(
        "Error fetching quality inspection components:",
        error.response.data || error.message
      );
    } else if (error.request) {
      // No response received (network error)
      errorMessage = "Network error: Unable to reach the server";
      console.error("Network error fetching quality inspection components:", error.message);
    } else {
      // Error setting up the request
      console.error("Error setting up request for quality inspection components:", error.message);
    }

    throw new Error(errorMessage);
  }
};

export const fetchUsers = async (roleId = null) => {
  try {
    const url = roleId ? `${API_BASE_URL}/users?role_id=${roleId}` : `${API_BASE_URL}/users`;
    const response = await axios.get(url, setAuthHeader());
    console.log("Fetched users:", response.data);

    const users = Array.isArray(response.data) ? response.data : [];

    const formattedUsers = users.map(user => ({
      id: user.id || null,
      name: user.name || 'N/A',
      email: user.email || 'N/A',
      department: user.department || 'N/A',
      designation: user.designation || 'N/A',
      role: user.role || 'N/A',
      role_id: user.role_id || null,
      role_name: user.role_name || 'N/A',
      signature: user.signature || null,
      created_at: user.created_at ? moment(user.created_at).format('YYYY-MM-DD HH:mm:ss') : 'N/A',
      updated_at: user.updated_at ? moment(user.updated_at).format('YYYY-MM-DD HH:mm:ss') : 'N/A',
      permissions: user.permissions || {},
    }));

    console.log("Formatted users:", formattedUsers);
    return formattedUsers;
  } catch (error) {
    console.error("Error fetching users:", error.response?.data || error.message);
    throw new Error(`Failed to fetch users: ${error.response?.data?.message || error.message}`);
  }
};

export const updateUser = async (userId, formData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/users/${userId}`, formData, {
      ...setAuthHeader(),
      headers: {
        ...setAuthHeader().headers,
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log("Updated user:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updating user:", error.response?.data || error.message);
    throw new Error(`Failed to update user: ${error.response?.data?.message || error.message}`);
  }
};

export const createUser = async (userData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/users/create-user`, userData, {
      ...setAuthHeader(),
      headers: {
        ...setAuthHeader().headers,
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log("Created user:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error creating user:", error.response?.data || error.message);
    throw new Error(`Failed to create user: ${error.response?.data?.message || error.message}`);
  }
};

export const deleteUser = async (userId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/users/${userId}`, setAuthHeader());
    console.log("Deleted user:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error deleting user:", error.response?.data || error.message);
    throw new Error(`Failed to delete user: ${error.response?.data?.message || error.message}`);
  }
};

// Fetch all roles with their permissions and modules
export const fetchRoles = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/roles`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch roles');
  }
};

// FETCH PROJECTS
export const fetchProjects = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/noncoc_umif/projects`, 
      setAuthHeader());
    // console.log("Fetched projects:", response.data);
    if (!Array.isArray(response.data)) {
      console.warn("Unexpected response format:", response.data);
      throw new Error("Expected an array of project names");
    }
    return response.data;
  } catch (error) {
    console.error("Error fetching projects:", error.response?.data || error.message);
    throw new Error(`Failed to fetch projects: ${error.response?.data?.error || error.message}`);
  }
};

export const fetchPreviousPurchases = async (filters = {}) => {
  try {
    // Construct query parameters from filters
    const params = {};
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.poNumber) params.po_number = filters.poNumber;
    if (filters.status) params.status = filters.status;
    if (filters.componentId) params.component_id = filters.componentId;
    if (filters.limit) params.limit = filters.limit;
    if (filters.sort) params.sort = filters.sort;

    // Log the request details
    const authHeader = setAuthHeader();
    console.log('fetchPreviousPurchases Request:', {
      url: `${API_BASE_URL}/direct-po-components/previous`,
      params,
      headers: authHeader.headers,
    });

    // Make API request
    const response = await axios.get(`${API_BASE_URL}/direct-po-components/previous`, {
      params,
      ...authHeader,
    });
    console.log("Fetched previous purchases:", response);

    // Validate response structure
    const purchaseOrders = Array.isArray(response.data.data) ? response.data.data : [];
    if (!purchaseOrders.length && response.data.data !== undefined) {
      console.warn("No previous purchases found or unexpected response structure:", response.data);
    }

    // Format the data to match modal expectations
    const formattedData = purchaseOrders.map(item => ({
      po_number: item.po_number || 'N/A',
      vendor_name: item.vendor_name || 'N/A',
      rate_per_unit: item.rate_per_unit || 0,
      created_at: item.created_at ? moment(item.created_at).format('YYYY-MM-DD') : 'N/A',
      updated_requested_quantity: item.updated_requested_quantity || 'N/A',
      amount: item.amount || 0,
    }));

    console.log("Formatted previous purchases:", formattedData);
    return formattedData;
  } catch (error) {
    console.error("Error fetching previous purchases:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw new Error(`Failed to fetch previous purchases: ${error.response?.data?.error || error.message}`);
  }
};

// Fetch inventory items with optional filters
export const fetchInventoryItems = async (filters = {}) => {
  try {
    // Construct query parameters from filters
    const params = {};
    if (filters.itemName) params.item_name = filters.itemName;
    if (filters.category) params.category = filters.category;
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.status) params.status = filters.status;

    // Make API request
    const response = await axios.get(`${API_BASE_URL}/inventory/items`, {
      params,
      ...setAuthHeader(),
    });
    console.log('Fetched inventory items:', response.data);

    // Validate response structure
    const items = Array.isArray(response.data.data) ? response.data.data : [];
    if (!items.length && response.data.data !== undefined) {
      console.warn('No inventory items found or unexpected response structure:', response.data);
    }

    // Format the data to match frontend expectations
    const formattedData = items.map(item => ({
      item_id: item.item_id || 'N/A',
      item_name: item.item_name || 'N/A',
      category: item.category || 'N/A',
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      last_updated: item.last_updated ? moment(item.last_updated).format('YYYY-MM-DD') : 'N/A',
      status: item.status || 'N/A',
    }));

    console.log('Formatted inventory items:', formattedData);
    return formattedData;
  } catch (error) {
    console.error('Error fetching inventory items:', error.response?.data || error.message);
    throw new Error(`Failed to fetch inventory items: ${error.response?.data?.error || error.message}`);
  }
};

export const cancelRequest = async (umi, reason) => {
  try {
    // Input validation
    if (!umi || typeof umi !== 'string' || umi.trim() === '') {
      throw new Error('Invalid or missing UMI');
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      throw new Error('Reason is required and must be a non-empty string');
    }

    console.log('Cancel request payload:', { umi, reason, status: 'Request Cancelled' });

    const response = await axios.post(
      `${API_BASE_URL}/nc-requests/cancel/${umi}`,
      { reason, status: 'Request Cancelled' },
      setAuthHeader()
    );

    console.log('Cancel request response:', {
      status: response.status,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    console.error('Error cancelling request:', {
      umi,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw new Error(`Failed to cancel request: ${error.response?.data?.error || error.message}`);
  }
};

// Logout User
export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("permissions");
  localStorage.removeItem("user_id");
  localStorage.removeItem("email");
  localStorage.removeItem("name");
  sessionStorage.clear();
  window.location.href = "/login";
};