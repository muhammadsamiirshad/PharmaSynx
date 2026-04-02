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
  base_stock?: number;
  strips_per_box?: number;
  tabs_per_strip?: number;
  price_per_box?: number;
  price_per_strip?: number;
  price_per_tablet?: number;
  price_per_level_1?: string;
  price_per_level_2?: string;
  price_per_level_3?: string;
  conversion_1_to_2?: string;
  conversion_2_to_3?: string;
  opening_balance_base?: string;
  unit: string;
  defaultQty: number;
  photo: string;
  expiry_date: string; // Changed from expiryDate to match SQLite
}

interface CategoryConfig {
  id: number;
  name: string;
  unit_levels: number;
  level_1_name: string;
  level_2_name?: string | null;
  level_3_name?: string | null;
  conversion_1_to_2?: number | null;
  conversion_2_to_3?: number | null;
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
    price_per_level_1: '',
    price_per_level_2: '',
    price_per_level_3: '',
    conversion_1_to_2: '',
    conversion_2_to_3: '',
    opening_balance_base: '',
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
  const [categories, setCategories] = useState<CategoryConfig[]>([]);

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
      const unitLevels = Math.min(3, Math.max(1, Number((productToEdit as any).unit_config?.unit_levels ?? 1)));
      const p = productToEdit as any;
      setEditingProduct({
        ...productToEdit,
        price_per_level_1: String(p.price_per_box ?? p.price ?? ''),
        price_per_level_2: unitLevels >= 2 ? String(p.price_per_strip ?? '') : '',
        price_per_level_3: unitLevels === 3 ? String(p.price_per_tablet ?? '') : '',
        conversion_1_to_2: unitLevels >= 2 ? String((p.unit_config?.conversion_1_to_2 ?? p.strips_per_box ?? '')) : '',
        conversion_2_to_3: unitLevels === 3 ? String((p.unit_config?.conversion_2_to_3 ?? p.tabs_per_strip ?? '')) : '',
        opening_balance_base: String(p.base_stock ?? p.stock ?? 0)
      });
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

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setCategories(data);
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    };

    fetchCategories();
  }, []);

  const getCategoryConfig = (categoryName: string): CategoryConfig | undefined => {
    return categories.find((c) => c.name === categoryName);
  };

  const getEffectiveConfig = (categoryName: string) => {
    const config = getCategoryConfig(categoryName);
    const unitLevels = Math.min(3, Math.max(1, Number(config?.unit_levels ?? 1)));
    const level1Name = config?.level_1_name || 'Unit';
    const level2Name = config?.level_2_name || 'Sub Unit';
    const level3Name = config?.level_3_name || 'Item';
    const conversion1To2 = Math.max(1, Number(config?.conversion_1_to_2 ?? 1));
    const conversion2To3 = Math.max(1, Number(config?.conversion_2_to_3 ?? 1));

    return {
      unitLevels,
      level1Name,
      level2Name,
      level3Name,
      conversion1To2,
      conversion2To3
    };
  };

  const buildProductPayloadFromDynamicFields = (source: any) => {
    const categoryConfig = getCategoryConfig(source.category || '');
    const categoryId = categoryConfig?.id || null;
    const config = getEffectiveConfig(source.category || '');
    const unitLevels = config.unitLevels;

    const price1 = parseFloat(source.price_per_level_1 || '0') || 0;
    const price2 = unitLevels >= 2 ? (parseFloat(source.price_per_level_2 || '0') || 0) : 0;
    const price3 = unitLevels === 3 ? (parseFloat(source.price_per_level_3 || '0') || 0) : 0;
    const baseStock = parseInt(source.opening_balance_base || '0', 10) || 0;

    return {
      name: source.name,
      generic_name: source.generic_name || '',
      category_id: categoryId,
      price_per_box: price1,
      price_per_strip: unitLevels >= 2 ? price2 : null,
      price_per_tablet: unitLevels === 3 ? price3 : null,
      base_stock: baseStock
    };
  };

  const handleNewCategoryChange = (categoryName: string) => {
    const config = getEffectiveConfig(categoryName);
    setNewProduct((prev) => ({
      ...prev,
      category: categoryName,
      unit: config.unitLevels === 3 ? config.level3Name : config.unitLevels === 2 ? config.level2Name : config.level1Name,
      conversion_1_to_2: config.unitLevels >= 2 ? String(config.conversion1To2) : '',
      conversion_2_to_3: config.unitLevels === 3 ? String(config.conversion2To3) : '',
      price_per_level_2: config.unitLevels >= 2 ? prev.price_per_level_2 : '',
      price_per_level_3: config.unitLevels === 3 ? prev.price_per_level_3 : ''
    }));
  };

  const handleEditingCategoryChange = (categoryName: string) => {
    if (!editingProduct) return;
    const config = getEffectiveConfig(categoryName);
    setEditingProduct({
      ...editingProduct,
      category: categoryName,
      unit: config.unitLevels === 3 ? config.level3Name : config.unitLevels === 2 ? config.level2Name : config.level1Name,
      conversion_1_to_2: config.unitLevels >= 2 ? String(config.conversion1To2) : '',
      conversion_2_to_3: config.unitLevels === 3 ? String(config.conversion2To3) : '',
      price_per_level_2: config.unitLevels >= 2 ? (editingProduct.price_per_level_2 || '') : '',
      price_per_level_3: config.unitLevels === 3 ? (editingProduct.price_per_level_3 || '') : ''
    });
  };

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

      if (!newProduct.category) {
        setError('Category is required');
        return;
      }

      if (!newProduct.price_per_level_1 || isNaN(parseFloat(newProduct.price_per_level_1.toString()))) {
        setError('Valid Level 1 price is required');
        return;
      }

      const productToAdd = buildProductPayloadFromDynamicFields(newProduct);

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
        price_per_level_1: '',
        price_per_level_2: '',
        price_per_level_3: '',
        conversion_1_to_2: '',
        conversion_2_to_3: '',
        opening_balance_base: '',
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
      const updatedProduct = {
        id: editingProduct.id,
        ...buildProductPayloadFromDynamicFields(editingProduct)
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
              <select
                value={editingProduct.category}
                onChange={(e) => handleEditingCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border rounded text-gray-700"
                required
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select>
            </div>

            {editingProduct.category && (() => {
              const cfg = getEffectiveConfig(editingProduct.category);
              const smallestUnit = cfg.unitLevels === 3 ? cfg.level3Name : cfg.unitLevels === 2 ? cfg.level2Name : cfg.level1Name;
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Price per {cfg.level1Name}</label>
                    <input
                      type="number"
                      value={editingProduct.price_per_level_1 || ''}
                      onChange={(e) => setEditingProduct({...editingProduct, price_per_level_1: e.target.value})}
                      className="w-full px-3 py-2 border rounded text-gray-700"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  {cfg.unitLevels >= 2 && (
                    <div className="mb-4">
                      <label className="block text-gray-700 mb-2">Price per {cfg.level2Name}</label>
                      <input
                        type="number"
                        value={editingProduct.price_per_level_2 || ''}
                        onChange={(e) => setEditingProduct({...editingProduct, price_per_level_2: e.target.value})}
                        className="w-full px-3 py-2 border rounded text-gray-700"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  )}

                  {cfg.unitLevels === 3 && (
                    <div className="mb-4">
                      <label className="block text-gray-700 mb-2">Price per {cfg.level3Name}</label>
                      <input
                        type="number"
                        value={editingProduct.price_per_level_3 || ''}
                        onChange={(e) => setEditingProduct({...editingProduct, price_per_level_3: e.target.value})}
                        className="w-full px-3 py-2 border rounded text-gray-700"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  )}

                  {cfg.unitLevels > 1 && (
                    <div className="mb-4">
                      <label className="block text-gray-700 mb-2">{cfg.level2Name} per {cfg.level1Name}</label>
                      <input
                        type="number"
                        value={editingProduct.conversion_1_to_2 || ''}
                        onChange={(e) => setEditingProduct({...editingProduct, conversion_1_to_2: e.target.value})}
                        className="w-full px-3 py-2 border rounded text-gray-700"
                        min="1"
                        step="1"
                        required
                      />
                    </div>
                  )}

                  {cfg.unitLevels === 3 && (
                    <div className="mb-4">
                      <label className="block text-gray-700 mb-2">{cfg.level3Name} per {cfg.level2Name}</label>
                      <input
                        type="number"
                        value={editingProduct.conversion_2_to_3 || ''}
                        onChange={(e) => setEditingProduct({...editingProduct, conversion_2_to_3: e.target.value})}
                        className="w-full px-3 py-2 border rounded text-gray-700"
                        min="1"
                        step="1"
                        required
                      />
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Opening Balance ({smallestUnit})</label>
                    <input
                      type="number"
                      value={editingProduct.opening_balance_base || ''}
                      onChange={(e) => setEditingProduct({...editingProduct, opening_balance_base: e.target.value})}
                      className="w-full px-3 py-2 border rounded text-gray-700"
                      min="0"
                      step="1"
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
              );
            })()}
            
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
                <select
                  value={newProduct.category}
                  onChange={(e) => handleNewCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
                </select>
              </div>

              {newProduct.category && (() => {
                const cfg = getEffectiveConfig(newProduct.category);
                const smallestUnit = cfg.unitLevels === 3 ? cfg.level3Name : cfg.unitLevels === 2 ? cfg.level2Name : cfg.level1Name;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mb-4">
                      <label className="block text-gray-700 mb-2">Price per {cfg.level1Name}</label>
                      <input
                        type="number"
                        value={newProduct.price_per_level_1}
                        onChange={(e) => setNewProduct({...newProduct, price_per_level_1: e.target.value})}
                        className="w-full px-3 py-2 border rounded text-gray-700"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    {cfg.unitLevels >= 2 && (
                      <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Price per {cfg.level2Name}</label>
                        <input
                          type="number"
                          value={newProduct.price_per_level_2}
                          onChange={(e) => setNewProduct({...newProduct, price_per_level_2: e.target.value})}
                          className="w-full px-3 py-2 border rounded text-gray-700"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    )}

                    {cfg.unitLevels === 3 && (
                      <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Price per {cfg.level3Name}</label>
                        <input
                          type="number"
                          value={newProduct.price_per_level_3}
                          onChange={(e) => setNewProduct({...newProduct, price_per_level_3: e.target.value})}
                          className="w-full px-3 py-2 border rounded text-gray-700"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    )}

                    {cfg.unitLevels > 1 && (
                      <div className="mb-4">
                        <label className="block text-gray-700 mb-2">{cfg.level2Name} per {cfg.level1Name}</label>
                        <input
                          type="number"
                          value={newProduct.conversion_1_to_2}
                          onChange={(e) => setNewProduct({...newProduct, conversion_1_to_2: e.target.value})}
                          className="w-full px-3 py-2 border rounded text-gray-700"
                          min="1"
                          step="1"
                          required
                        />
                      </div>
                    )}

                    {cfg.unitLevels === 3 && (
                      <div className="mb-4">
                        <label className="block text-gray-700 mb-2">{cfg.level3Name} per {cfg.level2Name}</label>
                        <input
                          type="number"
                          value={newProduct.conversion_2_to_3}
                          onChange={(e) => setNewProduct({...newProduct, conversion_2_to_3: e.target.value})}
                          className="w-full px-3 py-2 border rounded text-gray-700"
                          min="1"
                          step="1"
                          required
                        />
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-gray-700 mb-2">Opening Balance ({smallestUnit})</label>
                      <input
                        type="number"
                        value={newProduct.opening_balance_base}
                        onChange={(e) => setNewProduct({...newProduct, opening_balance_base: e.target.value})}
                        className="w-full px-3 py-2 border rounded text-gray-700"
                        min="0"
                        step="1"
                        required
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
                );
              })()}
              
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
                <select
                  value={editingProduct.category}
                  onChange={(e) => handleEditingCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-gray-700"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
                </select>
              </div>

              {editingProduct.category && (() => {
                const cfg = getEffectiveConfig(editingProduct.category);
                const smallestUnit = cfg.unitLevels === 3 ? cfg.level3Name : cfg.unitLevels === 2 ? cfg.level2Name : cfg.level1Name;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mb-4">
                      <label className="block text-gray-700 mb-2">Price per {cfg.level1Name}</label>
                      <input
                        type="number"
                        value={editingProduct.price_per_level_1 || ''}
                        onChange={(e) => setEditingProduct({...editingProduct, price_per_level_1: e.target.value})}
                        className="w-full px-3 py-2 border rounded text-gray-700"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    {cfg.unitLevels >= 2 && (
                      <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Price per {cfg.level2Name}</label>
                        <input
                          type="number"
                          value={editingProduct.price_per_level_2 || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, price_per_level_2: e.target.value})}
                          className="w-full px-3 py-2 border rounded text-gray-700"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    )}

                    {cfg.unitLevels === 3 && (
                      <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Price per {cfg.level3Name}</label>
                        <input
                          type="number"
                          value={editingProduct.price_per_level_3 || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, price_per_level_3: e.target.value})}
                          className="w-full px-3 py-2 border rounded text-gray-700"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    )}

                    {cfg.unitLevels > 1 && (
                      <div className="mb-4">
                        <label className="block text-gray-700 mb-2">{cfg.level2Name} per {cfg.level1Name}</label>
                        <input
                          type="number"
                          value={editingProduct.conversion_1_to_2 || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, conversion_1_to_2: e.target.value})}
                          className="w-full px-3 py-2 border rounded text-gray-700"
                          min="1"
                          step="1"
                          required
                        />
                      </div>
                    )}

                    {cfg.unitLevels === 3 && (
                      <div className="mb-4">
                        <label className="block text-gray-700 mb-2">{cfg.level3Name} per {cfg.level2Name}</label>
                        <input
                          type="number"
                          value={editingProduct.conversion_2_to_3 || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, conversion_2_to_3: e.target.value})}
                          className="w-full px-3 py-2 border rounded text-gray-700"
                          min="1"
                          step="1"
                          required
                        />
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-gray-700 mb-2">Opening Balance ({smallestUnit})</label>
                      <input
                        type="number"
                        value={editingProduct.opening_balance_base || ''}
                        onChange={(e) => setEditingProduct({...editingProduct, opening_balance_base: e.target.value})}
                        className="w-full px-3 py-2 border rounded text-gray-700"
                        min="0"
                        step="1"
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
                );
              })()}
              
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


