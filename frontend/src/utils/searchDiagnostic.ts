/**
 * Search Diagnostic Utility
 * 
 * Helps diagnose why search isn't returning results.
 * Call from browser console: searchDiagnostic()
 */

import { apiClient } from '../services/apiService';

export const searchDiagnostic = async (query: string = 'test') => {
  console.group('🔍 Search Diagnostic');
  
  try {
    console.log('1. Testing search endpoint...');
    console.log('   Query:', query);
    
    const response = await apiClient.get('/search/universal/', {
      params: { q: query, limit: 10 }
    });
    
    console.log('2. Response received:', response);
    console.log('   Status:', response.status);
    console.log('   Data:', response.data);
    
    if (response.data.results) {
      console.log('3. Results found:', response.data.results.length);
      console.log('   Results by type:', response.data.counts);
      
      if (response.data.results.length === 0) {
        console.warn('⚠️ No results found. Possible reasons:');
        console.warn('   - No data in database for current tenant');
        console.warn('   - Search term too specific');
        console.warn('   - Tenant context not set properly');
      } else {
        console.log('✅ Search working! Sample results:');
        response.data.results.slice(0, 3).forEach((r: any) => {
          console.log(`   - ${r.type}: ${r.title}`);
        });
      }
    } else {
      console.error('❌ Invalid response format:', response.data);
    }
    
  } catch (error: any) {
    console.error('❌ Search failed:', error);
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data);
    console.error('   Full error:', error);
    
    if (error.response?.status === 401) {
      console.error('   Issue: Not authenticated');
    } else if (error.response?.status === 403) {
      console.error('   Issue: Missing tenant context or permissions');
    } else if (error.response?.status === 404) {
      console.error('   Issue: Endpoint not found - check URL');
    }
  }
  
  console.groupEnd();
};

// Make available globally in browser console
if (typeof window !== 'undefined') {
  (window as any).searchDiagnostic = searchDiagnostic;
}
