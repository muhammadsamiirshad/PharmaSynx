"use client";

import React, { useState, useEffect } from 'react';
import { FaTimes, FaSearch, FaEdit } from 'react-icons/fa';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  photo?: string;
}

// Update the StockModalsProps interface
interface StockModalsProps {
  showStockModal: boolean;
  showAddStockModal: boolean;
  setShowStockModal: (show: boolean) => void;
  setShowAddStockModal: (show: boolean) => void;
  productToStock?: Product; // Add this line
}

// Update the component implementation
const StockModals: React.FC<StockModalsProps> = ({
  showStockModal,
  showAddStockModal,
  setShowStockModal,
  setShowAddStockModal,
  productToStock
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockAmount, setStockAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      if (showStockModal) {
        try {
          setLoading(true);
          const response = await fetch('http://localhost:5000/api/products');
          if (!response.ok) throw new Error('Failed to fetch products');
          const data = await response.json();
          
          // Transform the data to handle categories properly
          const productsWithCategories = data.map((product: any) => ({
            ...product,
            category: product.category || ''  // Use empty string as fallback
          }));
          
          setProducts(productsWithCategories);
        } catch (err) {
          console.error('Error:', err);
          setError('Failed to load products');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    // Set up SSE connection for real-time updates
    const eventSource = new EventSource('http://localhost:5000/api/updates');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'product_update') {
          setProducts(prevProducts => {
            const index = prevProducts.findIndex(p => p.id === data.product.id);
            if (index >= 0) {
              const updatedProducts = [...prevProducts];
              updatedProducts[index] = {
                ...data.product,
                category: data.product.category || 'Uncategorized'
              };
              return updatedProducts;
            }
            return prevProducts;
          });
        }
      } catch (error) {
        console.error('Error processing update:', error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [showStockModal]);

  // Add this useEffect to handle stock updates from the dashboard
  useEffect(() => {
    if (productToStock) {
      setSelectedProduct(productToStock);
      setShowAddStockModal(true);
    }
  }, [productToStock]);

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !stockAmount.trim()) {
      setError('Please enter stock amount');
      return;
    }
  
    const amount = parseInt(stockAmount);
    if (isNaN(amount) || amount < 0) {
      setError('Please enter a valid positive number');
      return;
    }
  
    setIsUpdating(true);
    setError('');
  
    try {
      // This is the important change - we're using the exact amount entered
      // to ADD to the existing stock, not replace it
      const response = await fetch(`http://localhost:5000/api/products/${selectedProduct.id}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          stock: selectedProduct.stock + amount,  // Add to existing stock
          action: 'add'  // Specify this is an addition
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to update stock');
      }
  
      // Success - close the modal
      setShowAddStockModal(false);
      setSelectedProduct(null);
      setStockAmount('');
  
    } catch (error) {
      console.error('Error updating stock:', error);
      setError(error instanceof Error ? error.message : 'Failed to update stock');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {showStockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-emerald-100 rounded-xl w-[1000px] h-[600px] flex flex-col">
            <div className="bg-teal-600 p-4 rounded-t-xl flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Stock Management</h2>
              <button
                onClick={() => setShowStockModal(false)}
                className="text-white hover:text-red-200 transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <div className="p-4 flex flex-col h-[530px]">
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <FaSearch className="absolute left-3 top-3 text-black" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 pl-10 border border-gray-200 bg-white rounded-full shadow-lg text-black"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-lg shadow-lg">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[30%]" /> {/* Name column */}
                    <col className="w-[20%]" /> {/* Category column */}
                    <col className="w-[15%]" /> {/* Current Stock column */}
                    <col className="w-[15%]" /> {/* Unit column */}
                    <col className="w-[20%]" /> {/* Actions column */}
                  </colgroup>
                  <thead className="bg-teal-500 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left font-semibold tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left font-semibold tracking-wider">Current Stock</th>
                      <th className="px-6 py-3 text-left font-semibold tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-center font-semibold tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white overflow-y-auto">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                            <span className="ml-2 text-gray-700">Loading products...</span>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-red-500">{error}</td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          No products found matching your search
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50 text-black">
                          <td className="px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis">{product.name}</td>
                          <td className="px-6 py-4 text-left text-sm text-black">
                            {product.category || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium">
                            {product.stock}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{product.unit}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowAddStockModal(true);
                                setStockAmount('');
                                setError(null);
                              }}
                              className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors"
                            >
                              Add Stock
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[400px] flex flex-col shadow-2xl">
            <div className="bg-teal-600 p-4 rounded-t-xl flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Update Stock</h2>
              <button
                onClick={() => {
                  setShowAddStockModal(false);
                  setSelectedProduct(null);
                  setStockAmount('');
                  setError('');
                }}
                className="text-white hover:text-red-200"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleUpdateStock} className="space-y-4">
                <div>
                  <p className="text-gray-700 mb-2">
                    <span className="font-bold">Product:</span> {selectedProduct.name}
                  </p>
                  <p className="text-gray-700 mb-4">
                    <span className="font-bold">Current Stock:</span> {selectedProduct.stock} {selectedProduct.unit}
                  </p>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Stock Amount
                  </label>
                  {error && (
                    <p className="text-red-500 text-sm mb-2">{error}</p>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={stockAmount}
                    onChange={(e) => setStockAmount(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-teal-500 text-black"
                    placeholder="Enter amount to add"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleUpdateStock(e);
                      }
                      if (e.key === 'Escape') {
                        setShowAddStockModal(false);
                        setSelectedProduct(null);
                        setStockAmount('');
                        setError('');
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddStockModal(false);
                      setSelectedProduct(null);
                      setStockAmount('');
                      setError('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center"
                  >
                    {isUpdating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      'Update Stock'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StockModals;