"use client";

import React, { useState } from 'react';
import { FaKeyboard, FaTimes } from 'react-icons/fa';

const KeyboardShortcuts: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-teal-600 text-white p-3 rounded-full shadow-lg hover:bg-teal-700 transition-colors z-40"
        title="Keyboard Shortcuts"
      >
        <FaKeyboard size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[600px] max-h-[80vh] overflow-auto">
            <div className="bg-teal-600 p-4 flex justify-between items-center sticky top-0">
              <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-red-200"
              >
                <FaTimes size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-lg mb-3 text-teal-700">Navigation</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">F2</span>
                      <span>Focus search bar</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Enter</span>
                      <span>Navigate from search to product grid</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">↑ ↓ ← →</span>
                      <span>Navigate product grid</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Esc</span>
                      <span>Return to search / Close dialogs</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Alt+D</span>
                      <span>Go to Dashboard</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Alt+P</span>
                      <span>Return to POS</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-3 text-teal-700">Products & Cart</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Enter</span>
                      <span>Add selected product to cart</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">+</span>
                      <span>Increase last item quantity</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">-</span>
                      <span>Decrease last item quantity</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-3 text-teal-700">Checkout</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">F8</span>
                      <span>Focus discount input</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Shift</span>
                      <span>Process payment</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Delete</span>
                      <span>Cancel order</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-3 text-teal-700">Receipt</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Enter</span>
                      <span>Save & print receipt</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Esc</span>
                      <span>Close receipt without printing</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-3 text-teal-700">Dashboard</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">1-4</span>
                      <span>Switch dashboard tabs</span>
                    </li>
                    <li className="flex items-center">
                      <span className="bg-gray-200 px-2 py-1 rounded mr-2 font-mono">Alt+S</span>
                      <span>Search within dashboard</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <button
                onClick={() => setIsOpen(false)}
                className="mt-6 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 mx-auto block"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KeyboardShortcuts;