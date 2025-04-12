"use client";

import React, { useState, useEffect } from 'react';
import { FaTimes, FaSearch, FaPlus, FaImage, FaEdit } from 'react-icons/fa';
import { MdDeleteForever } from 'react-icons/md';
import Category from '../Components/CategoryModals';
import { createPortal } from 'react-dom';

export interface Product {
  id: number;  // Changed from string to number for SQLite
  name: string;
  description: string;
  category: string;  // Changed from category_id
  price: number;
  stock: number;
  unit: string;
  defaultQty: number;
  photo: string;
  expiry_date: string; // Changed from expiryDate to match SQLite
}

// Update the ProductModalsProps interface to include a new prop
interface ProductModalsProps {
  showAddModal: boolean;
  showListModal: boolean;
  setShowAddModal: (show: boolean) => void;
  setShowListModal: (show: boolean) => void;
  productToEdit?: Product; // Add this line
  editModeOnly?: boolean; // Add this new prop
}

const ProductModals: React.FC<ProductModalsProps> = ({
  showAddModal,
  showListModal,
  setShowAddModal,
  setShowListModal,
  productToEdit,
  editModeOnly = false // Default to false for backward compatibility
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',  // Changed from category_id
    price: '',
    unit: '',
    defaultQty: 1,
    photo: '',
    expiry_date: '' // Changed from expiryDate
  });
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Define closeAllModals function here so it's available in all modes
  const closeAllModals = () => {
    setShowAddModal(false);
    setShowListModal(false);
    setShowEditModal(false);
    setEditingProduct(null);
  };

  // Add this useEffect to handle mounting state
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Add this useEffect to handle editing products from dashboard
  useEffect(() => {
    if (productToEdit) {
      setEditingProduct(productToEdit);
      setShowEditModal(true);
    }
  }, [productToEdit]);

  // Filter products when search term or products change
  useEffect(() => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  useEffect(() => {
    if (showListModal) {
      fetchProducts();
    }
  }, [showListModal]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
        
      // Just map the data directly since category is now a string field
      const transformedData = data.map((product: any) => ({
        ...product,
        category: product.category || ''
      }));
        
      setProducts(transformedData);
      setFilteredProducts(transformedData);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Update the handleAddProduct function to properly handle expiry_date
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Validate the form
      if (!newProduct.name.trim()) {
        setError('Product name is required');
        return;
      }

      if (!newProduct.price || isNaN(parseFloat(newProduct.price.toString()))) {
        setError('Valid price is required');
        return;
      }

      // Create a proper product object with correctly typed values
      const productToAdd = {
        name: newProduct.name,
        description: newProduct.description || '',
        category: newProduct.category || 'Uncategorized',
        price: parseFloat(newProduct.price.toString()),
        stock: 0, // Default to 0 stock for new products
        unit: newProduct.unit || 'pcs',
        defaultQty: newProduct.defaultQty || 1,
        photo: newProduct.photo || '',
        expiry_date: newProduct.expiry_date || null // Make sure this is sent properly
      };

      console.log('Adding product with data:', productToAdd, 'Expiry date:', productToAdd.expiry_date);

      const response = await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productToAdd)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add product');
      }

      // Refresh the product list and reset the form
      await fetchProducts();
      setShowAddModal(false);
      setNewProduct({
        name: '',
        description: '',
        category: '',
        price: '',
        unit: '',
        defaultQty: 1,
        photo: '',
        expiry_date: ''
      });

    } catch (error) {
      console.error('Error adding product:', error);
      setError(error instanceof Error ? error.message : 'Failed to add product');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      if (!window.confirm('Are you sure you want to delete this product?')) {
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/products/${productId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      setProducts(prev => prev.filter(p => p.id !== productId));
      setFilteredProducts(prev => prev.filter(p => p.id !== productId));
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete product');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('File is too large. Maximum size is 1MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct({
          ...newProduct,
          photo: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    if (file.size > 1024 * 1024) {
      alert('File is too large. Maximum size is 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingProduct({
        ...editingProduct,
        photo: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  // Fix the handleEditProduct function to ensure expiry_date is properly sent
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      // Create a clean object with properly typed values
      const updatedProduct = {
        id: editingProduct.id,
        name: editingProduct.name,
        description: editingProduct.description || '',
        category: editingProduct.category || 'Uncategorized',
        price: typeof editingProduct.price === 'string' 
          ? parseFloat(editingProduct.price) 
          : editingProduct.price,
        stock: editingProduct.stock,
        unit: editingProduct.unit,
        defaultQty: editingProduct.defaultQty,
        photo: editingProduct.photo || '',
        expiry_date: editingProduct.expiry_date || null // Ensure expiry_date is properly sent
      };

      console.log('Updating product with data:', updatedProduct); // Debug log

      const response = await fetch(`http://localhost:5000/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedProduct)
      });

      // Check for error responses
      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || 'Failed to update product');
        } catch (e) {
          throw new Error(`Failed to update product: ${errorText}`);
        }
      }

      // Refresh the product list after successful update
      await fetchProducts();

      // Close the edit modal and reset state
      setShowEditModal(false);
      setEditingProduct(null);
      
      // If in edit-only mode, also close the outer modals
      if (editModeOnly) {
        closeAllModals();
      }
      
    } catch (error) {
      console.error('Error updating product:', error);
      setError(error instanceof Error ? error.message : 'Failed to update product');
    }
  };

  // Add this useEffect after your other useEffects
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:5000/api/products/updates');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'product_update' && data.product) {
          setProducts(prevProducts => {
            // Check if the product already exists
            const exists = prevProducts.some(p => p.id === data.product.id);
            
            if (exists) {
              // Update existing product
              return prevProducts.map(p => 
                p.id === data.product.id ? {
                  ...p,
                  ...data.product
                } : p
              );
            } else {
              // Add new product
              return [
                ...prevProducts,
                data.product
              ];
            }
          });
          
          // Update filtered products accordingly
          setFilteredProducts(prevFiltered => {
            const searchLower = searchTerm.toLowerCase();
            return products.filter(product => 
              product.name.toLowerCase().includes(searchLower) || 
              (product.category || '').toLowerCase().includes(searchLower)
            );
          });
        }
      } catch (error) {
        setError('Failed to process update');
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setTimeout(() => {
        eventSource.close();
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  if (!mounted) return null;
  if (!showListModal && !showAddModal && !showEditModal) return null;

  // If in edit-only mode and we have an editing product, only show the edit modal
  if (editModeOnly && editingProduct) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg w-[500px] max-w-[95%] max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-teal-700">Edit Product</h2>
            <button
              onClick={closeAllModals}
              className="text-gray-600 hover:text-red-500 transition-colors"
            >
              <FaTimes size={24} />
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleEditProduct}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Product Name</label>
              <input
                type="text"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                className="w-full px-3 py-2 border rounded text-gray-700"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Description</label>
              <textarea
                value={editingProduct.description}
                onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                className="w-full px-3 py-2 border rounded text-gray-700"
                rows={3}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Category</label>
              <input
                type="text"
                value={editingProduct.category}
                onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                className="w-full px-3 py-2 border rounded text-gray-700"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Price</label>
                <input
                  type="number"
                  value={typeof editingProduct.price === 'string' ? editingProduct.price : editingProduct.price.toString()}
                  onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Unit</label>
                <input
                  type="text"
                  value={editingProduct.unit}
                  onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  required
                />
              </div>
              
              
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Expiry Date</label>
                <input
                  type="date"
                  value={editingProduct.expiry_date || ''}
                  onChange={(e) => setEditingProduct({...editingProduct, expiry_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">
                Product Image 
                <span className="text-xs text-gray-500 ml-2">(Optional, max 1MB, 192x48px)</span>
              </label>
              
              <div className="flex items-center space-x-4">
                {editingProduct.photo && (
                  <div className="w-16 h-16 border rounded overflow-hidden">
                    <img 
                      src={editingProduct.photo} 
                      alt={editingProduct.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <label className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded cursor-pointer hover:bg-gray-300 transition-colors">
                  <FaImage className="mr-2" />
                  {editingProduct.photo ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditPhotoUpload}
                    className="hidden"
                  />
                </label>
                
                {editingProduct.photo && (
                  <button
                    type="button"
                    onClick={() => setEditingProduct({...editingProduct, photo: ''})}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeAllModals}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <>
      {/* Add Product Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAllModals();
            }
          }}
        >
          <div className="bg-white p-6 rounded-lg w-[500px] max-w-[95%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-teal-700">Add New Product</h2>
              <button
                onClick={closeAllModals}
                className="text-gray-600 hover:text-red-500 transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>
            
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleAddProduct}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Product Name</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  placeholder="Product name"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Description</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  placeholder="Product description"
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Category</label>
                <input
                  type="text"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  placeholder="Category name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Price</label>
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    className="w-full px-3 py-2 border rounded text-gray-700"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Unit</label>
                  <input
                    type="text"
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                    className="w-full px-3 py-2 border rounded text-gray-700"
                    placeholder="e.g., tablet, bottle"
                  />
                </div>
                
               
                
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Expiry Date</label>
                  <input
                    type="date"
                    value={newProduct.expiry_date}
                    onChange={(e) => setNewProduct({...newProduct, expiry_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded text-gray-700"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Product Image 
                  <span className="text-xs text-gray-500 ml-2">(Optional, max 1MB, 192x48px)</span>
                </label>
                
                <div className="flex items-center space-x-4">
                  {newProduct.photo && (
                    <div className="w-16 h-16 border rounded overflow-hidden">
                      <img 
                        src={newProduct.photo} 
                        alt="Product preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <label className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded cursor-pointer hover:bg-gray-300 transition-colors">
                    <FaImage className="mr-2" />
                    {newProduct.photo ? 'Change Image' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  
                  {newProduct.photo && (
                    <button
                      type="button"
                      onClick={() => setNewProduct({...newProduct, photo: ''})}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeAllModals}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List Products Modal */}
      
      
      {/* Edit Product Modal */}
      {showEditModal && editingProduct && !editModeOnly && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAllModals();
            }
          }}
        >
          <div className="bg-white p-6 rounded-lg w-[500px] max-w-[95%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-teal-700">Edit Product</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                }}
                className="text-gray-600 hover:text-red-500 transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleEditProduct}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Product Name</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Category</label>
                <input
                  type="text"
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-gray-700"
              />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Price</label>
                  <input
                    type="number"
                    value={typeof editingProduct.price === 'string' ? editingProduct.price : editingProduct.price.toString()}
                    onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded text-gray-700"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Unit</label>
                  <input
                    type="text"
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                    className="w-full px-3 py-2 border rounded text-gray-700"
                    required
                  />
                </div>
                
                
                
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Expiry Date</label>
                  <input
                    type="date"
                    value={editingProduct.expiry_date || ''}
                    onChange={(e) => setEditingProduct({...editingProduct, expiry_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded text-gray-700"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Product Image 
                  <span className="text-xs text-gray-500 ml-2">(Optional, max 1MB, 192x48px)</span>
                </label>
                
                <div className="flex items-center space-x-4">
                  {editingProduct.photo && (
                    <div className="w-16 h-16 border rounded overflow-hidden">
                      <img 
                        src={editingProduct.photo} 
                        alt={editingProduct.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <label className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded cursor-pointer hover:bg-gray-300 transition-colors">
                    <FaImage className="mr-2" />
                    {editingProduct.photo ? 'Change Image' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditPhotoUpload}
                      className="hidden"
                    />
                  </label>
                  
                  {editingProduct.photo && (
                    <button
                      type="button"
                      onClick={() => setEditingProduct({...editingProduct, photo: ''})}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default ProductModals;


