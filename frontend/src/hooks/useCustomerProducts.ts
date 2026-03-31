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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { businessApi } from '@/services/businessApi';

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
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState<string | number | undefined>(initialCustomerId);

  const allProductsQuery = useQuery({
    queryKey: ['system', 'products', { is_active: true }],
    queryFn: async () => {
      const response = await businessApi.get('system/products/', {
        params: { is_active: true, page_size: 500 },
      });
      const data = (response.data as { results?: Product[] } | Product[]);
      return Array.isArray(data) ? data : data.results ?? [];
    },
  });

  const customerQuery = useQuery({
    queryKey: ['customers', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const response = await businessApi.get<Customer>(`customers/${customerId}/`);
      return response.data;
    },
  });

  const associatedProductsQuery = useQuery({
    queryKey: ['customers', customerId, 'products'],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const response = await businessApi.get<{ results?: Product[] } | Product[]>(`customers/${customerId}/products/`);
      const data = Array.isArray(response.data) ? response.data : response.data.results;
      return Array.isArray(data) ? data : [];
    },
  });

  const customerPreferences = customerQuery.data?.preferred_protein_types ?? [];

  const suggestedProductsQuery = useQuery({
    queryKey: ['system', 'products', { is_active: true, protein: customerPreferences }],
    enabled: customerPreferences.length > 0,
    queryFn: async () => {
      const normalizedProteins = customerPreferences
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
    },
  });

  const fetchProductsByProteinTypes = useCallback(
    async (proteinTypes: string[]): Promise<Product[]> => {
      if (!proteinTypes || proteinTypes.length === 0) {
        return allProductsQuery.data ?? [];
      }

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
    },
    [allProductsQuery.data]
  );

  const fetchProductsForCustomer = useCallback(async (custId: string | number) => {
    setCustomerId(custId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customers', custId] }),
      queryClient.invalidateQueries({ queryKey: ['customers', custId, 'products'] }),
    ]);
  }, [queryClient]);

  const allProducts = allProductsQuery.data ?? [];
  const associatedProducts = associatedProductsQuery.data ?? [];
  const suggestedProducts = suggestedProductsQuery.data ?? [];

  const loading =
    allProductsQuery.isLoading ||
    customerQuery.isLoading ||
    associatedProductsQuery.isLoading ||
    suggestedProductsQuery.isLoading;

  const error =
    (allProductsQuery.error instanceof Error ? allProductsQuery.error.message : null) ||
    (customerQuery.error instanceof Error ? customerQuery.error.message : null) ||
    (associatedProductsQuery.error instanceof Error ? associatedProductsQuery.error.message : null) ||
    (suggestedProductsQuery.error instanceof Error ? suggestedProductsQuery.error.message : null);

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
    await queryClient.invalidateQueries({ queryKey: ['system', 'products'] });
    if (customerId) {
      await queryClient.invalidateQueries({ queryKey: ['customers', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'products'] });
    }
  }, [customerId, queryClient]);

  // Initial load
  useEffect(() => {
    if (initialCustomerId) {
      setCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

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
