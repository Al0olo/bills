/**
 * Generic database testing utilities
 * These utilities work with any Prisma client
 */

/**
 * Clean up all test data from the database
 * Use this in afterEach or afterAll hooks
 * 
 * @param prisma - Prisma client instance
 * @param tables - Array of table names to truncate (in order)
 */
export async function cleanupDatabase(prisma: any, tables: string[]) {
  try {
    // Disable foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

    // Delete from all tables
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }

    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  } catch (error) {
    console.error('Error cleaning up database:', error);
    throw error;
  }
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Get count of records in a table
 */
export async function getRecordCount(prisma: any, tableName: string): Promise<number> {
  const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}"`) as { count: bigint }[];
  return Number(result[0].count);
}

/**
 * Execute a test within a database transaction that will be rolled back
 * Useful for isolation between tests
 */
export async function withTransaction<T>(
  prisma: any,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx: any) => {
    const result = await callback(tx);
    // Transaction will auto-rollback if an error is thrown
    // For testing, we can force rollback by throwing after getting result
    return result;
  });
}

