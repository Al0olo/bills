import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed for subscription service...');

  // Clean existing data (in reverse order of dependencies)
  await prisma.paymentRecord.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();

  // Seed Users
  const hashedPassword = await bcrypt.hash('Test1234!', 10);
  
  const adminUser = await prisma.user.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'admin@test.com',
      name: 'Admin User',
      passwordHash: hashedPassword,
      role: 'admin',
    },
  });

  const user1 = await prisma.user.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'user1@test.com',
      name: 'Test User 1',
      passwordHash: hashedPassword,
      role: 'user',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      email: 'user2@test.com',
      name: 'Test User 2',
      passwordHash: hashedPassword,
      role: 'user',
    },
  });

  const user3 = await prisma.user.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      email: 'user3@test.com',
      name: 'Test User 3',
      passwordHash: hashedPassword,
      role: 'user',
    },
  });

  const user4 = await prisma.user.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440004',
      email: 'user4@test.com',
      name: 'Test User 4',
      passwordHash: hashedPassword,
      role: 'user',
    },
  });

  console.log('✅ Created 5 users (1 admin, 4 regular users)');

  // Seed Plans
  const basicMonthly = await prisma.plan.create({
    data: {
      id: '650e8400-e29b-41d4-a716-446655440001',
      name: 'Basic Monthly',
      description: 'Perfect for individuals',
      price: 9.99,
      billingCycle: 'MONTHLY',
      features: ['1 User', '10GB Storage', 'Email Support'],
      isActive: true,
    },
  });

  const proMonthly = await prisma.plan.create({
    data: {
      id: '650e8400-e29b-41d4-a716-446655440002',
      name: 'Pro Monthly',
      description: 'Great for small teams',
      price: 29.99,
      billingCycle: 'MONTHLY',
      features: ['5 Users', '100GB Storage', 'Priority Support', 'API Access'],
      isActive: true,
    },
  });

  const enterpriseMonthly = await prisma.plan.create({
    data: {
      id: '650e8400-e29b-41d4-a716-446655440003',
      name: 'Enterprise Monthly',
      description: 'For large organizations',
      price: 99.99,
      billingCycle: 'MONTHLY',
      features: [
        'Unlimited Users',
        '1TB Storage',
        '24/7 Support',
        'API Access',
        'Custom Integrations',
      ],
      isActive: true,
    },
  });

  const basicYearly = await prisma.plan.create({
    data: {
      id: '650e8400-e29b-41d4-a716-446655440004',
      name: 'Basic Yearly',
      description: 'Basic plan billed annually',
      price: 99.99,
      billingCycle: 'YEARLY',
      features: ['1 User', '10GB Storage', 'Email Support', '2 months free'],
      isActive: true,
    },
  });

  const proYearly = await prisma.plan.create({
    data: {
      id: '650e8400-e29b-41d4-a716-446655440005',
      name: 'Pro Yearly',
      description: 'Pro plan billed annually',
      price: 299.99,
      billingCycle: 'YEARLY',
      features: [
        '5 Users',
        '100GB Storage',
        'Priority Support',
        'API Access',
        '2 months free',
      ],
      isActive: true,
    },
  });

  // Create one inactive plan for testing
  await prisma.plan.create({
    data: {
      id: '650e8400-e29b-41d4-a716-446655440006',
      name: 'Inactive Plan',
      description: 'This plan is no longer available',
      price: 19.99,
      billingCycle: 'MONTHLY',
      features: ['Legacy features'],
      isActive: false,
    },
  });

  console.log('✅ Created 6 plans (5 active, 1 inactive)');

  // Seed Active Subscriptions
  const subscription1 = await prisma.subscription.create({
    data: {
      id: '750e8400-e29b-41d4-a716-446655440001',
      userId: user1.id,
      planId: basicMonthly.id,
      status: 'ACTIVE',
      startDate: new Date('2025-01-01'),
      paymentGatewayId: 'pay_test_001',
    },
  });

  const subscription2 = await prisma.subscription.create({
    data: {
      id: '750e8400-e29b-41d4-a716-446655440002',
      userId: user2.id,
      planId: proMonthly.id,
      status: 'ACTIVE',
      startDate: new Date('2025-01-15'),
      paymentGatewayId: 'pay_test_002',
    },
  });

  const subscription3 = await prisma.subscription.create({
    data: {
      id: '750e8400-e29b-41d4-a716-446655440003',
      userId: user3.id,
      planId: enterpriseMonthly.id,
      status: 'ACTIVE',
      startDate: new Date('2025-02-01'),
      paymentGatewayId: 'pay_test_003',
    },
  });

  // Seed a cancelled subscription for historical data
  await prisma.subscription.create({
    data: {
      id: '750e8400-e29b-41d4-a716-446655440004',
      userId: user4.id,
      planId: basicMonthly.id,
      status: 'CANCELLED',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2025-01-10'),
      paymentGatewayId: 'pay_test_004',
    },
  });

  console.log('✅ Created 4 subscriptions (3 active, 1 cancelled)');

  // Seed Payment Records
  await prisma.paymentRecord.create({
    data: {
      id: '850e8400-e29b-41d4-a716-446655440001',
      subscriptionId: subscription1.id,
      amount: 9.99,
      currency: 'USD',
      status: 'SUCCESS',
      paymentGatewayId: 'pay_test_001',
    },
  });

  await prisma.paymentRecord.create({
    data: {
      id: '850e8400-e29b-41d4-a716-446655440002',
      subscriptionId: subscription2.id,
      amount: 29.99,
      currency: 'USD',
      status: 'SUCCESS',
      paymentGatewayId: 'pay_test_002',
    },
  });

  await prisma.paymentRecord.create({
    data: {
      id: '850e8400-e29b-41d4-a716-446655440003',
      subscriptionId: subscription3.id,
      amount: 99.99,
      currency: 'USD',
      status: 'SUCCESS',
      paymentGatewayId: 'pay_test_003',
    },
  });

  // Failed payment record
  await prisma.paymentRecord.create({
    data: {
      id: '850e8400-e29b-41d4-a716-446655440004',
      subscriptionId: '750e8400-e29b-41d4-a716-446655440004',
      amount: 9.99,
      currency: 'USD',
      status: 'FAILED',
      paymentGatewayId: 'pay_test_004',
      failureReason: 'Insufficient funds',
    },
  });

  console.log('✅ Created 4 payment records (3 successful, 1 failed)');

  // Seed Idempotency Keys (some expired, some valid)
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await prisma.idempotencyKey.create({
    data: {
      id: '950e8400-e29b-41d4-a716-446655440001',
      idempotencyKey: 'test-key-expired-001',
      requestMethod: 'POST',
      requestPath: '/v1/subscriptions',
      requestBodyHash:
        'hash123456789012345678901234567890123456789012345678901234567890',
      responseStatus: 201,
      responseBody: { subscriptionId: 'test-sub-001' },
      expiresAt: twentyFourHoursAgo,
    },
  });

  await prisma.idempotencyKey.create({
    data: {
      id: '950e8400-e29b-41d4-a716-446655440002',
      idempotencyKey: 'test-key-expired-002',
      requestMethod: 'PATCH',
      requestPath: '/v1/subscriptions/123/upgrade',
      requestBodyHash:
        'hash234567890123456789012345678901234567890123456789012345678901',
      responseStatus: 200,
      responseBody: { subscriptionId: 'test-sub-002' },
      expiresAt: fortyEightHoursAgo,
    },
  });

  await prisma.idempotencyKey.create({
    data: {
      id: '950e8400-e29b-41d4-a716-446655440003',
      idempotencyKey: 'test-key-valid-001',
      requestMethod: 'POST',
      requestPath: '/v1/subscriptions',
      requestBodyHash:
        'hash345678901234567890123456789012345678901234567890123456789012',
      responseStatus: 201,
      responseBody: { subscriptionId: 'test-sub-003' },
      expiresAt: futureExpiry,
    },
  });

  console.log('✅ Created 3 idempotency keys (2 expired, 1 valid)');

  console.log('🎉 Seed completed successfully!');
  console.log('\nSummary:');
  console.log('- Users: 5 (1 admin, 4 regular)');
  console.log('- Plans: 6 (5 active, 1 inactive)');
  console.log('- Subscriptions: 4 (3 active, 1 cancelled)');
  console.log('- Payment Records: 4 (3 success, 1 failed)');
  console.log('- Idempotency Keys: 3 (2 expired, 1 valid)');
  console.log('\nTest Credentials:');
  console.log('- admin@test.com / Test1234!');
  console.log('- user1@test.com / Test1234!');
  console.log('- user2@test.com / Test1234!');
  console.log('- user3@test.com / Test1234!');
  console.log('- user4@test.com / Test1234!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

