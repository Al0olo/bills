/**
 * Test utilities for subscription service
 * 
 * This module re-exports shared testing utilities from @bills/testing
 * and adds service-specific mocks and helpers.
 */

// Re-export shared testing utilities
export * from '@bills/testing';

// Export service-specific mocks
export * from './mock-prisma.service';
export * from './service-mocks';

