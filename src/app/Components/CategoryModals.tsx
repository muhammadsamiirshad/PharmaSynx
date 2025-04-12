import React, { useState, useEffect } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';

export interface Category {
  id: number;  // Changed from _id: string
  name: string;
  description: string;
}

interface CategoryModalsProps {
  showAddModal: boolean;
  showListModal: boolean;
  setShowAddModal: (show: boolean) => void;
  setShowListModal: (show: boolean) => void;
}

const CategoryModals: React.FC<CategoryModalsProps> = ({
  showAddModal,
  showListModal,
  setShowAddModal,
  setShowListModal
}) => {
  const [newCategory, setNewCategory] = useState<Omit<Category, 'id'>>({ 
    name: '', 
    description: '' 
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch('http://localhost:5000/api/categories', {
          headers: {
            'Accept': 'application/json'
          }
        });

        // Get response text first
        const text = await response.text();

        // Try to parse as JSON
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('Server response:', text);
          throw new Error('Invalid JSON response from server');
        }

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch categories');
        }

        setCategories(data);

      } catch (error) {
        console.error('Error:', error);
        setError(error instanceof Error ? error.message : 'Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    if (showListModal) {
      fetchCategories();
    }
  }, [showListModal]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCategory)
      });

      if (!response.ok) {
        throw new Error('Failed to add category');
      }

      const addedCategory = await response.json();
      setCategories(prev => [...prev, addedCategory]);
      setShowAddModal(false);
      setNewCategory({ name: '', description: '' });
      setError('');
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
        if (!window.confirm('Are you sure you want to delete this category?')) {
            return;
        }

        const response = await fetch(`http://localhost:5000/api/categories/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        // Handle non-JSON responses
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`Invalid response: ${text}`);
        }

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete category');
        }

        setCategories(prevCategories => 
            prevCategories.filter(category => category.id !== id)
        );

        alert('Category deleted successfully');

    } catch (error) {
        console.error('Delete category error:', error);
        alert(error instanceof Error ? error.message : 'Failed to delete category');
    }
};

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-emerald-100 p-6 rounded-lg w-96 text-black relative">
            {/* Add close button at top right */}
            <button
              onClick={() => {
                setShowAddModal(false);
                setError('');
                setNewCategory({ name: '', description: '' });
              }}
              className="absolute top-2 right-2 text-gray-600 hover:text-red-500 transition-colors"
            >
              <FaTimes size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4 text-teal-600">Add New Category</h2>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleAddCategory}>
              <div className="mb-4">
                <label className="block text-gray-700  mb-2">Category Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-full shadow-xl text-center"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-xl shadow-xl text-center"
                  rows={3}
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-red-500 hover:bg-red-700 text-white rounded-xl shadow-xl"
                  onClick={() => {
                    setShowAddModal(false);
                    setError('');
                    setNewCategory({ name: '', description: '' });
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List Categories Modal */}
      {showListModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-emerald-100 p-6 rounded-xl w-[1000px] h-[600px]  relative">
            {/* Add close button at top right */}
            <button
              onClick={() => setShowListModal(false)}
              className="absolute top-4 right-4 text-gray-600 hover:text-red-500 transition-colors"
            >
              <FaTimes size={24} />
            </button>

            <h2 className="text-2xl font-bold mb-6 text-teal-700 text-center">
              Categories Management
            </h2>

            {/* Add search bar */}
            <div className="mb-6 relative">
              <div className="relative flex items-center ">
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 pr-4 rounded-xl text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <div className="absolute left-3 text-black">
                <FaSearch  size={16} />

                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
                <p className="mt-2 text-teal-700">Loading categories...</p>
              </div>
            ) : error ? (
              <div className="text-center py-4 text-red-500">
                <p>{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-teal-500 hover:text-teal-600"
                >
                  Try again
                </button>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center text-black py-4">
                {searchTerm ? `No categories found matching "${searchTerm}"` : 'No categories available'}
              </div>
            ) : (

              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Fixed header */}
                <div className="sticky top-0 z-10">
                  <table className="w-full">
                    <thead className="bg-teal-500">
                      <tr className="text-white">
                        <th className="w-16 px-6 py-3 text-left font-bold uppercase tracking-wider">
                          ID
                        </th>
                        <th className="w-1/3 px-6 py-3 text-left font-bold uppercase tracking-wider">
                          Name
                        </th>
                        <th className="w-1/2 px-6 py-3 text-left font-bold uppercase tracking-wider">
                          Description
                        </th>
                        <th className="w-32 px-6 py-3 text-center font-bold uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto max-h-[60vh]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredCategories.map((category: Category, index: number) => (
                        <tr key={category.id} className="hover:bg-gray-50 transition-colors text-black">
                          <td className="w-16 px-6 py-2 text-left whitespace-nowrap text-sm">
                            {index + 1}
                          </td>
                          <td className="w-1/3 px-6 py-2 text-left whitespace-nowrap font-medium">
                            {category.name}
                          </td>
                          <td className="w-1/2 px-6 py-2 text-left whitespace-nowrap text-sm">
                            {category.description}
                          </td>
                          <td className="w-32 px-6 py-2 text-center whitespace-nowrap">
                            <button
                              className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded-lg 
                                         transition-colors duration-200 inline-flex items-center space-x-1"
                              onClick={() => handleDeleteCategory(category.id)}
                            >
                              <FaTimes size={16} />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default CategoryModals;