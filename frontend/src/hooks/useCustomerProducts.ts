/**
 * useCustomerProducts Hook
 * 
 * Fetches and manages products based on customer preferences.
 * Auto-populates products filtered by customer's preferred_protein_types.
 * Supports manual selection as fallback.
 * 
 * Usage:
 *   const {
 *     products,
 *     suggestedProducts,
 *     loading,
 *     error,
 *     fetchProductsForCustomer,
 *     searchProducts,
 *   } = useCustomerProducts(customerId);
 */
import { useState, useCallback, useEffect } from 'react';
import { businessApi } from '../services/businessApi';

// Types
export interface Product {
  id: number | string;
  product_code: string;
  description_of_product_item?: string;
  description?: string;
  type_of_protein?: string;
  fresh_or_frozen?: string;
  package_type?: string;
  unit_weight?: number;
  supplier?: number | string;
  supplier_name?: string;
  is_active?: boolean;
}

export interface Customer {
  id: number | string;
  name: string;
  preferred_protein_types?: string[];
  products?: number[] | string[];
}

export interface UseCustomerProductsReturn {
  /** All products (unfiltered) */
  allProducts: Product[];
  /** Products filtered by customer preferences */
  suggestedProducts: Product[];
  /** Currently associated products */
  associatedProducts: Product[];
  /** Customer's preferred protein types */
  customerPreferences: string[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Fetch products for a specific customer */
  fetchProductsForCustomer: (customerId: string | number) => Promise<void>;
  /** Fetch products by protein types */
  fetchProductsByProteinTypes: (proteinTypes: string[]) => Promise<Product[]>;
  /** Search all products */
  searchProducts: (query: string) => Promise<Product[]>;
  /** Get product by ID */
  getProductById: (productId: string | number) => Product | undefined;
  /** Check if a product is suggested based on customer preferences */
  isSuggestedProduct: (productId: string | number) => boolean;
  /** Refresh data */
  refresh: () => Promise<void>;
}

export function useCustomerProducts(
  initialCustomerId?: string | number
): UseCustomerProductsReturn {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [associatedProducts, setAssociatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | number | undefined>(initialCustomerId);
  const [customerPreferences, setCustomerPreferences] = useState<string[]>([]);

  // Fetch all products
  const fetchAllProducts = useCallback(async () => {
    try {
      const response = await businessApi.get('system/products/', {
        params: { is_active: true, page_size: 500 },
      });
      const data = response.data.results || response.data;
      const products = Array.isArray(data) ? data : [];
      setAllProducts(products);
      return products;
    } catch (err: any) {
      console.error('Failed to fetch all products:', err);
      setError(err.message || 'Failed to fetch products');
      return [];
    }
  }, []);

  // Fetch products filtered by protein types
  const fetchProductsByProteinTypes = useCallback(async (proteinTypes: string[]): Promise<Product[]> => {
    if (!proteinTypes || proteinTypes.length === 0) {
      return allProducts;
    }

    try {
      // Build query string with multiple protein parameters
      const normalizedProteins = proteinTypes
        .map((t) => String(t).toLowerCase().trim())
        .filter(Boolean);

      const response = await businessApi.get<{ results?: Product[] } | Product[]>('system/products/', {
        params: {
          is_active: true,
          protein: normalizedProteins,
          page_size: 500,
        },
      });
      const data = Array.isArray(response.data) ? response.data : response.data.results;
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.error('Failed to fetch products by protein types:', err);
      return [];
    }
  }, [allProducts]);

  // Fetch customer details and associated products
  const fetchProductsForCustomer = useCallback(async (custId: string | number) => {
    setLoading(true);
    setError(null);
    setCustomerId(custId);

    try {
      // Fetch customer details
      const customerResponse = await businessApi.get<Customer>(`customers/${custId}/`);
      const customer = customerResponse.data;
      const preferences = customer.preferred_protein_types || [];
      setCustomerPreferences(preferences);

      // Fetch associated products
      const associatedResponse = await businessApi.get<{ results?: Product[] } | Product[]>(`customers/${custId}/products/`);
      const associatedData = Array.isArray(associatedResponse.data)
        ? associatedResponse.data
        : associatedResponse.data.results;
      const associated = Array.isArray(associatedData) ? associatedData : [];
      setAssociatedProducts(associated);

      // Fetch suggested products based on preferences
      if (preferences.length > 0) {
        const suggested = await fetchProductsByProteinTypes(preferences);
        setSuggestedProducts(suggested);
      } else {
        setSuggestedProducts([]);
      }

      // Ensure we have all products loaded
      if (allProducts.length === 0) {
        await fetchAllProducts();
      }
    } catch (err: any) {
      console.error('Failed to fetch products for customer:', err);
      setError(err.message || 'Failed to fetch customer products');
    } finally {
      setLoading(false);
    }
  }, [allProducts.length, fetchAllProducts, fetchProductsByProteinTypes]);

  // Search products
  const searchProducts = useCallback(async (query: string): Promise<Product[]> => {
    if (!query.trim()) {
      return allProducts;
    }

    try {
      const response = await businessApi.get<{ results?: Product[] } | Product[]>('system/products/', {
        params: { search: query, is_active: true, page_size: 50 },
      });
      const data = Array.isArray(response.data) ? response.data : response.data.results;
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.error('Failed to search products:', err);
      return [];
    }
  }, [allProducts]);

  // Get product by ID
  const getProductById = useCallback((productId: string | number): Product | undefined => {
    return allProducts.find(p => String(p.id) === String(productId));
  }, [allProducts]);

  // Check if product is suggested
  const isSuggestedProduct = useCallback((productId: string | number): boolean => {
    return suggestedProducts.some(p => String(p.id) === String(productId));
  }, [suggestedProducts]);

  // Refresh data
  const refresh = useCallback(async () => {
    await fetchAllProducts();
    if (customerId) {
      await fetchProductsForCustomer(customerId);
    }
  }, [customerId, fetchAllProducts, fetchProductsForCustomer]);

  // Initial load
  useEffect(() => {
    void fetchAllProducts();
    if (initialCustomerId) {
      void fetchProductsForCustomer(initialCustomerId);
    }
  }, [fetchAllProducts, fetchProductsForCustomer, initialCustomerId]);

  return {
    allProducts,
    suggestedProducts,
    associatedProducts,
    customerPreferences,
    loading,
    error,
    fetchProductsForCustomer,
    fetchProductsByProteinTypes,
    searchProducts,
    getProductById,
    isSuggestedProduct,
    refresh,
  };
}

export default useCustomerProducts;
