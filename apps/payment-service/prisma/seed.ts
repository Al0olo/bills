import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed for payment service...');

  // Clean existing data
  await prisma.idempotencyKey.deleteMany();
  await prisma.paymentTransaction.deleteMany();

  // Seed Payment Transactions
  await prisma.paymentTransaction.create({
    data: {
      id: 'a50e8400-e29b-41d4-a716-446655440001',
      externalReference: '750e8400-e29b-41d4-a716-446655440001', // subscription1
      amount: 9.99,
      currency: 'USD',
      status: 'SUCCESS',
      webhookSent: true,
      webhookRetryCount: 0,
      webhookLastAttempt: new Date('2025-01-01T10:05:00Z'),
      metadata: {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        planId: '650e8400-e29b-41d4-a716-446655440001',
        planName: 'Basic Monthly',
      },
      processedAt: new Date('2025-01-01T10:05:00Z'),
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      id: 'a50e8400-e29b-41d4-a716-446655440002',
      externalReference: '750e8400-e29b-41d4-a716-446655440002', // subscription2
      amount: 29.99,
      currency: 'USD',
      status: 'SUCCESS',
      webhookSent: true,
      webhookRetryCount: 0,
      webhookLastAttempt: new Date('2025-01-15T10:05:00Z'),
      metadata: {
        userId: '550e8400-e29b-41d4-a716-446655440002',
        planId: '650e8400-e29b-41d4-a716-446655440002',
        planName: 'Pro Monthly',
      },
      processedAt: new Date('2025-01-15T10:05:00Z'),
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      id: 'a50e8400-e29b-41d4-a716-446655440003',
      externalReference: '750e8400-e29b-41d4-a716-446655440003', // subscription3
      amount: 99.99,
      currency: 'USD',
      status: 'SUCCESS',
      webhookSent: true,
      webhookRetryCount: 0,
      webhookLastAttempt: new Date('2025-02-01T10:05:00Z'),
      metadata: {
        userId: '550e8400-e29b-41d4-a716-446655440003',
        planId: '650e8400-e29b-41d4-a716-446655440003',
        planName: 'Enterprise Monthly',
      },
      processedAt: new Date('2025-02-01T10:05:00Z'),
    },
  });

  // Failed payment transaction
  await prisma.paymentTransaction.create({
    data: {
      id: 'a50e8400-e29b-41d4-a716-446655440004',
      externalReference: '750e8400-e29b-41d4-a716-446655440004', // cancelled subscription
      amount: 9.99,
      currency: 'USD',
      status: 'FAILED',
      webhookSent: true,
      webhookRetryCount: 0,
      webhookLastAttempt: new Date('2024-12-01T10:05:00Z'),
      metadata: {
        userId: '550e8400-e29b-41d4-a716-446655440004',
        planId: '650e8400-e29b-41d4-a716-446655440001',
        planName: 'Basic Monthly',
      },
      failureReason: 'Insufficient funds',
      processedAt: new Date('2024-12-01T10:05:00Z'),
    },
  });

  // Pending payment (for testing webhook retry)
  await prisma.paymentTransaction.create({
    data: {
      id: 'a50e8400-e29b-41d4-a716-446655440005',
      externalReference: 'test-pending-ref-001',
      amount: 49.99,
      currency: 'USD',
      status: 'PENDING',
      webhookSent: false,
      webhookRetryCount: 2,
      webhookLastAttempt: new Date(),
      metadata: {
        userId: 'test-user-id',
        planId: 'test-plan-id',
        planName: 'Test Plan',
      },
    },
  });

  console.log('✅ Created 5 payment transactions');

  // Seed Idempotency Keys
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await prisma.idempotencyKey.create({
    data: {
      id: 'b50e8400-e29b-41d4-a716-446655440001',
      key: 'payment-test-key-expired-001',
      response: { paymentId: 'pay_test_001', status: 201 },
      expiresAt: twentyFourHoursAgo,
    },
  });

  await prisma.idempotencyKey.create({
    data: {
      id: 'b50e8400-e29b-41d4-a716-446655440002',
      key: 'payment-test-key-valid-001',
      response: { paymentId: 'pay_test_002', status: 201 },
      expiresAt: futureExpiry,
    },
  });

  console.log('✅ Created 2 idempotency keys (1 expired, 1 valid)');

  console.log('🎉 Seed completed successfully!');
  console.log('\nSummary:');
  console.log('- Payment Transactions: 5 (3 success, 1 failed, 1 pending)');
  console.log('- Idempotency Keys: 2 (1 expired, 1 valid)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

