import React, { useState } from 'react';
import { fetchDocuments } from '../utils/api';
import { X } from 'lucide-react';

const Documents = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState({ coc: false, id_card: false });

  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType || 'application/pdf' });
  };

  const handleSearch = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Unauthorized: Please log in to access documents.');
      setDocuments([]);
      setFilteredDocuments([]);
      setSelectedDocument(null);
      setPreviewUrl(null);
      return;
    }

    if (!searchQuery.trim()) {
      setError('Please enter a search query (PO Number, MRR Number, MPN, or Part Number).');
      setFilteredDocuments([]);
      setSelectedDocument(null);
      setPreviewUrl(null);
      return;
    }

    setLoading(true);
    setError('');
    setSelectedDocument(null);
    setPreviewUrl(null);

    try {
      const response = await fetchDocuments();
      setDocuments(response);

      const query = searchQuery.trim().toUpperCase();
      const filtered = response.filter(doc =>
        (doc.po_number && doc.po_number.toUpperCase().includes(query)) ||
        (doc.mrr_no && doc.mrr_no.toUpperCase().includes(query)) ||
        (doc.mpn && doc.mpn.toUpperCase().includes(query)) ||
        (doc.part_no && doc.part_no.toUpperCase().includes(query))
      );
      setFilteredDocuments(filtered);

      if (filtered.length === 0) {
        setError('No documents found for the given query.');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      if (errorMessage.includes('401')) {
        setError('Unauthorized: Please log in again.');
        localStorage.removeItem('token');
        setTimeout(() => (window.location.href = '/login'), 2000);
      } else if (errorMessage.includes('403')) {
        setError('Forbidden: You do not have permission to access these documents.');
      } else {
        setError(`Error fetching documents: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentSelect = async (doc, fileType) => {
    setSelectedDocument({ ...doc, fileType });
    setPreviewUrl(null);
    try {
      const base64 = fileType === 'coc' ? doc.coc_file : doc.id_card_file;
      const mimeType = fileType === 'coc' ? doc.coc_file_mime_type : doc.id_card_file_mime_type;
      if (!base64) {
        setError(`No ${fileType} file available for this document.`);
        return;
      }
      const blob = base64ToBlob(base64, mimeType);
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(`Error loading ${fileType} preview: ${err.message}`);
    }
  };

  const downloadFile = (doc, fileType) => {
    setDownloadLoading(prev => ({ ...prev, [fileType]: true }));
    try {
      const base64 = fileType === 'coc' ? doc.coc_file : doc.id_card_file;
      const mimeType = fileType === 'coc' ? doc.coc_file_mime_type : doc.id_card_file_mime_type;
      if (!base64) {
        setError(`No ${fileType} file available for download.`);
        return;
      }
      const blob = base64ToBlob(base64, mimeType);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
      link.setAttribute('download', `${fileType}_${doc.po_number}_${doc.mrr_no}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Error downloading ${fileType} file: ${err.message}`);
    } finally {
      setDownloadLoading(prev => ({ ...prev, [fileType]: false }));
    }
  };

  const printFile = () => {
    if (previewUrl) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = previewUrl;
      document.body.appendChild(iframe);
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }
  };

  const closePreview = () => {
    setSelectedDocument(null);
    setPreviewUrl(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8">
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      <div className="w-full bg-white rounded-xl shadow-lg p-4 md:p-6 lg:p-8">
        <h2 className="text-4xl md:text-3xl font-bold text-left mb-6 text-blue-800 border-l-4 border-green-600 pl-4 mt-3">
          Documents
        </h2>

        <div className={`flex flex-col sm:flex-row gap-4 mb-6 justify-center transition-all duration-300 ${selectedDocument ? 'lg:w-1/2' : 'lg:w-full'}`}>
          <input
            type="text"
            placeholder="Search by PO Number, MRR Number, MPN, or Part Number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-3 border border-gray-300 rounded-lg flex-1 min-w-[200px] sm:min-w-[300px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className={`px-6 py-3 bg-blue-600 text-white rounded-lg font-medium transition ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
          >
            {loading ? 'Searching...' : 'Search Documents'}
          </button>
        </div>

        {error && (
          <p className="text-red-600 text-center mb-6 font-medium">{error}</p>
        )}

        <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
          {/* Document List */}
          <div className={`transition-all duration-300 ${selectedDocument ? 'lg:w-1/2' : 'lg:w-full'} overflow-auto`}>
            {filteredDocuments.length > 0 && (
              <table className="w-full border-collapse bg-gray-50 rounded-lg shadow-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-3 text-left font-semibold">PO Number</th>
                    <th className="p-3 text-left font-semibold">MRR Number</th>
                    <th className="p-3 text-left font-semibold">MPN</th>
                    <th className="p-3 text-left font-semibold">Part Number</th>
                    <th className="p-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map(doc => (
                    <tr key={doc.id} className="border-b border-gray-200 hover:bg-gray-100">
                      <td className="p-3">{doc.po_number || 'N/A'}</td>
                      <td className="p-3">{doc.mrr_no || 'N/A'}</td>
                      <td className="p-3">{doc.mpn || 'N/A'}</td>
                      <td className="p-3">{doc.part_no || 'N/A'}</td>
                      <td className="p-3 flex gap-2">
                        {doc.coc_file && (
                          <button
                            onClick={() => handleDocumentSelect(doc, 'coc')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition"
                          >
                            View COC
                          </button>
                        )}
                        {doc.id_card_file && (
                          <button
                            onClick={() => handleDocumentSelect(doc, 'id_card')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition"
                          >
                            View ID Card
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Document Preview */}
          {selectedDocument && (
            <div className="lg:w-1/2 p-4 bg-gray-50 rounded-lg shadow-sm relative transition-all duration-300">
              <button
                onClick={closePreview}
                className="absolute top-2 right-2 text-gray-600 hover:text-red-600 transition"
                aria-label="Close preview"
              >
                <X size={24} />
              </button>
              <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">
                Preview: {selectedDocument.fileType === 'coc' ? 'COC' : 'ID Card'} for PO: {selectedDocument.po_number}, MRR: {selectedDocument.mrr_no}
              </h3>
              {previewUrl ? (
                <div className="h-[500px] overflow-auto border border-gray-200 rounded-lg bg-white">
                  <iframe
                    src={previewUrl}
                    title={`${selectedDocument.fileType} File`}
                    className="w-full h-full border-none"
                    onError={e => console.error('Iframe load error:', e)}
                  />
                </div>
              ) : (
                <p className="text-gray-500 italic">Loading preview...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Documents;