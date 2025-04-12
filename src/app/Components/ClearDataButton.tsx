"use client";

import React, { useState } from 'react';
import { FaTrashAlt, FaExclamationTriangle } from 'react-icons/fa';
import { createPortal } from 'react-dom';

interface ClearDataButtonProps {
  onSuccess?: () => void;
  className?: string;
  activeTab: string; // Add this prop to know which tab is active
}

const ClearDataButton: React.FC<ClearDataButtonProps> = ({ onSuccess, className, activeTab }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle mounting for portal
  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleClearData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:5000/api/reset-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tabType: activeTab }) // Pass the active tab
      });

      if (!response.ok) {
        throw new Error('Failed to clear data');
      }

      // Call the success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get UI text based on active tab
  const getTabSpecificText = () => {
    switch (activeTab) {
      case 'sales':
        return {
          buttonText: 'Clear Sales Data',
          confirmTitle: 'Clear Sales History',
          confirmMessage: 'This will permanently delete all sales records and transaction history.',
          itemsToDelete: ['All sales records', 'All transaction history']
        };
      case 'inventory':
      case 'stock':
      case 'alerts':
        return {
          buttonText: 'Clear Inventory Data',
          confirmTitle: 'Clear Inventory Data',
          confirmMessage: 'This will permanently delete all products in your inventory.',
          itemsToDelete: ['All products', 'All stock information', 'All product categories']
        };
      case 'reports':
        return {
          buttonText: 'Clear Reports Data',
          confirmTitle: 'Clear Reports Data',
          confirmMessage: 'This will reset all report data.',
          itemsToDelete: ['All report configurations']
        };
      default:
        return {
          buttonText: 'Clear All Data',
          confirmTitle: 'Confirm Data Reset',
          confirmMessage: 'This will permanently delete ALL data.',
          itemsToDelete: ['All products in inventory', 'All sales records', 'All transaction history']
        };
    }
  };

  const tabText = getTabSpecificText();

  // Main button to open the modal
  const button = (
    <button
      onClick={() => setShowConfirmModal(true)}
      className={`px-4 py-2 bg-red-600 text-white rounded flex items-center hover:bg-red-700 transition-colors ${className || ''}`}
      title={`Clear ${activeTab} data`}
    >
      <FaTrashAlt className="mr-2" />
      {tabText.buttonText}
    </button>
  );

  // Confirmation modal
  const confirmModal = showConfirmModal && mounted && createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-lg w-96 p-6 m-4 max-w-sm mx-auto">
        <div className="flex items-center mb-4">
          <FaExclamationTriangle className="text-red-500 text-2xl mr-3" />
          <h3 className="text-xl font-bold text-gray-800">{tabText.confirmTitle}</h3>
        </div>
        
        <div className="text-gray-700 mb-6">
          <p className="mb-4">{tabText.confirmMessage}</p>
          <ul className="list-disc list-inside space-y-1">
            {tabText.itemsToDelete.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 font-semibold text-red-600">
            This action cannot be undone!
          </p>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowConfirmModal(false)}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleClearData}
            disabled={isLoading}
            className={`px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Clearing...' : 'Clear Data'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {button}
      {confirmModal}
    </>
  );
};

export default ClearDataButton;